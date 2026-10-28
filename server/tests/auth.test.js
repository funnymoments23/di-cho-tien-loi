const request = require('supertest');
const mongoose = require('mongoose');
const os = require('os');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Không gửi email thật: thay module email bằng mock và đọc mã 6 số từ mock.calls.
jest.mock('../src/utils/email', () => ({
  sendVerificationCode: jest.fn(async () => ({ delivered: false, devCode: null })),
}));

const app = require('../src/app');
const User = require('../src/models/user.models');
const emailUtil = require('../src/utils/email');
const RC = require('../src/constants/responseCode');
const { hashToken } = require('../src/utils/jwt');

const BASE = '/it4788/user';

let mongod;
let counter = 0;

const nextEmail = () => `user${++counter}@example.com`;

const basePayload = (overrides = {}) => ({
  email: nextEmail(),
  password: 'matkhau123',
  name: 'Nguyen Van A',
  ...overrides,
});

/** Đăng ký qua API thật, trả về response + payload đã gửi. */
const register = async (overrides = {}) => {
  const payload = basePayload(overrides);
  const res = await request(app).post(BASE).send(payload);
  return { res, payload };
};

/** Mã xác minh gần nhất mà service đã "gửi" cho email này. */
const codeFor = (email) => {
  const calls = emailUtil.sendVerificationCode.mock.calls.filter(
    ([to]) => to === email.toLowerCase()
  );
  return calls.length ? calls[calls.length - 1][1] : undefined;
};

/** Đăng ký + xác minh email, dùng cho các test cần tài khoản đã kích hoạt. */
const registerAndVerify = async (overrides = {}) => {
  const { res, payload } = await register(overrides);
  const verifyRes = await request(app).post(`${BASE}/verify-email`).send({
    code: codeFor(payload.email),
    token: res.body.data.verificationToken,
  });
  return { payload, registerRes: res, verifyRes };
};

const login = (email, password) => request(app).post(`${BASE}/login`).send({ email, password });

/** Token JWT tự ký để test các nhánh hết hạn / sai loại. */
const craftToken = (payload, secret, expiresIn = '1h') =>
  jwt.sign(payload, secret, { expiresIn, issuer: 'di-cho-tien-loi' });

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  // Workaround bug đã biết: mongoose >= 9.10 + Jest 30 khiến driver mongodb 7.6+
  // nạp `os` bằng dynamic import() bị Jest chặn, handshake thiếu metadata
  // ("Missing required sub-document 'driver'"). Truyền os adapter trực tiếp.
  // Xem: https://github.com/Automattic/mongoose/issues/16596
  await mongoose.connect(mongod.getUri(), { runtimeAdapters: { os } });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

// =====================================================================
describe('GET /it4788/health', () => {
  it('trả 00000 khi server sống', async () => {
    const res = await request(app).get('/it4788/health');
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('00000');
  });
});

