const request = require('supertest');
const mongoose = require('mongoose');
const os = require('os');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../src/app');
const User = require('../src/models/user.models');
const Group = require('../src/models/group.models');
const Category = require('../src/models/category.models');
const Unit = require('../src/models/unit.models');
const Food = require('../src/models/food.models');
const { signAccessToken, signPasswordResetToken } = require('../src/utils/jwt');
const RC = require('../src/constants/responseCode');

let mongod;
let counter = 0;

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const createUser = async ({ role = 'user', password = 'matkhau123', groupId = null } = {}) => {
  const id = ++counter;
  const user = await User.create({
    email: `hard${id}@example.com`,
    password: await bcrypt.hash(password, 4),
    name: `Người dùng ${id}`,
    username: `harduser${id}`,
    isVerified: true,
    role,
    groupId,
  });
  return { user, token: signAccessToken(user) };
};

const createAdmin = async () => createUser({ role: 'admin' });

const createCategoryAndUnit = async () => {
  const id = ++counter;
  const category = await Category.create({ name: `Danh mục ${id}` });
  const unit = await Unit.create({ name: `Đơn vị ${id}` });
  return { category, unit };
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { runtimeAdapters: { os } });
  await User.init();
  await Group.init();
  await Food.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([
    Food.deleteMany({}),
    Category.deleteMany({}),
    Unit.deleteMany({}),
    User.deleteMany({}),
    Group.deleteMany({}),
  ]);
});

describe('Toàn vẹn danh mục / đơn vị', () => {
  it('00407 khi xoá danh mục đang có thực phẩm tham chiếu', async () => {
    const { user: admin, token } = await createAdmin();
    const { category, unit } = await createCategoryAndUnit();
    const group = await Group.create({
      name: 'Gia đình A',
      adminId: admin._id,
      members: [admin._id],
    });

    await Food.create({
      name: 'Thịt bò',
      categoryId: category._id,
      unitId: unit._id,
      groupId: group._id,
    });

    const res = await request(app)
      .delete(`/it4788/admin/category/${encodeURIComponent(category.name)}`)
      .set(auth(token));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(RC.CATEGORY_DELETE_IN_USE.code);
    expect(await Category.findById(category._id)).not.toBeNull();
  });

  it('00408 khi xoá đơn vị đang có thực phẩm tham chiếu', async () => {
    const { user: admin, token } = await createAdmin();
    const { category, unit } = await createCategoryAndUnit();
    const group = await Group.create({
      name: 'Gia đình A',
      adminId: admin._id,
      members: [admin._id],
    });

    await Food.create({
      name: 'Thịt bò',
      categoryId: category._id,
      unitId: unit._id,
      groupId: group._id,
    });

    const res = await request(app)
      .delete(`/it4788/admin/unit/${encodeURIComponent(unit.name)}`)
      .set(auth(token));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(RC.UNIT_DELETE_IN_USE.code);
    expect(await Unit.findById(unit._id)).not.toBeNull();
  });
});

describe('Lỗi JSON', () => {
  it('trả 400 / 00409 khi body JSON sai định dạng', async () => {
    const res = await request(app)
      .post('/it4788/user/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.INVALID_JSON.code);
  });
});

describe('tokenVersion', () => {
  it('đổi mật khẩu làm access token cũ mất hiệu lực', async () => {
    const { token } = await createUser({ password: 'matkhau123' });

    const change = await request(app)
      .post('/it4788/user/change-password')
      .set(auth(token))
      .send({ oldPassword: 'matkhau123', newPassword: 'matkhau456' });
    expect(change.status).toBe(200);

    const res = await request(app).get('/it4788/user').set(auth(token));
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.TOKEN_INVALID.code);
  });

  it('reset mật khẩu làm access token cũ mất hiệu lực', async () => {
    const { user, token } = await createUser({ password: 'matkhau123' });
    user.passwordResetCode = '123456';
    user.passwordResetCodeExpiresAt = new Date(Date.now() + 60_000);
    await user.save();

    const resetToken = signPasswordResetToken(user);
    const reset = await request(app).post('/it4788/user/reset-password').send({
      code: '123456',
      token: resetToken,
      newPassword: 'matkhaumoi1',
    });
    expect(reset.status).toBe(200);

    const res = await request(app).get('/it4788/user').set(auth(token));
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.TOKEN_INVALID.code);
  });
});
