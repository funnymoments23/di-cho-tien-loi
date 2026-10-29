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
const Group = require('../src/models/group.models');
const emailUtil = require('../src/utils/email');
const RC = require('../src/constants/responseCode');

const USER = '/it4788/user';
const ADMIN_USER = '/it4788/admin/user';

let mongod;
let counter = 0;
const nextEmail = () => `adminuser${++counter}@example.com`;

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
const createLoggedInUser = async ({ admin = false, name = 'Nguyen Van A', verify = true } = {}) => {
  const email = nextEmail();
  const password = 'matkhau123';

  const registerRes = await request(app).post(USER).send({ email, password, name });

  if (verify) {
    await request(app)
      .post(`${USER}/verify-email`)
      .send({ code: codeFor(email), token: registerRes.body.data.verificationToken });
  }

  if (admin) await User.updateOne({ email }, { $set: { role: 'admin' } });

  const loginRes = await request(app).post(`${USER}/login`).send({ email, password });
  const data = loginRes.body.data;

  return {
    email,
    password,
    user: data?.user,
    token: data?.accessToken,
    refreshToken: data?.refreshToken,
  };
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  // Workaround: mongoose >= 9.10 + Jest 30 chặn dynamic import của driver.
  await mongoose.connect(mongod.getUri(), { runtimeAdapters: { os } });
  await User.init();
  await Group.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Group.deleteMany({});
});

// =====================================================================
describe(`GET ${ADMIN_USER} — danh sách người dùng`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).get(ADMIN_USER);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00017 khi người dùng thường gọi API', async () => {
    const { token } = await createLoggedInUser();
    const res = await request(app).get(ADMIN_USER).set(auth(token));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.ACCESS_DENIED_17.code);
  });

  it('00387 trả danh sách có phân trang và không lộ trường nội bộ', async () => {
    const admin = await createLoggedInUser({ admin: true, name: 'Quan Tri Vien' });
    await createLoggedInUser({ name: 'Nguoi Dung Mot' });

    const res = await request(app).get(ADMIN_USER).set(auth(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.ADMIN_USER_GET_LIST_SUCCESS.code);
    expect(res.body.data).toMatchObject({ total: 2, page: 1, limit: 20, totalPages: 1 });
    expect(res.body.data.items).toHaveLength(2);

    const item = res.body.data.items[0];
    expect(item).not.toHaveProperty('password');
    expect(item).not.toHaveProperty('refreshToken');
    expect(item).not.toHaveProperty('verificationCode');
    expect(item).toHaveProperty('isActive', true);
    expect(item).toHaveProperty('createdAt');
  });

  it('lọc theo keyword, role, status, isVerified', async () => {
    const admin = await createLoggedInUser({ admin: true, name: 'Admin He Thong' });
    await createLoggedInUser({ name: 'Tran Thi Tim Kiem' });
    await createLoggedInUser({ name: 'Nguoi Chua Xac Minh', verify: false });

    const byKeyword = await request(app)
      .get(ADMIN_USER)
      .query({ keyword: 'tim kiem' })
      .set(auth(admin.token));
    expect(byKeyword.body.data.total).toBe(1);
    expect(byKeyword.body.data.items[0].name).toBe('Tran Thi Tim Kiem');

    const byRole = await request(app)
      .get(ADMIN_USER)
      .query({ role: 'admin' })
      .set(auth(admin.token));
    expect(byRole.body.data.total).toBe(1);
    expect(byRole.body.data.items[0].email).toBe(admin.email);

    const unverified = await request(app)
      .get(ADMIN_USER)
      .query({ isVerified: false })
      .set(auth(admin.token));
    expect(unverified.body.data.total).toBe(1);
    expect(unverified.body.data.items[0].name).toBe('Nguoi Chua Xac Minh');

    const locked = await request(app)
      .get(ADMIN_USER)
      .query({ status: 'locked' })
      .set(auth(admin.token));
    expect(locked.body.data.total).toBe(0);
  });

  it('phân trang bằng page/limit', async () => {
    const admin = await createLoggedInUser({ admin: true });
    await createLoggedInUser({ name: 'Nguoi Thu Hai' });
    await createLoggedInUser({ name: 'Nguoi Thu Ba' });

    const res = await request(app)
      .get(ADMIN_USER)
      .query({ page: 2, limit: 2 })
      .set(auth(admin.token));

    expect(res.body.data).toMatchObject({ total: 3, page: 2, limit: 2, totalPages: 2 });
    expect(res.body.data.items).toHaveLength(1);
  });

  it('00394 khi tham số truy vấn sai', async () => {
    const { token } = await createLoggedInUser({ admin: true });

    const invalidRole = await request(app)
      .get(ADMIN_USER)
      .query({ role: 'superadmin' })
      .set(auth(token));
    expect(invalidRole.status).toBe(400);
    expect(invalidRole.body.code).toBe(RC.ADMIN_USER_INVALID_QUERY.code);

    const invalidPage = await request(app)
      .get(ADMIN_USER)
      .query({ page: 0 })
      .set(auth(token));
    expect(invalidPage.body.code).toBe(RC.ADMIN_USER_INVALID_QUERY.code);

    const invalidLimit = await request(app)
      .get(ADMIN_USER)
      .query({ limit: 101 })
      .set(auth(token));
    expect(invalidLimit.body.code).toBe(RC.ADMIN_USER_INVALID_QUERY.code);
  });
});

