const request = require('supertest');
const mongoose = require('mongoose');
const os = require('os');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Không gửi email thật: mock utils/email và đọc mã từ mock.calls.
jest.mock('../src/utils/email', () => ({
  sendVerificationCode: jest.fn(async () => ({ delivered: false, devCode: null })),
  sendPasswordResetCode: jest.fn(async () => ({ delivered: false, devCode: null })),
}));

const app = require('../src/app');
const User = require('../src/models/user.models');
const emailUtil = require('../src/utils/email');
const RC = require('../src/constants/responseCode');

const BASE = '/it4788/user';

let mongod;
let counter = 0;

const nextEmail = () => `reset${++counter}@example.com`;

const codeFor = (mockFn, email) => {
  const calls = mockFn.mock.calls.filter(([to]) => to === email.toLowerCase());
  return calls.length ? calls[calls.length - 1][1] : undefined;
};

const verificationCodeFor = (email) => codeFor(emailUtil.sendVerificationCode, email);
const resetCodeFor = (email) => codeFor(emailUtil.sendPasswordResetCode, email);

/** Tạo tài khoản đã xác minh email (mật khẩu mặc định `matkhau123`). */
const createVerifiedUser = async (overrides = {}) => {
  const payload = {
    email: nextEmail(),
    password: 'matkhau123',
    name: 'Nguyen Van A',
    ...overrides,
  };

  const registerRes = await request(app).post(BASE).send(payload);
  await request(app)
    .post(`${BASE}/verify-email`)
    .send({
      code: verificationCodeFor(payload.email),
      token: registerRes.body.data.verificationToken,
    });

  return payload;
};

const forgotPassword = (email) =>
  request(app).post(`${BASE}/forgot-password`).send({ email });

const resetPassword = (body) =>
  request(app).post(`${BASE}/reset-password`).send(body);

const login = (email, password) =>
  request(app).post(`${BASE}/login`).send({ email, password });

/** Yêu cầu mã đặt lại mật khẩu và trả về token + mã 6 số đã "gửi". */
const requestReset = async (email) => {
  const res = await forgotPassword(email);
  return { res, token: res.body.data?.resetToken, code: resetCodeFor(email) };
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  // Workaround: mongoose >= 9.10 + Jest 30 chặn dynamic import của driver.
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
describe(`POST ${BASE}/forgot-password — yêu cầu mã đặt lại mật khẩu`, () => {
  it('00005 khi thiếu email', async () => {
    const res = await request(app).post(`${BASE}/forgot-password`).send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.SEND_CODE_MISSING_FIELDS.code);
  });

  it('00026 khi email sai định dạng', async () => {
    const res = await forgotPassword('khong-phai-email');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.REGISTER_INVALID_EMAIL.code);
  });

  it('00036 khi email không tồn tại', async () => {
    const res = await forgotPassword(nextEmail());
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.EMAIL_ACCOUNT_NOT_FOUND.code);
    expect(emailUtil.sendPasswordResetCode).not.toHaveBeenCalled();
  });

  it('00048 khi hợp lệ; trả resetToken, lưu mã 6 số hạn 10 phút, không đổi mật khẩu', async () => {
    const payload = await createVerifiedUser();
    const before = await User.findOne({ email: payload.email }).select('+password');

    const res = await forgotPassword(payload.email);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.SEND_CODE_SUCCESS.code);
    expect(res.body.data.resetToken).toEqual(expect.any(String));
    expect(res.body.data.codeExpiresIn).toBe(600);

    const code = resetCodeFor(payload.email);
    expect(code).toMatch(/^\d{6}$/);

    const doc = await User.findOne({ email: payload.email }).select(
      '+password +passwordResetCode +passwordResetCodeExpiresAt'
    );
    expect(doc.passwordResetCode).toBe(code);
    expect(doc.passwordResetCodeExpiresAt.getTime()).toBeGreaterThan(Date.now());
    // Chưa đặt lại thì mật khẩu cũ vẫn giữ nguyên.
    expect(doc.password).toBe(before.password);
    // Không đụng tới mã xác minh email.
    const untouched = await User.findOne({ email: payload.email }).select('+verificationCode');
    expect(untouched.verificationCode).toBeUndefined();
  });

  it('email viết hoa vẫn tìm thấy tài khoản (Joi chuẩn hoá lowercase)', async () => {
    const payload = await createVerifiedUser();
    const res = await forgotPassword(payload.email.toUpperCase());
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.SEND_CODE_SUCCESS.code);
    expect(resetCodeFor(payload.email)).toMatch(/^\d{6}$/);
  });

  it('yêu cầu lại: mã mới thay mã cũ, mã cũ không dùng được (00067)', async () => {
    const payload = await createVerifiedUser();
    const first = await requestReset(payload.email);
    const second = await requestReset(payload.email);

    expect(second.res.status).toBe(200);
    expect(second.code).not.toBe(first.code);

    const stale = await resetPassword({
      code: first.code,
      token: second.token,
      newPassword: 'matkhaumoi1',
    });
    expect(stale.status).toBe(400);
    expect(stale.body.code).toBe(RC.RESET_PASSWORD_CODE_INVALID.code);
  });

  it('không dùng mã xác minh email cho việc đặt lại mật khẩu', async () => {
    // Tài khoản chưa xác minh: vẫn còn mã xác minh email trong DB.
    const payload = {
      email: nextEmail(),
      password: 'matkhau123',
      name: 'Nguyen Van A',
    };
    await request(app).post(BASE).send(payload);
    const verifyCode = verificationCodeFor(payload.email);

    const { token } = await requestReset(payload.email);
    const res = await resetPassword({
      code: verifyCode,
      token,
      newPassword: 'matkhaumoi1',
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.RESET_PASSWORD_CODE_INVALID.code);
  });
});