// =====================================================================
describe(`POST ${BASE} — đăng ký`, () => {
  it('00025 khi thiếu toàn bộ body', async () => {
    const res = await request(app).post(BASE).send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.REGISTER_MISSING_FIELDS.code);
  });

  it('00026 khi email sai định dạng', async () => {
    const res = await request(app)
      .post(BASE)
      .send(basePayload({ email: 'khong-phai-email' }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.REGISTER_INVALID_EMAIL.code);
  });

  it('00027 khi mật khẩu ngắn hơn 6 ký tự', async () => {
    const res = await request(app).post(BASE).send(basePayload({ password: '12345' }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.REGISTER_INVALID_PASSWORD.code);
  });

  it('00028 khi tên ngắn hơn 3 ký tự', async () => {
    const res = await request(app).post(BASE).send(basePayload({ name: 'ab' }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.REGISTER_INVALID_NAME.code);
  });

  it('00035 khi dữ liệu hợp lệ; trả token xác minh, không trả password', async () => {
    const { res, payload } = await register();

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(RC.REGISTER_SUCCESS.code);
    expect(res.body.data.verificationToken).toEqual(expect.any(String));
    expect(res.body.data.codeExpiresIn).toBe(600);
    expect(res.body.data.user).toMatchObject({
      email: payload.email,
      name: payload.name,
      isVerified: false,
      role: 'user',
    });
    expect(res.body.data.user).not.toHaveProperty('password');
    expect(res.body.data.user).not.toHaveProperty('refreshToken');
    expect(res.body.data.user).not.toHaveProperty('verificationCode');

    // Mã 6 số đã được gửi và lưu trong DB
    expect(codeFor(payload.email)).toMatch(/^\d{6}$/);
    const doc = await User.findOne({ email: payload.email }).select(
      '+password +verificationCode +verificationCodeExpiresAt'
    );
    expect(doc.password).toMatch(/^\$2[aby]\$/);
    expect(doc.password).not.toBe(payload.password);
    expect(doc.verificationCode).toBe(codeFor(payload.email));
    expect(doc.verificationCodeExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('00032 khi email đã tồn tại (không phân biệt hoa/thường)', async () => {
    const { payload } = await register();
    const res = await request(app)
      .post(BASE)
      .send(basePayload({ email: payload.email.toUpperCase() }));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe(RC.REGISTER_EMAIL_EXISTS.code);
  });

  it('bỏ qua field lạ: không thể tự nâng role/đánh dấu đã xác minh', async () => {
    const { res, payload } = await register({ role: 'admin', isVerified: true, groupId: 'x' });
    expect(res.status).toBe(201);

    const doc = await User.findOne({ email: payload.email });
    expect(doc.role).toBe('user');
    expect(doc.isVerified).toBe(false);
    expect(doc.groupId).toBeNull();
  });
});

// =====================================================================
describe(`POST ${BASE}/send-verification-code — gửi lại mã`, () => {
  it('00005 khi thiếu email', async () => {
    const res = await request(app).post(`${BASE}/send-verification-code`).send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.SEND_CODE_MISSING_FIELDS.code);
  });

  it('00026 khi email sai định dạng', async () => {
    const res = await request(app)
      .post(`${BASE}/send-verification-code`)
      .send({ email: 'sai-email' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.REGISTER_INVALID_EMAIL.code);
  });

  it('00036 khi email không tồn tại', async () => {
    const res = await request(app)
      .post(`${BASE}/send-verification-code`)
      .send({ email: nextEmail() });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.EMAIL_ACCOUNT_NOT_FOUND.code);
  });

  it('không gửi lại mã nếu tài khoản đã xác minh', async () => {
    const { payload } = await registerAndVerify();
    const callsBefore = emailUtil.sendVerificationCode.mock.calls.length;

    const res = await request(app)
      .post(`${BASE}/send-verification-code`)
      .send({ email: payload.email });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.SEND_CODE_SUCCESS.code);
    expect(res.body.data.alreadyVerified).toBe(true);
    expect(emailUtil.sendVerificationCode.mock.calls.length).toBe(callsBefore);
  });

  it('00048 + mã mới dùng được để xác minh', async () => {
    const { payload } = await register();

    const res = await request(app)
      .post(`${BASE}/send-verification-code`)
      .send({ email: payload.email });

    expect(res.status).toBe(200);
    expect(res.body.data.alreadyVerified).toBe(false);
    expect(res.body.data.verificationToken).toEqual(expect.any(String));

    const verifyRes = await request(app).post(`${BASE}/verify-email`).send({
      code: codeFor(payload.email),
      token: res.body.data.verificationToken,
    });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.code).toBe(RC.VERIFY_EMAIL_SUCCESS.code);
  });
});

// =====================================================================
describe(`POST ${BASE}/verify-email — xác minh email`, () => {
  it('00053 khi thiếu mã', async () => {
    const { res } = await register();
    const r = await request(app)
      .post(`${BASE}/verify-email`)
      .send({ token: res.body.data.verificationToken });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe(RC.VERIFY_CODE_MISSING.code);
  });

  it('00054 khi mã không đúng 6 chữ số', async () => {
    const { res } = await register();
    const r = await request(app)
      .post(`${BASE}/verify-email`)
      .send({ code: 'abc123', token: res.body.data.verificationToken });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe(RC.VERIFY_CODE_MISMATCH.code);
  });

  it('00053 khi thiếu token xác minh (fallback hiện tại)', async () => {
    const { payload } = await register();
    const r = await request(app)
      .post(`${BASE}/verify-email`)
      .send({ code: codeFor(payload.email) });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe(RC.VERIFY_CODE_MISSING.code);
  });

  it('00055 khi token rác', async () => {
    const r = await request(app)
      .post(`${BASE}/verify-email`)
      .send({ code: '123456', token: 'khong-phai-jwt' });
    expect(r.status).toBe(401);
    expect(r.body.code).toBe(RC.VERIFY_TOKEN_INVALID.code);
  });

  it('00054 khi mã sai', async () => {
    const { res, payload } = await register();
    const real = codeFor(payload.email);
    const wrong = real === '000000' ? '111111' : '000000';

    const r = await request(app)
      .post(`${BASE}/verify-email`)
      .send({ code: wrong, token: res.body.data.verificationToken });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe(RC.VERIFY_CODE_MISMATCH.code);
    expect((await User.findOne({ email: payload.email })).isVerified).toBe(false);
  });

  it('00054 khi mã đã quá hạn', async () => {
    const { res, payload } = await register();
    await User.updateOne(
      { email: payload.email },
      { $set: { verificationCodeExpiresAt: new Date(Date.now() - 1000) } }
    );

    const r = await request(app)
      .post(`${BASE}/verify-email`)
      .send({ code: codeFor(payload.email), token: res.body.data.verificationToken });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe(RC.VERIFY_CODE_MISMATCH.code);
    expect((await User.findOne({ email: payload.email })).isVerified).toBe(false);
  });

  it('00058 khi mã đúng; xoá mã khỏi DB', async () => {
    const { res, payload } = await register();
    const code = codeFor(payload.email);

    const r = await request(app)
      .post(`${BASE}/verify-email`)
      .send({ code, token: res.body.data.verificationToken });

    expect(r.status).toBe(200);
    expect(r.body.code).toBe(RC.VERIFY_EMAIL_SUCCESS.code);
    expect(r.body.data.user.isVerified).toBe(true);
    expect(r.body.data.user).not.toHaveProperty('password');

    const doc = await User.findOne({ email: payload.email }).select(
      '+verificationCode +verificationCodeExpiresAt'
    );
    expect(doc.isVerified).toBe(true);
    expect(doc.verificationCode).toBeUndefined();
    expect(doc.verificationCodeExpiresAt).toBeUndefined();
  });

  it('gọi lại lần 2 với cùng token: báo alreadyVerified, không lỗi', async () => {
    const { registerRes, payload } = await registerAndVerify();
    const r = await request(app)
      .post(`${BASE}/verify-email`)
      .send({
        code: codeFor(payload.email),
        token: registerRes.body.data.verificationToken,
      });
    expect(r.status).toBe(200);
    expect(r.body.data.alreadyVerified).toBe(true);
  });

  it('00055 khi dùng access token thay token xác minh', async () => {
    const { payload } = await registerAndVerify();
    const loginRes = await login(payload.email, payload.password);

    const r = await request(app)
      .post(`${BASE}/verify-email`)
      .send({ code: '123456', token: loginRes.body.data.accessToken });
    expect(r.status).toBe(401);
    expect(r.body.code).toBe(RC.VERIFY_TOKEN_INVALID.code);
  });
});

// =====================================================================
describe(`POST ${BASE}/login — đăng nhập`, () => {
  it('00038 khi thiếu field', async () => {
    const res = await request(app).post(`${BASE}/login`).send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.LOGIN_MISSING_FIELDS.code);
  });

  it('00039 khi email sai định dạng', async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ email: 'sai', password: 'matkhau123' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.LOGIN_INVALID_EMAIL.code);
  });

  it('00040 khi mật khẩu sai định dạng', async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ email: nextEmail(), password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.LOGIN_INVALID_PASSWORD.code);
  });

  it('00042 khi email không tồn tại', async () => {
    const res = await login(nextEmail(), 'matkhau123');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.LOGIN_ACCOUNT_NOT_FOUND.code);
  });

  it('00044 khi tài khoản chưa xác minh', async () => {
    const { payload } = await register();
    const res = await login(payload.email, payload.password);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.LOGIN_EMAIL_NOT_VERIFIED.code);
  });

  it('00045 khi sai mật khẩu', async () => {
    const { payload } = await registerAndVerify();
    const res = await login(payload.email, 'sai-mat-khau');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.LOGIN_WRONG_CREDENTIALS.code);
  });

  it('00047 khi đúng; lưu refresh token dưới dạng băm', async () => {
    const { payload } = await registerAndVerify();
    const res = await login(payload.email, payload.password);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.LOGIN_SUCCESS.code);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
    expect(res.body.data.user).not.toHaveProperty('password');
    expect(res.body.data.user).not.toHaveProperty('refreshToken');

    const doc = await User.findOne({ email: payload.email }).select('+refreshToken');
    expect(doc.refreshToken).toBe(hashToken(res.body.data.refreshToken));
    expect(doc.refreshToken).not.toBe(res.body.data.refreshToken);
  });

  it('đăng nhập được với email viết hoa (Joi chuẩn hoá lowercase)', async () => {
    const { payload } = await registerAndVerify();
    const res = await login(payload.email.toUpperCase(), payload.password);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.LOGIN_SUCCESS.code);
  });
});

