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
const Log = require('../src/models/log.models');
const { signAccessToken } = require('../src/utils/jwt');
const RC = require('../src/constants/responseCode');

const USER = '/it4788/user';
const GROUP = `${USER}/group`;
const FOOD = '/it4788/food';
const ADMIN_LOGS = '/it4788/admin/logs';

let mongod;
let counter = 0;

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const createUser = async ({ role = 'user', groupId = null, name = 'Nguyen Van A' } = {}) => {
  const id = ++counter;
  const user = await User.create({
    email: `logs${id}@example.com`,
    password: await bcrypt.hash('matkhau123', 4),
    name,
    username: `logsuser${id}`,
    isVerified: true,
    role,
    groupId,
  });
  return { user, token: signAccessToken(user) };
};

const createFixture = async () => {
  const admin = await createUser({ role: 'admin', name: 'Quản trị viên' });
  const member = await createUser({ name: 'Thành viên' });
  const outsider = await createUser({ name: 'Người ngoài' });

  const group = await Group.create({
    name: 'Gia đình Logs',
    adminId: admin.user._id,
    members: [admin.user._id, member.user._id],
  });
  await User.updateMany(
    { _id: { $in: [admin.user._id, member.user._id] } },
    { $set: { groupId: group._id } }
  );

  admin.user.groupId = group._id;
  member.user.groupId = group._id;

  return { admin, member, outsider, group };
};

const getLogs = (token, query = {}) =>
  request(app).get(ADMIN_LOGS).set(auth(token)).query(query);

const countLogs = () => Log.countDocuments();

const todayKey = () => new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { runtimeAdapters: { os } });
  await User.init();
  await Group.init();
  await Log.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([
    Log.deleteMany({}),
    Food.deleteMany({}),
    Category.deleteMany({}),
    Unit.deleteMany({}),
    User.deleteMany({}),
    Group.deleteMany({}),
  ]);
});

describe(`GET ${ADMIN_LOGS}`, () => {
  it('admin xem được nhật ký do thao tác cập nhật hồ sơ sinh ra', async () => {
    const { admin, group } = await createFixture();

    const updateRes = await request(app)
      .put(USER)
      .set(auth(admin.token))
      .send({ name: 'Tên mới' });
    expect(updateRes.status).toBe(200);

    const res = await getLogs(admin.token);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.LOGS_GET_SUCCESS.code);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0]).toMatchObject({
      action: 'UPDATE',
      entity: 'user',
      entityId: String(admin.user._id),
      user: {
        id: String(admin.user._id),
        name: 'Tên mới',
      },
      group: { id: String(group._id), name: group.name },
    });
    expect(res.body.data.items[0].detail).toContain('PUT /user');
  });

  it('không phải admin bị từ chối 00017', async () => {
    const { member } = await createFixture();

    const res = await getLogs(member.token);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.ACCESS_DENIED_17.code);
  });

  it('không có token trả 00006', async () => {
    const res = await request(app).get(ADMIN_LOGS);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('chỉ ghi thao tác ghi/sửa/xoá thành công, không ghi GET hay request lỗi', async () => {
    const { admin } = await createFixture();

    await request(app).get('/it4788/food').set(auth(admin.token));
    await request(app).put(USER).set(auth(admin.token)).send({ name: 'A' });
    await request(app).post(`${USER}/login`).send({
      email: 'khong-ton-tai@example.com',
      password: 'matkhau123',
    });

    expect(await countLogs()).toBe(0);

    await request(app).put(USER).set(auth(admin.token)).send({ name: 'Tên hợp lệ' });
    expect(await countLogs()).toBe(1);
  });

  it('admin thấy log CREATE group với entityId và groupId là nhóm vừa tạo', async () => {
    const { admin, outsider } = await createFixture();

    const createRes = await request(app)
      .post(GROUP)
      .set(auth(outsider.token))
      .send({ groupName: 'Nhóm mới' });
    expect(createRes.status).toBe(201);

    const res = await getLogs(admin.token);

    expect(res.body.data.total).toBe(1);
    const log = res.body.data.items[0];
    expect(log).toMatchObject({
      action: 'CREATE',
      entity: 'group',
      entityId: createRes.body.data.id,
      group: { id: createRes.body.data.id, name: 'Nhóm mới' },
    });
  });

  it('thêm thành viên ghi UPDATE group, không phải CREATE group', async () => {
    const { admin, outsider, group } = await createFixture();

    const addRes = await request(app)
      .post(`${GROUP}/add`)
      .set(auth(admin.token))
      .send({ username: outsider.user.username });
    expect(addRes.status).toBe(200);

    const res = await getLogs(admin.token);
    expect(res.body.data.items[0]).toMatchObject({
      action: 'UPDATE',
      entity: 'group',
      entityId: String(group._id),
      group: { id: String(group._id), name: group.name },
    });
  });

  it('thao tác quản trị danh mục ghi entity category và không gắn nhóm', async () => {
    const { admin } = await createFixture();

    const createRes = await request(app)
      .post('/it4788/admin/category')
      .set(auth(admin.token))
      .send({ name: 'Rau củ' });
    expect(createRes.status).toBe(201);

    const res = await getLogs(admin.token);
    expect(res.body.data.items[0]).toMatchObject({
      action: 'CREATE',
      entity: 'category',
      entityId: createRes.body.data.id,
      group: null,
    });
  });
});