// =====================================================================
describe(`POST ${BASE}/reset-password — đặt mật khẩu mới`, () => {
  it('00053 khi thiếu mã', async () => {
    const payload = await createVerifiedUser();
    const { token } = await requestReset(payload.email);

    const res = await resetPassword({ token, newPassword: 'matkhaumoi1' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.VERIFY_CODE_MISSING.code);
  });

  it('00067 khi mã không đúng 6 chữ số', async () => {
    const payload = await createVerifiedUser();
    const { token } = await requestReset(payload.email);

    const res = await resetPassword({ code: 'abc123', token, newPassword: 'matkhaumoi1' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.RESET_PASSWORD_CODE_INVALID.code);
  });

  it('00066 khi mật khẩu mới ngắn hơn 6 ký tự', async () => {
    const payload = await createVerifiedUser();
    const { token, code } = await requestReset(payload.email);

    const res = await resetPassword({ code, token, newPassword: '12345' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.NEW_PASSWORD_INVALID.code);
  });

  it('00055 khi thiếu token', async () => {
    const payload = await createVerifiedUser();
    const { code } = await requestReset(payload.email);

    const res = await resetPassword({ code, newPassword: 'matkhaumoi1' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.RESET_PASSWORD_TOKEN_INVALID.code);
  });

  it('00055 khi token rác', async () => {
    const res = await resetPassword({
      code: '123456',
      token: 'khong-phai-jwt',
      newPassword: 'matkhaumoi1',
    });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.RESET_PASSWORD_TOKEN_INVALID.code);
  });

  it('00055 khi dùng access token thay token đặt lại', async () => {
    const payload = await createVerifiedUser();
    const loginRes = await login(payload.email, payload.password);

    const res = await resetPassword({
      code: '123456',
      token: loginRes.body.data.accessToken,
      newPassword: 'matkhaumoi1',
    });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.RESET_PASSWORD_TOKEN_INVALID.code);
  });

  it('00055 khi token hợp lệ nhưng user không tồn tại', async () => {
    const payload = await createVerifiedUser();
    const { token } = await requestReset(payload.email);
    await User.deleteMany({});

    const res = await resetPassword({ code: '123456', token, newPassword: 'matkhaumoi1' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.USER_NOT_FOUND.code);
  });

  it('00067 khi mã sai; mật khẩu không đổi', async () => {
    const payload = await createVerifiedUser();
    const { token, code } = await requestReset(payload.email);
    const wrong = code === '000000' ? '111111' : '000000';

    const res = await resetPassword({ code: wrong, token, newPassword: 'matkhaumoi1' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.RESET_PASSWORD_CODE_INVALID.code);

    const ok = await login(payload.email, payload.password);
    expect(ok.status).toBe(200);
    expect(ok.body.code).toBe(RC.LOGIN_SUCCESS.code);
  });

  it('00067 khi mã đã quá hạn; mật khẩu không đổi', async () => {
    const payload = await createVerifiedUser();
    const { token, code } = await requestReset(payload.email);
    await User.updateOne(
      { email: payload.email },
      { $set: { passwordResetCodeExpiresAt: new Date(Date.now() - 1000) } }
    );

    const res = await resetPassword({ code, token, newPassword: 'matkhaumoi1' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.RESET_PASSWORD_CODE_INVALID.code);

    const ok = await login(payload.email, payload.password);
    expect(ok.status).toBe(200);
  });

  it('00067 khi token và mã thuộc hai người dùng khác nhau', async () => {
    const alice = await createVerifiedUser();
    const bob = await createVerifiedUser();
    const aliceReset = await requestReset(alice.email);
    const bobReset = await requestReset(bob.email);

    const res = await resetPassword({
      code: aliceReset.code,
      token: bobReset.token,
      newPassword: 'matkhaumoi1',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.RESET_PASSWORD_CODE_INVALID.code);

    // Không tài khoản nào bị đổi mật khẩu.
    expect((await login(alice.email, alice.password)).status).toBe(200);
    expect((await login(bob.email, bob.password)).status).toBe(200);
  });

  it('00073 khi mật khẩu mới trùng mật khẩu hiện tại', async () => {
    const payload = await createVerifiedUser();
    const { token, code } = await requestReset(payload.email);

    const res = await resetPassword({ code, token, newPassword: payload.password });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.NEW_PASSWORD_SAME_AS_OLD.code);
  });

  it('00068 khi thành công; đăng nhập bằng mật khẩu mới, mã + token bị vô hiệu', async () => {
    const payload = await createVerifiedUser();
    const { token, code } = await requestReset(payload.email);

    const res = await resetPassword({ code, token, newPassword: 'matkhaumoi1' });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.NEW_PASSWORD_SUCCESS.code);

    // Mật khẩu cũ không đăng nhập được, mật khẩu mới thì được.
    expect((await login(payload.email, payload.password)).body.code).toBe(
      RC.LOGIN_WRONG_CREDENTIALS.code
    );
    const ok = await login(payload.email, 'matkhaumoi1');
    expect(ok.status).toBe(200);
    expect(ok.body.code).toBe(RC.LOGIN_SUCCESS.code);

    // DB lưu hash bcrypt, xoá mã đặt lại.
    const doc = await User.findOne({ email: payload.email }).select(
      '+password +passwordResetCode +passwordResetCodeExpiresAt'
    );
    expect(doc.password).toMatch(/^\$2[aby]\$/);
    expect(doc.password).not.toBe('matkhaumoi1');
    expect(doc.passwordResetCode).toBeUndefined();
    expect(doc.passwordResetCodeExpiresAt).toBeUndefined();

    // Dùng lại token/mã vừa rồi không được nữa.
    const replay = await resetPassword({ code, token, newPassword: 'matkhaumoi2' });
    expect(replay.status).toBe(400);
    expect(replay.body.code).toBe(RC.RESET_PASSWORD_CODE_INVALID.code);
  });

  it('thu hồi refresh token của các phiên cũ', async () => {
    const payload = await createVerifiedUser();
    const before = await login(payload.email, payload.password);
    const oldRefreshToken = before.body.data.refreshToken;

    const { token, code } = await requestReset(payload.email);
    await resetPassword({ code, token, newPassword: 'matkhaumoi1' });

    const replay = await request(app)
      .post(`${BASE}/refresh-token`)
      .send({ refreshToken: oldRefreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe(RC.REFRESH_TOKEN_UNVERIFIABLE.code);
  });
});