// =====================================================================
describe(`POST ${BASE}/refresh-token — làm mới token`, () => {
  const getTokens = async () => {
    const { payload, registerRes } = await registerAndVerify();
    const res = await login(payload.email, payload.password);
    return {
      ...res.body.data,
      userId: registerRes.body.data.user.id,
    };
  };

  it('00059 khi thiếu refreshToken', async () => {
    const res = await request(app).post(`${BASE}/refresh-token`).send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.REFRESH_TOKEN_MISSING.code);
  });

  it('00063 khi token rác', async () => {
    const res = await request(app)
      .post(`${BASE}/refresh-token`)
      .send({ refreshToken: 'khong-phai-jwt' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.REFRESH_TOKEN_UNVERIFIABLE.code);
  });

  it('00063 khi dùng access token thay refresh token', async () => {
    const { accessToken } = await getTokens();
    const res = await request(app)
      .post(`${BASE}/refresh-token`)
      .send({ refreshToken: accessToken });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.REFRESH_TOKEN_UNVERIFIABLE.code);
  });

  it('00062 khi refresh token hết hạn', async () => {
    const { userId } = await getTokens();
    const expired = craftToken(
      { sub: userId, typ: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      -10
    );
    const res = await request(app)
      .post(`${BASE}/refresh-token`)
      .send({ refreshToken: expired });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.REFRESH_TOKEN_EXPIRED.code);
  });

  it('00061 khi token hợp lệ nhưng user không tồn tại', async () => {
    const ghostId = new mongoose.Types.ObjectId().toString();
    const token = craftToken({ sub: ghostId, typ: 'refresh' }, process.env.JWT_REFRESH_SECRET);
    const res = await request(app)
      .post(`${BASE}/refresh-token`)
      .send({ refreshToken: token });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.REFRESH_TOKEN_USER_MISMATCH.code);
  });

  it('00063 khi sub không phải ObjectId', async () => {
    const token = craftToken({ sub: 'abc', typ: 'refresh' }, process.env.JWT_REFRESH_SECRET);
    const res = await request(app)
      .post(`${BASE}/refresh-token`)
      .send({ refreshToken: token });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.REFRESH_TOKEN_UNVERIFIABLE.code);
  });

  it('00065 khi hợp lệ; cặp token mới khác cặp cũ', async () => {
    const { refreshToken, accessToken } = await getTokens();
    const res = await request(app)
      .post(`${BASE}/refresh-token`)
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.REFRESH_TOKEN_SUCCESS.code);
    expect(res.body.data.refreshToken).not.toBe(refreshToken);
    expect(res.body.data.accessToken).not.toBe(accessToken);
  });

  it('rotate: refresh token cũ không dùng lại được (00063)', async () => {
    const { refreshToken } = await getTokens();
    const first = await request(app)
      .post(`${BASE}/refresh-token`)
      .send({ refreshToken });
    expect(first.status).toBe(200);

    const replay = await request(app)
      .post(`${BASE}/refresh-token`)
      .send({ refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe(RC.REFRESH_TOKEN_UNVERIFIABLE.code);
  });

  it('refresh token mới dùng được sau khi rotate', async () => {
    const { refreshToken } = await getTokens();
    const first = await request(app)
      .post(`${BASE}/refresh-token`)
      .send({ refreshToken });
    const second = await request(app)
      .post(`${BASE}/refresh-token`)
      .send({ refreshToken: first.body.data.refreshToken });

    expect(second.status).toBe(200);
    expect(second.body.code).toBe(RC.REFRESH_TOKEN_SUCCESS.code);
  });
});

