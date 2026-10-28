const request = require('supertest');
const mongoose = require('mongoose');
const os = require('os');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Không gửi email thật: dùng mock như các test Auth/Tài khoản/Nhóm.
jest.mock('../src/utils/email', () => ({
  sendVerificationCode: jest.fn(async () => ({ delivered: false, devCode: null })),
}));

const app = require('../src/app');
const User = require('../src/models/user.models');
const Unit = require('../src/models/unit.models');
const emailUtil = require('../src/utils/email');
const RC = require('../src/constants/responseCode');

const USER = '/it4788/user';
const UNIT = '/it4788/admin/unit';

let mongod;
let counter = 0;
const nextEmail = () => `unit${++counter}@example.com`;

const codeFor = (email) => {
  const calls = emailUtil.sendVerificationCode.mock.calls.filter(
    ([to]) => to === email.toLowerCase()
  );
  return calls.length ? calls[calls.length - 1][1] : undefined;
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

/**
 * Đăng ký + xác minh + đăng nhập.
 * `admin = true` thì nâng role trong DB rồi đăng nhập lại để token mang role admin.
 */
const createLoggedInUser = async ({ admin = false, name = 'Nguyen Van A' } = {}) => {
  const email = nextEmail();
  const password = 'matkhau123';

  const registerRes = await request(app).post(USER).send({ email, password, name });
  await request(app)
    .post(`${USER}/verify-email`)
    .send({ code: codeFor(email), token: registerRes.body.data.verificationToken });

  if (admin) await User.updateOne({ email }, { $set: { role: 'admin' } });

  const loginRes = await request(app).post(`${USER}/login`).send({ email, password });
  return { token: loginRes.body.data.accessToken, user: loginRes.body.data.user };
};

const createUnit = (token, name) =>
  request(app).post(UNIT).set(auth(token)).send({ name });

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  // Workaround: mongoose >= 9.10 + Jest 30 chặn dynamic import của driver.
  await mongoose.connect(mongod.getUri(), { runtimeAdapters: { os } });
  await User.init();
  await Unit.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Unit.deleteMany({});
});

// =====================================================================
describe(`GET ${UNIT} — lấy danh sách đơn vị`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).get(UNIT);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00110 trả mảng rỗng khi chưa có đơn vị', async () => {
    const { token } = await createLoggedInUser();
    const res = await request(app).get(UNIT).set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.UNIT_GET_SUCCESS.code);
    expect(res.body.data).toEqual([]);
  });

  it('00110 người dùng thường cũng xem được, sắp xếp theo tên', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    await createUnit(token, 'kg');
    await createUnit(token, 'gram');

    const member = await createLoggedInUser();
    const res = await request(app).get(UNIT).set(auth(member.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.UNIT_GET_SUCCESS.code);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.map((item) => item.name).sort()).toEqual(['gram', 'kg'].sort());
    expect(res.body.data[0]).not.toHaveProperty('createdAt');
  });
});

// =====================================================================
describe(`POST ${UNIT} — tạo đơn vị`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).post(UNIT).send({ name: 'kg' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00017 khi người dùng thường gọi API', async () => {
    const { token } = await createLoggedInUser();
    const res = await createUnit(token, 'kg');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.ACCESS_DENIED_17.code);
  });

  it('00112 khi thiếu tên', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    const res = await request(app).post(UNIT).set(auth(token)).send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.UNIT_CREATE_MISSING_NAME.code);
  });

  it('00112 khi tên rỗng hoặc quá 50 ký tự', async () => {
    const { token } = await createLoggedInUser({ admin: true });

    const blank = await createUnit(token, '   ');
    expect(blank.status).toBe(400);
    expect(blank.body.code).toBe(RC.UNIT_CREATE_MISSING_NAME.code);

    const tooLong = await createUnit(token, 'a'.repeat(51));
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.code).toBe(RC.UNIT_CREATE_MISSING_NAME.code);
  });

  it('00116 tạo thành công, tên được trim', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    const res = await createUnit(token, '  kg  ');

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(RC.UNIT_CREATE_SUCCESS.code);
    expect(res.body.data).toMatchObject({ name: 'kg' });
    expect(res.body.data.id).toBeTruthy();

    const saved = await Unit.findById(res.body.data.id);
    expect(saved.name).toBe('kg');
  });

  it('00113 khi tên đã tồn tại', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    await createUnit(token, 'kg');

    const res = await createUnit(token, 'kg');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe(RC.UNIT_CREATE_EXISTS.code);
    expect(await Unit.countDocuments({})).toBe(1);
  });

  it('00113 khi tên trùng sau khi trim', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    await createUnit(token, 'hộp');

    const res = await createUnit(token, '  hộp  ');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe(RC.UNIT_CREATE_EXISTS.code);
    expect(await Unit.countDocuments({})).toBe(1);
  });
});

