const request = require('supertest');
const mongoose = require('mongoose');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Không gửi email thật: mock utils/email và lấy mã xác minh từ mock.calls.
jest.mock('../src/utils/email', () => ({
  sendVerificationCode: jest.fn(async () => ({ delivered: false, devCode: null })),
}));

const app = require('../src/app');
const User = require('../src/models/user.models');
const emailUtil = require('../src/utils/email');
const RC = require('../src/constants/responseCode');
const { AVATAR_DIR } = require('../src/middlewares/upload.middleware');

const BASE = '/it4788/user';

let mongod;
let counter = 0;
const nextEmail = () => `user${++counter}@example.com`;

const codeFor = (email) => {
  const calls = emailUtil.sendVerificationCode.mock.calls.filter(
    ([to]) => to === email.toLowerCase()
  );
  return calls.length ? calls[calls.length - 1][1] : undefined;
};

/**
 * Tạo tài khoản đã xác minh rồi đăng nhập.
 * Trả về payload đăng ký + access/refresh token để gọi các API cần auth.
 */
const createLoggedInUser = async (overrides = {}) => {
  const payload = {
    email: nextEmail(),
    password: 'matkhau123',
    name: 'Nguyen Van A',
    ...overrides,
  };

  const registerRes = await request(app).post(BASE).send(payload);
  await request(app)
    .post(`${BASE}/verify-email`)
    .send({ code: codeFor(payload.email), token: registerRes.body.data.verificationToken });

  const loginRes = await request(app)
    .post(`${BASE}/login`)
    .send({ email: payload.email, password: payload.password });

  return {
    payload,
    user: loginRes.body.data.user,
    token: loginRes.body.data.accessToken,
    refreshToken: loginRes.body.data.refreshToken,
  };
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  // Workaround: mongoose >= 9.10 + Jest 30 chặn dynamic import của driver.
  await mongoose.connect(mongod.getUri(), { runtimeAdapters: { os } });
  await User.init(); // tạo unique index trước khi test trùng username
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

// =====================================================================
describe(`GET ${BASE} — xem hồ sơ`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).get(BASE);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00012 khi token hỏng', async () => {
    const res = await request(app).get(BASE).set(auth('khong-phai-jwt'));
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.TOKEN_INVALID.code);
  });

  it('00089 trả hồ sơ, không lộ trường nội bộ', async () => {
    const { payload, token } = await createLoggedInUser();
    const res = await request(app).get(BASE).set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.GET_USER_SUCCESS.code);
    expect(res.body.data).toMatchObject({
      email: payload.email,
      name: payload.name,
      isVerified: true,
      role: 'user',
    });
    expect(res.body.data).not.toHaveProperty('password');
    expect(res.body.data).not.toHaveProperty('refreshToken');
    expect(res.body.data).not.toHaveProperty('verificationCode');
  });

  it('00052 khi tài khoản đã bị xoá nhưng token còn hạn', async () => {
    const { token, user } = await createLoggedInUser();
    await User.deleteOne({ _id: user.id });

    const res = await request(app).get(BASE).set(auth(token));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.USER_NOT_FOUND.code);
  });
});