// =====================================================================
describe(`GET ${ADMIN_USER}/:id — chi tiết người dùng`, () => {
  it('00393 khi id không hợp lệ', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    const res = await request(app).get(`${ADMIN_USER}/abc`).set(auth(token));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.ADMIN_USER_INVALID_ID.code);
  });

  it('00392 khi không tìm thấy người dùng', async () => {
    const { token } = await createLoggedInUser({ admin: true });
    const ghostId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`${ADMIN_USER}/${ghostId}`).set(auth(token));

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.ADMIN_USER_NOT_FOUND.code);
  });

  it('00388 trả chi tiết kèm tên nhóm', async () => {
    const admin = await createLoggedInUser({ admin: true });
    const member = await createLoggedInUser({ name: 'Thanh Vien Nhom' });
    await request(app)
      .post(`${USER}/group`)
      .set(auth(member.token))
      .send({ groupName: 'Gia Dinh A' });

    const res = await request(app)
      .get(`${ADMIN_USER}/${member.user.id}`)
      .set(auth(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.ADMIN_USER_GET_DETAIL_SUCCESS.code);
    expect(res.body.data).toMatchObject({
      id: member.user.id,
      email: member.email,
      groupName: 'Gia Dinh A',
      isActive: true,
    });
  });
});

// =====================================================================
describe(`PUT ${ADMIN_USER}/:id — cập nhật tài khoản`, () => {
  let admin;
  let target;

  beforeEach(async () => {
    admin = await createLoggedInUser({ admin: true, name: 'Quan Tri Vien' });
    target = await createLoggedInUser({ name: 'Nguoi Bi Sua' });
  });

  it('00395 khi body rỗng', async () => {
    const res = await request(app)
      .put(`${ADMIN_USER}/${target.user.id}`)
      .set(auth(admin.token))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.ADMIN_USER_UPDATE_MISSING_FIELDS.code);
  });

  it('00077 khi tên sai định dạng', async () => {
    const res = await request(app)
      .put(`${ADMIN_USER}/${target.user.id}`)
      .set(auth(admin.token))
      .send({ name: 'ab' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.EDIT_USER_INVALID_NAME.code);
  });

  it('00396 khi role hoặc isVerified sai', async () => {
    const badRole = await request(app)
      .put(`${ADMIN_USER}/${target.user.id}`)
      .set(auth(admin.token))
      .send({ role: 'moderator' });
    expect(badRole.status).toBe(400);
    expect(badRole.body.code).toBe(RC.ADMIN_USER_UPDATE_INVALID_FIELDS.code);

    const badVerified = await request(app)
      .put(`${ADMIN_USER}/${target.user.id}`)
      .set(auth(admin.token))
      .send({ isVerified: 'khong-phai-boolean' });
    expect(badVerified.body.code).toBe(RC.ADMIN_USER_UPDATE_INVALID_FIELDS.code);
  });

  it('00397 khi email đã có người dùng', async () => {
    const res = await request(app)
      .put(`${ADMIN_USER}/${target.user.id}`)
      .set(auth(admin.token))
      .send({ email: admin.email });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(RC.ADMIN_USER_EMAIL_EXISTS.code);
  });

  it('00398 khi username đã có người dùng', async () => {
    await User.updateOne({ _id: admin.user.id }, { $set: { username: 'daico' } });

    const res = await request(app)
      .put(`${ADMIN_USER}/${target.user.id}`)
      .set(auth(admin.token))
      .send({ username: 'daico' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(RC.ADMIN_USER_USERNAME_EXISTS.code);
  });

  it('00399 khi admin tự hạ quyền chính mình', async () => {
    const res = await request(app)
      .put(`${ADMIN_USER}/${admin.user.id}`)
      .set(auth(admin.token))
      .send({ role: 'user' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.ADMIN_USER_CANNOT_CHANGE_OWN_ROLE.code);

    const doc = await User.findById(admin.user.id);
    expect(doc.role).toBe('admin');
  });

  it('00389 cập nhật thành công hồ sơ + quyền + xác minh', async () => {
    const res = await request(app)
      .put(`${ADMIN_USER}/${target.user.id}`)
      .set(auth(admin.token))
      .send({
        name: 'Ten Moi',
        email: 'email-moi@example.com',
        username: 'tenmoi',
        role: 'admin',
        isVerified: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.ADMIN_USER_UPDATE_SUCCESS.code);
    expect(res.body.data).toMatchObject({
      name: 'Ten Moi',
      email: 'email-moi@example.com',
      username: 'tenmoi',
      role: 'admin',
      isVerified: true,
    });

    const doc = await User.findById(target.user.id);
    expect(doc.name).toBe('Ten Moi');
    expect(doc.email).toBe('email-moi@example.com');
    expect(doc.username).toBe('tenmoi');
    expect(doc.role).toBe('admin');
  });

  it('đổi role có hiệu lực ngay và thu hồi refresh token', async () => {
    // Trước khi nâng quyền, token cũ bị từ chối ở API admin.
    const before = await request(app).get(ADMIN_USER).set(auth(target.token));
    expect(before.status).toBe(403);

    await request(app)
      .put(`${ADMIN_USER}/${target.user.id}`)
      .set(auth(admin.token))
      .send({ role: 'admin' });

    // auth middleware đọc role từ DB nên token cũ có quyền admin ngay.
    const after = await request(app).get(ADMIN_USER).set(auth(target.token));
    expect(after.status).toBe(200);
    expect(after.body.code).toBe(RC.ADMIN_USER_GET_LIST_SUCCESS.code);

    const doc = await User.findById(target.user.id).select('+refreshToken');
    expect(doc.refreshToken).toBeNull();
  });
});

// =====================================================================
describe(`PATCH ${ADMIN_USER}/:id/status — khoá / mở khoá`, () => {
  let admin;
  let target;

  beforeEach(async () => {
    admin = await createLoggedInUser({ admin: true });
    target = await createLoggedInUser({ name: 'Nguoi Bi Khoa' });
  });

  it('00402 khi thiếu isActive', async () => {
    const res = await request(app)
      .patch(`${ADMIN_USER}/${target.user.id}/status`)
      .set(auth(admin.token))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.ADMIN_USER_INVALID_STATUS.code);
  });

  it('00400 khi admin tự khoá chính mình', async () => {
    const res = await request(app)
      .patch(`${ADMIN_USER}/${admin.user.id}/status`)
      .set(auth(admin.token))
      .send({ isActive: false });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.ADMIN_USER_CANNOT_LOCK_SELF.code);
  });

  it('00390 khoá tài khoản: chặn token cũ, refresh và đăng nhập', async () => {
    const res = await request(app)
      .patch(`${ADMIN_USER}/${target.user.id}/status`)
      .set(auth(admin.token))
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.ADMIN_USER_STATUS_SUCCESS.code);
    expect(res.body.data).toMatchObject({ isActive: false });
    expect(res.body.data.lockedAt).toBeTruthy();

    const doc = await User.findById(target.user.id).select('+refreshToken');
    expect(doc.isActive).toBe(false);
    expect(doc.refreshToken).toBeNull();

    const useOldToken = await request(app).get(USER).set(auth(target.token));
    expect(useOldToken.status).toBe(403);
    expect(useOldToken.body.code).toBe(RC.ACCOUNT_LOCKED.code);

    const refresh = await request(app)
      .post(`${USER}/refresh-token`)
      .send({ refreshToken: target.refreshToken });
    expect(refresh.status).toBe(403);
    expect(refresh.body.code).toBe(RC.ACCOUNT_LOCKED.code);

    const login = await request(app)
      .post(`${USER}/login`)
      .send({ email: target.email, password: target.password });
    expect(login.status).toBe(403);
    expect(login.body.code).toBe(RC.ACCOUNT_LOCKED.code);
  });

  it('00390 mở khoá: đăng nhập lại được', async () => {
    await request(app)
      .patch(`${ADMIN_USER}/${target.user.id}/status`)
      .set(auth(admin.token))
      .send({ isActive: false });

    const res = await request(app)
      .patch(`${ADMIN_USER}/${target.user.id}/status`)
      .set(auth(admin.token))
      .send({ isActive: true });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ isActive: true, lockedAt: null });

    const login = await request(app)
      .post(`${USER}/login`)
      .send({ email: target.email, password: target.password });
    expect(login.status).toBe(200);
    expect(login.body.code).toBe(RC.LOGIN_SUCCESS.code);
  });
});