// =====================================================================
describe(`PUT ${UNIT} — sửa tên đơn vị`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).put(UNIT).send({ name: 'kg', newName: 'gam' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00017 khi người dùng thường gọi API', async () => {
    const { token } = await createLoggedInUser();
    const res = await request(app)
      .put(UNIT)
      .set(auth(token))
      .send({ name: 'kg', newName: 'gam' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.ACCESS_DENIED_17.code);
  });

  it('00117 khi thiếu name hoặc newName', async () => {
    const { token } = await createLoggedInUser({ admin: true });

    const missingNew = await request(app).put(UNIT).set(auth(token)).send({ name: 'kg' });
    expect(missingNew.status).toBe(400);
    expect(missingNew.body.code).toBe(RC.UNIT_UPDATE_MISSING_FIELDS.code);

    const empty = await request(app).put(UNIT).set(auth(token)).send({});
    expect(empty.status).toBe(400);
    expect(empty.body.code).toBe(RC.UNIT_UPDATE_MISSING_FIELDS.code);
  });

  it('00118 khi tên cũ trùng tên mới', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    await createUnit(token, 'kg');

    const res = await request(app)
      .put(UNIT)
      .set(auth(token))
      .send({ name: 'kg', newName: 'kg' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.UNIT_UPDATE_SAME_NAME.code);
  });

  it('00119 khi không tìm thấy đơn vị cần sửa', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    const res = await request(app)
      .put(UNIT)
      .set(auth(token))
      .send({ name: 'không có', newName: 'mới' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.UNIT_UPDATE_NOT_FOUND.code);
  });

  it('00113 khi tên mới đã tồn tại', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    await createUnit(token, 'kg');
    await createUnit(token, 'gram');

    const res = await request(app)
      .put(UNIT)
      .set(auth(token))
      .send({ name: 'kg', newName: 'gram' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(RC.UNIT_UPDATE_NEW_NAME_EXISTS.code);
    expect((await Unit.findOne({ name: 'kg' })).name).toBe('kg');
  });

  it('00122 sửa thành công', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    await createUnit(token, 'kg');

    const res = await request(app)
      .put(UNIT)
      .set(auth(token))
      .send({ name: 'kg', newName: '  gam  ' });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.UNIT_UPDATE_SUCCESS.code);
    expect(res.body.data.name).toBe('gam');
    expect(await Unit.findOne({ name: 'gam' })).not.toBeNull();
    expect(await Unit.findOne({ name: 'kg' })).toBeNull();
  });
});

// =====================================================================
describe(`DELETE ${UNIT} — xoá đơn vị`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).delete(UNIT).send({ name: 'kg' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00017 khi người dùng thường gọi API', async () => {
    const { token } = await createLoggedInUser();
    const res = await request(app).delete(UNIT).set(auth(token)).send({ name: 'kg' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.ACCESS_DENIED_17.code);
  });

  it('00123 khi thiếu tên', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    const res = await request(app).delete(UNIT).set(auth(token)).send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.UNIT_DELETE_MISSING_NAME.code);
  });

  it('00125 khi đơn vị không tồn tại', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    const res = await request(app).delete(UNIT).set(auth(token)).send({ name: 'không có' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.UNIT_DELETE_NOT_FOUND.code);
  });

  it('00128 xoá thành công', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    await createUnit(token, 'kg');

    const res = await request(app).delete(UNIT).set(auth(token)).send({ name: 'kg' });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.UNIT_DELETE_SUCCESS.code);
    expect(res.body.data.name).toBe('kg');
    expect(await Unit.countDocuments({})).toBe(0);
  });
});