// =====================================================================
describe(`PUT ${BASE} — sửa hồ sơ`, () => {
  let ctx;

  beforeEach(async () => {
    ctx = await createLoggedInUser();
  });

  it('00006 khi không có token', async () => {
    const res = await request(app).put(BASE).send({ name: 'Ten Moi' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00077 khi tên sai định dạng', async () => {
    const res = await request(app).put(BASE).set(auth(ctx.token)).send({ name: 'ab' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.EDIT_USER_INVALID_NAME.code);
  });

  it('00081 khi username sai định dạng', async () => {
    const res = await request(app).put(BASE).set(auth(ctx.token)).send({ username: 'ab' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.EDIT_USER_INVALID_USERNAME.code);
  });

  it('00084 khi username đã có người dùng', async () => {
    // registerSchema không nhận username nên tạo trực tiếp tài khoản thứ hai đã có username.
    await User.create({
      email: nextEmail(),
      password: 'hash-gia',
      name: 'Nguoi Dung Khac',
      username: 'daico',
    });
    const res = await request(app).put(BASE).set(auth(ctx.token)).send({ username: 'daico' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe(RC.EDIT_USER_USERNAME_EXISTS.code);
  });

  it('00078 khi giới tính không hợp lệ', async () => {
    const res = await request(app).put(BASE).set(auth(ctx.token)).send({ gender: 'unknown' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.EDIT_USER_INVALID_GENDER.code);
  });

  it('00080 khi ngày sinh không hợp lệ', async () => {
    const res = await request(app)
      .put(BASE)
      .set(auth(ctx.token))
      .send({ birthday: 'khong-phai-ngay' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.EDIT_USER_INVALID_BIRTHDAY.code);
  });

  it('00079 khi ngôn ngữ không hợp lệ', async () => {
    const res = await request(app).put(BASE).set(auth(ctx.token)).send({ language: 'fr' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.EDIT_USER_INVALID_LANGUAGE.code);
  });

  it('00086 cập nhật thành công và lưu vào DB', async () => {
    const res = await request(app).put(BASE).set(auth(ctx.token)).send({
      name: 'Tran Thi B',
      username: 'tranb',
      gender: 'female',
      birthday: '2000-01-15',
      language: 'en',
      timezone: 'Asia/Tokyo',
      avatar: 'https://example.com/a.png',
    });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.EDIT_USER_SUCCESS.code);
    expect(res.body.data).toMatchObject({
      name: 'Tran Thi B',
      username: 'tranb',
      gender: 'female',
      language: 'en',
      timezone: 'Asia/Tokyo',
      avatar: 'https://example.com/a.png',
    });

    const doc = await User.findById(ctx.user.id);
    expect(doc.name).toBe('Tran Thi B');
    expect(doc.username).toBe('tranb');
    expect(doc.gender).toBe('female');
    expect(doc.birthday.toISOString()).toBe('2000-01-15T00:00:00.000Z');
    expect(doc.language).toBe('en');
  });

  it('bỏ qua field bảo vệ: không đổi được email/role/isVerified', async () => {
    const res = await request(app).put(BASE).set(auth(ctx.token)).send({
      name: 'Ten Moi',
      email: 'hacker@example.com',
      role: 'admin',
      isVerified: false,
      groupId: 'x',
    });

    expect(res.status).toBe(200);
    const doc = await User.findById(ctx.user.id);
    expect(doc.email).toBe(ctx.payload.email);
    expect(doc.role).toBe('user');
    expect(doc.isVerified).toBe(true);
    expect(doc.groupId).toBeNull();
  });

  it('nhận ảnh multipart/form-data ở field `image`', async () => {
    const res = await request(app)
      .put(BASE)
      .set(auth(ctx.token))
      .field('name', 'Anh Dep')
      .attach('image', Buffer.from('fake-png-bytes'), 'avatar.png');

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.EDIT_USER_SUCCESS.code);
    expect(res.body.data.avatar).toMatch(/^\/it4788\/uploads\/avatars\/.+\.png$/);

    const savedPath = path.join(AVATAR_DIR, path.basename(res.body.data.avatar));
    expect(fs.existsSync(savedPath)).toBe(true);
    fs.unlinkSync(savedPath); // dọn file test
  });

  it('00158 khi tệp tải lên không phải ảnh', async () => {
    const res = await request(app)
      .put(BASE)
      .set(auth(ctx.token))
      .attach('image', Buffer.from('not-an-image'), 'note.txt');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FOOD_CREATE_UPLOAD_FAILED.code);
  });
});

// =====================================================================
describe(`POST ${BASE}/change-password — đổi mật khẩu`, () => {
  let ctx;

  beforeEach(async () => {
    ctx = await createLoggedInUser();
  });

  it('00006 khi không có token', async () => {
    const res = await request(app)
      .post(`${BASE}/change-password`)
      .send({ oldPassword: 'matkhau123', newPassword: 'matkhau456' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00069 khi thiếu trường', async () => {
    const res = await request(app).post(`${BASE}/change-password`).set(auth(ctx.token)).send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.CHANGE_PASSWORD_INVALID_FORMAT.code);
  });

  it('00069 khi mật khẩu mới quá ngắn', async () => {
    const res = await request(app)
      .post(`${BASE}/change-password`)
      .set(auth(ctx.token))
      .send({ oldPassword: 'matkhau123', newPassword: '12345' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.CHANGE_PASSWORD_INVALID_FORMAT.code);
  });

  it('00072 khi mật khẩu cũ không đúng', async () => {
    const res = await request(app)
      .post(`${BASE}/change-password`)
      .set(auth(ctx.token))
      .send({ oldPassword: 'saimatkhau', newPassword: 'matkhau456' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.OLD_PASSWORD_MISMATCH.code);
  });

  it('00073 khi mật khẩu mới trùng mật khẩu cũ', async () => {
    const res = await request(app)
      .post(`${BASE}/change-password`)
      .set(auth(ctx.token))
      .send({ oldPassword: 'matkhau123', newPassword: 'matkhau123' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.NEW_PASSWORD_SAME_AS_OLD.code);
  });

  it('00076 đổi thành công, mật khẩu cũ không đăng nhập được nữa', async () => {
    const res = await request(app)
      .post(`${BASE}/change-password`)
      .set(auth(ctx.token))
      .send({ oldPassword: 'matkhau123', newPassword: 'matkhau456' });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.CHANGE_PASSWORD_SUCCESS.code);

    const oldLogin = await request(app)
      .post(`${BASE}/login`)
      .send({ email: ctx.payload.email, password: 'matkhau123' });
    expect(oldLogin.body.code).toBe(RC.LOGIN_WRONG_CREDENTIALS.code);

    const newLogin = await request(app)
      .post(`${BASE}/login`)
      .send({ email: ctx.payload.email, password: 'matkhau456' });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.code).toBe(RC.LOGIN_SUCCESS.code);
  });

  it('huỷ refresh token cũ sau khi đổi mật khẩu', async () => {
    await request(app)
      .post(`${BASE}/change-password`)
      .set(auth(ctx.token))
      .send({ oldPassword: 'matkhau123', newPassword: 'matkhau456' });

    const res = await request(app)
      .post(`${BASE}/refresh-token`)
      .send({ refreshToken: ctx.refreshToken });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.REFRESH_TOKEN_UNVERIFIABLE.code);
  });
});

// =====================================================================
describe(`DELETE ${BASE} — xoá tài khoản`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).delete(BASE);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00092 xoá thành công, không dùng lại được token', async () => {
    const { token, user } = await createLoggedInUser();

    const res = await request(app).delete(BASE).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.DELETE_USER_SUCCESS.code);
    expect(await User.findById(user.id)).toBeNull();

    const again = await request(app).get(BASE).set(auth(token));
    expect(again.body.code).toBe(RC.USER_NOT_FOUND.code);
  });
});

// =====================================================================
describe(`PUT ${BASE}/device-token — cập nhật push token`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).put(`${BASE}/device-token`).send({ deviceToken: 'ExponentPushToken[abc]' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00025 khi thiếu deviceToken', async () => {
    const { token } = await createLoggedInUser();
    const res = await request(app).put(`${BASE}/device-token`).set(auth(token)).send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.REGISTER_MISSING_FIELDS.code);
  });

  it('lưu token mới vào DB', async () => {
    const { token, user } = await createLoggedInUser();
    const res = await request(app)
      .put(`${BASE}/device-token`)
      .set(auth(token))
      .send({ deviceToken: 'ExponentPushToken[abc]' });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.EDIT_USER_SUCCESS.code);
    const doc = await User.findById(user.id);
    expect(doc.deviceToken).toBe('ExponentPushToken[abc]');
  });
});
