const request = require('supertest');
const mongoose = require('mongoose');
const os = require('os');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../src/app');
const User = require('../src/models/user.models');
const Log = require('../src/models/log.models');
const { signAccessToken } = require('../src/utils/jwt');
const RC = require('../src/constants/responseCode');

let mongod;
let counter = 0;

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const createAdmin = async ({ isActive = true } = {}) => {
  const id = ++counter;
  const user = await User.create({
    email: `lastadmin${id}@example.com`,
    password: await bcrypt.hash('matkhau123', 4),
    name: `Admin ${id}`,
    username: `lastadmin${id}`,
    isVerified: true,
    role: 'admin',
    isActive,
  });
  return { user, token: signAccessToken(user) };
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { runtimeAdapters: { os } });
  await User.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Log.deleteMany({})]);
});

describe('Chặn mất quản trị viên cuối cùng', () => {
  it('admin cuối cùng không thể tự xoá tài khoản bằng DELETE /user', async () => {
    const { user, token } = await createAdmin();

    const res = await request(app).delete('/it4788/user').set(auth(token));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.ADMIN_USER_LAST_ADMIN.code);
    expect(await User.findById(user._id)).not.toBeNull();
  });

  it('admin bị khoá không được tính là admin đang hoạt động', async () => {
    const { user, token } = await createAdmin();
    await createAdmin({ isActive: false });

    const res = await request(app).delete('/it4788/user').set(auth(token));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.ADMIN_USER_LAST_ADMIN.code);
    expect(await User.findById(user._id)).not.toBeNull();
  });

  it('khi còn 2 admin, một admin được tự xoá tài khoản', async () => {
    const first = await createAdmin();
    const second = await createAdmin();

    const res = await request(app).delete('/it4788/user').set(auth(first.token));

    expect(res.status).toBe(200);
    expect(await User.findById(first.user._id)).toBeNull();
    expect((await User.findById(second.user._id)).role).toBe('admin');
  });

  it('khi còn 2 admin, admin được hạ quyền admin còn lại', async () => {
    const first = await createAdmin();
    const second = await createAdmin();

    const res = await request(app)
      .put(`/it4788/admin/user/${second.user._id}`)
      .set(auth(first.token))
      .send({ role: 'user' });

    expect(res.status).toBe(200);
    expect((await User.findById(second.user._id)).role).toBe('user');
  });

  it('khi còn 2 admin, admin được khoá admin còn lại', async () => {
    const first = await createAdmin();
    const second = await createAdmin();

    const res = await request(app)
      .patch(`/it4788/admin/user/${second.user._id}/status`)
      .set(auth(first.token))
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect((await User.findById(second.user._id)).isActive).toBe(false);
  });

  it('khi còn 2 admin, admin được xoá admin còn lại', async () => {
    const first = await createAdmin();
    const second = await createAdmin();

    const res = await request(app)
      .delete(`/it4788/admin/user/${second.user._id}`)
      .set(auth(first.token));

    expect(res.status).toBe(200);
    expect(await User.findById(second.user._id)).toBeNull();
    expect((await User.findById(first.user._id)).role).toBe('admin');
  });
});