// =====================================================================
describe(`DELETE ${ADMIN_USER}/:id — xoá tài khoản`, () => {
  it('00401 khi admin tự xoá chính mình', async () => {
    const admin = await createLoggedInUser({ admin: true });
    const res = await request(app)
      .delete(`${ADMIN_USER}/${admin.user.id}`)
      .set(auth(admin.token));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.ADMIN_USER_CANNOT_DELETE_SELF.code);
    expect(await User.findById(admin.user.id)).not.toBeNull();
  });

  it('00391 xoá thành công, token cũ không dùng được nữa', async () => {
    const admin = await createLoggedInUser({ admin: true });
    const target = await createLoggedInUser({ name: 'Nguoi Bi Xoa' });

    const res = await request(app)
      .delete(`${ADMIN_USER}/${target.user.id}`)
      .set(auth(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.ADMIN_USER_DELETE_SUCCESS.code);
    expect(await User.findById(target.user.id)).toBeNull();

    const again = await request(app).get(USER).set(auth(target.token));
    expect(again.status).toBe(404);
    expect(again.body.code).toBe(RC.USER_NOT_FOUND.code);
  });

  it('00391 xoá trưởng nhóm thì chuyển quyền cho thành viên còn lại', async () => {
    const admin = await createLoggedInUser({ admin: true });
    const leader = await createLoggedInUser({ name: 'Truong Nhom' });
    const member = await createLoggedInUser({ name: 'Thanh Vien' });

    await User.updateOne({ _id: member.user.id }, { $set: { username: 'thanhvien01' } });

    await request(app)
      .post(`${USER}/group`)
      .set(auth(leader.token))
      .send({ groupName: 'Gia Dinh B' });
    await request(app)
      .post(`${USER}/group/add`)
      .set(auth(leader.token))
      .send({ username: 'thanhvien01' });

    const res = await request(app)
      .delete(`${ADMIN_USER}/${leader.user.id}`)
      .set(auth(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.ADMIN_USER_DELETE_SUCCESS.code);

    const group = await Group.findOne({ name: 'Gia Dinh B' });
    expect(group).not.toBeNull();
    expect(group.adminId.toString()).toBe(member.user.id);
    expect(group.members.map((id) => id.toString())).toEqual([member.user.id]);
  });

  it('00392 khi không tìm thấy người dùng', async () => {
    const admin = await createLoggedInUser({ admin: true });
    const ghostId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .delete(`${ADMIN_USER}/${ghostId}`)
      .set(auth(admin.token));

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.ADMIN_USER_NOT_FOUND.code);
  });
});