// =====================================================================
describe(`POST ${BASE}/logout — đăng xuất`, () => {
  const getSession = async () => {
    const { payload } = await registerAndVerify();
    const res = await login(payload.email, payload.password);
    return { ...res.body.data, payload };
  };

  it('00006 khi không có header Authorization', async () => {
    const res = await request(app).post(`${BASE}/logout`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00006 khi header sai scheme', async () => {
    const res = await request(app)
      .post(`${BASE}/logout`)
      .set('Authorization', 'Token abc');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00012 khi access token rác', async () => {
    const res = await request(app)
      .post(`${BASE}/logout`)
      .set('Authorization', 'Bearer khong-phai-jwt');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.TOKEN_INVALID.code);
  });

  it('00011 khi access token hết hạn', async () => {
    const expired = craftToken(
      { sub: new mongoose.Types.ObjectId().toString(), role: 'user', typ: 'access' },
      process.env.JWT_ACCESS_SECRET,
      -10
    );
    const res = await request(app)
      .post(`${BASE}/logout`)
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.SESSION_EXPIRED.code);
  });

  it('00012 khi dùng refresh token làm Bearer token', async () => {
    const { refreshToken } = await getSession();
    const res = await request(app)
      .post(`${BASE}/logout`)
      .set('Authorization', `Bearer ${refreshToken}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.TOKEN_INVALID.code);
  });

  it('00050 + thu hồi refresh token (dùng lại trả 00063)', async () => {
    const { accessToken, refreshToken } = await getSession();

    const res = await request(app)
      .post(`${BASE}/logout`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.LOGOUT_SUCCESS.code);

    const doc = await User.findOne({}).select('+refreshToken');
    expect(doc.refreshToken).toBeNull();

    const replay = await request(app)
      .post(`${BASE}/refresh-token`)
      .send({ refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe(RC.REFRESH_TOKEN_UNVERIFIABLE.code);
  });
});