describe('Bộ lọc và phân trang nhật ký', () => {
  const seedLogs = async (fixture) => {
    const now = new Date();
    await Log.create([
      {
        userId: fixture.admin.user._id,
        groupId: fixture.group._id,
        action: 'DELETE',
        entity: 'food',
        detail: 'xoá thực phẩm',
        createdAt: now,
      },
      {
        userId: fixture.member.user._id,
        groupId: fixture.group._id,
        action: 'UPDATE',
        entity: 'food',
        detail: 'sửa thực phẩm',
        createdAt: now,
      },
      {
        userId: fixture.member.user._id,
        groupId: fixture.group._id,
        action: 'DELETE',
        entity: 'meal',
        detail: 'xoá bữa ăn',
        createdAt: now,
      },
    ]);
  };

  it('lọc theo action và entity', async () => {
    const fixture = await createFixture();
    await seedLogs(fixture);

    const res = await getLogs(fixture.admin.token, { action: 'DELETE', entity: 'food' });

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0]).toMatchObject({
      action: 'DELETE',
      entity: 'food',
      user: { id: String(fixture.admin.user._id) },
      group: { id: String(fixture.group._id) },
    });
  });

  it('lọc theo userId và groupId', async () => {
    const fixture = await createFixture();
    await seedLogs(fixture);

    const byUser = await getLogs(fixture.admin.token, {
      userId: String(fixture.member.user._id),
    });
    expect(byUser.body.data.total).toBe(2);

    const byGroup = await getLogs(fixture.admin.token, {
      groupId: String(fixture.group._id),
    });
    expect(byGroup.body.data.total).toBe(3);
  });

  it('lọc theo khoảng ngày giờ Việt Nam', async () => {
    const fixture = await createFixture();
    await seedLogs(fixture);

    const today = await getLogs(fixture.admin.token, { from: todayKey(), to: todayKey() });
    expect(today.body.data.total).toBe(3);

    const old = await getLogs(fixture.admin.token, {
      from: '2000-01-01',
      to: '2000-01-31',
    });
    expect(old.body.data.total).toBe(0);
  });

  it('phân trang trả total và totalPages đúng, mới nhất trước', async () => {
    const fixture = await createFixture();
    await seedLogs(fixture);

    const page1 = await getLogs(fixture.admin.token, { limit: 2, page: 1 });
    expect(page1.body.data).toMatchObject({ total: 3, page: 1, limit: 2, totalPages: 2 });
    expect(page1.body.data.items).toHaveLength(2);

    const page2 = await getLogs(fixture.admin.token, { limit: 2, page: 2 });
    expect(page2.body.data.items).toHaveLength(1);
    expect(page2.body.data.items[0].detail).toBe('xoá thực phẩm');
  });

  it('query sai trả 00405', async () => {
    const fixture = await createFixture();

    for (const query of [
      { action: 'LOGIN' },
      { userId: 'khong-phai-object-id' },
      { page: 0 },
      { limit: 101 },
    ]) {
      const res = await getLogs(fixture.admin.token, query);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe(RC.LOGS_INVALID_QUERY.code);
    }
  });

  it('ngày không tồn tại hoặc from > to trả 00406', async () => {
    const fixture = await createFixture();

    for (const query of [
      { from: '2026-02-31' },
      { from: '2026-12-31', to: '2026-01-01' },
      { to: '2026-13-01' },
    ]) {
      const res = await getLogs(fixture.admin.token, query);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe(RC.LOGS_INVALID_DATE_RANGE.code);
    }
  });
});
