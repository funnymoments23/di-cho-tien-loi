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
const Category = require('../src/models/category.models');
const emailUtil = require('../src/utils/email');
const RC = require('../src/constants/responseCode');

const USER = '/it4788/user';
const CATEGORY = '/it4788/admin/category';

let mongod;
let counter = 0;
const nextEmail = () => `category${++counter}@example.com`;

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

const createCategory = (token, name) =>
  request(app).post(CATEGORY).set(auth(token)).send({ name });

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  // Workaround: mongoose >= 9.10 + Jest 30 chặn dynamic import của driver.
  await mongoose.connect(mongod.getUri(), { runtimeAdapters: { os } });
  await User.init();
  await Category.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Category.deleteMany({});
});

// =====================================================================
describe(`GET ${CATEGORY} — lấy danh sách danh mục`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).get(CATEGORY);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00129 trả mảng rỗng khi chưa có danh mục', async () => {
    const { token } = await createLoggedInUser();
    const res = await request(app).get(CATEGORY).set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.CATEGORY_GET_SUCCESS.code);
    expect(res.body.data).toEqual([]);
  });

  it('00129 người dùng thường cũng xem được, sắp xếp theo tên', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    await createCategory(token, 'Rau củ');
    await createCategory(token, 'Đồ hộp');

    const member = await createLoggedInUser();
    const res = await request(app).get(CATEGORY).set(auth(member.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.CATEGORY_GET_SUCCESS.code);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.map((item) => item.name).sort()).toEqual(
      ['Rau củ', 'Đồ hộp'].sort()
    );
    expect(res.body.data[0]).not.toHaveProperty('createdAt');
  });
});

// =====================================================================
describe(`POST ${CATEGORY} — tạo danh mục`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).post(CATEGORY).send({ name: 'Thịt' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00017 khi người dùng thường gọi API', async () => {
    const { token } = await createLoggedInUser();
    const res = await createCategory(token, 'Thịt');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.ACCESS_DENIED_17.code);
  });

  it('00131 khi thiếu tên', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    const res = await request(app).post(CATEGORY).set(auth(token)).send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.CATEGORY_CREATE_MISSING_NAME.code);
  });

  it('00131 khi tên rỗng hoặc quá 50 ký tự', async () => {
    const { token } = await createLoggedInUser({ admin: true });

    const blank = await createCategory(token, '   ');
    expect(blank.status).toBe(400);
    expect(blank.body.code).toBe(RC.CATEGORY_CREATE_MISSING_NAME.code);

    const tooLong = await createCategory(token, 'a'.repeat(51));
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.code).toBe(RC.CATEGORY_CREATE_MISSING_NAME.code);
  });

  it('00135 tạo thành công, tên được trim', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    const res = await createCategory(token, '  Thịt  ');

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(RC.CATEGORY_CREATE_SUCCESS.code);
    expect(res.body.data).toMatchObject({ name: 'Thịt' });
    expect(res.body.data.id).toBeTruthy();

    const saved = await Category.findById(res.body.data.id);
    expect(saved.name).toBe('Thịt');
  });

  it('00132 khi tên đã tồn tại', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    await createCategory(token, 'Thịt');

    const res = await createCategory(token, 'Thịt');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe(RC.CATEGORY_CREATE_EXISTS.code);
    expect(await Category.countDocuments({})).toBe(1);
  });

  it('00132 khi tên trùng sau khi trim', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    await createCategory(token, 'Rau củ');

    const res = await createCategory(token, '  Rau củ  ');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe(RC.CATEGORY_CREATE_EXISTS.code);
    expect(await Category.countDocuments({})).toBe(1);
  });
});

// =====================================================================
describe(`PUT ${CATEGORY} — sửa tên danh mục`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).put(CATEGORY).send({ name: 'A', newName: 'B' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00017 khi người dùng thường gọi API', async () => {
    const { token } = await createLoggedInUser();
    const res = await request(app)
      .put(CATEGORY)
      .set(auth(token))
      .send({ name: 'A', newName: 'B' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.ACCESS_DENIED_17.code);
  });

  it('00136 khi thiếu name hoặc newName', async () => {
    const { token } = await createLoggedInUser({ admin: true });

    const missingNew = await request(app).put(CATEGORY).set(auth(token)).send({ name: 'A' });
    expect(missingNew.status).toBe(400);
    expect(missingNew.body.code).toBe(RC.CATEGORY_UPDATE_MISSING_FIELDS.code);

    const empty = await request(app).put(CATEGORY).set(auth(token)).send({});
    expect(empty.status).toBe(400);
    expect(empty.body.code).toBe(RC.CATEGORY_UPDATE_MISSING_FIELDS.code);
  });

  it('00137 khi tên cũ trùng tên mới', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    await createCategory(token, 'Thịt');

    const res = await request(app)
      .put(CATEGORY)
      .set(auth(token))
      .send({ name: 'Thịt', newName: 'Thịt' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.CATEGORY_UPDATE_SAME_NAME.code);
  });

  it('00138 khi không tìm thấy danh mục cần sửa', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    const res = await request(app)
      .put(CATEGORY)
      .set(auth(token))
      .send({ name: 'Không có', newName: 'Mới' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.CATEGORY_UPDATE_NOT_FOUND.code);
  });

  it('00138 khi tên mới đã tồn tại', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    await createCategory(token, 'Thịt');
    await createCategory(token, 'Rau củ');

    const res = await request(app)
      .put(CATEGORY)
      .set(auth(token))
      .send({ name: 'Thịt', newName: 'Rau củ' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(RC.CATEGORY_UPDATE_NEW_NAME_EXISTS.code);
    expect((await Category.findOne({ name: 'Thịt' })).name).toBe('Thịt');
  });

  it('00141 sửa thành công', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    await createCategory(token, 'Thịt');

    const res = await request(app)
      .put(CATEGORY)
      .set(auth(token))
      .send({ name: 'Thịt', newName: '  Thịt bò  ' });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.CATEGORY_UPDATE_SUCCESS.code);
    expect(res.body.data.name).toBe('Thịt bò');
    expect(await Category.findOne({ name: 'Thịt bò' })).not.toBeNull();
    expect(await Category.findOne({ name: 'Thịt' })).toBeNull();
  });
});

// =====================================================================
describe(`DELETE ${CATEGORY} — xoá danh mục`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).delete(CATEGORY).send({ name: 'Thịt' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00017 khi người dùng thường gọi API', async () => {
    const { token } = await createLoggedInUser();
    const res = await request(app).delete(CATEGORY).set(auth(token)).send({ name: 'Thịt' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.ACCESS_DENIED_17.code);
  });

  it('00142 khi thiếu tên', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    const res = await request(app).delete(CATEGORY).set(auth(token)).send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.CATEGORY_DELETE_MISSING_NAME.code);
  });

  it('00143 khi danh mục không tồn tại', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    const res = await request(app)
      .delete(CATEGORY)
      .set(auth(token))
      .send({ name: 'Không có' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.CATEGORY_DELETE_NOT_FOUND.code);
  });

  it('00146 xoá thành công', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    await createCategory(token, 'Thịt');

    const res = await request(app).delete(CATEGORY).set(auth(token)).send({ name: 'Thịt' });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.CATEGORY_DELETE_SUCCESS.code);
    expect(res.body.data.name).toBe('Thịt');
    expect(await Category.countDocuments({})).toBe(0);
  });
});
