const request = require('supertest');
const mongoose = require('mongoose');
const os = require('os');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Không gửi email thật: dùng mock như các test Auth/Tài khoản.
jest.mock('../src/utils/email', () => ({
  sendVerificationCode: jest.fn(async () => ({ delivered: false, devCode: null })),
}));

const app = require('../src/app');
const User = require('../src/models/user.models');
const Group = require('../src/models/group.models');
const emailUtil = require('../src/utils/email');
const RC = require('../src/constants/responseCode');

const BASE = '/it4788/user';
const GROUP = `${BASE}/group`;

let mongod;
let counter = 0;
const nextEmail = () => `group${++counter}@example.com`;

const codeFor = (email) => {
  const calls = emailUtil.sendVerificationCode.mock.calls.filter(
    ([to]) => to === email.toLowerCase()
  );
  return calls.length ? calls[calls.length - 1][1] : undefined;
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

/**
 * Đăng ký + xác minh + đăng nhập; nếu truyền `username` thì gọi PUT /user
 * để đặt username (registerSchema không nhận username).
 */
const createLoggedInUser = async ({ username, name = 'Nguyen Van A' } = {}) => {
  const payload = { email: nextEmail(), password: 'matkhau123', name };

  const registerRes = await request(app).post(BASE).send(payload);
  await request(app)
    .post(`${BASE}/verify-email`)
    .send({ code: codeFor(payload.email), token: registerRes.body.data.verificationToken });

  const loginRes = await request(app)
    .post(`${BASE}/login`)
    .send({ email: payload.email, password: payload.password });

  const token = loginRes.body.data.accessToken;

  if (username) {
    await request(app).put(BASE).set(auth(token)).send({ username });
  }

  return { payload, user: loginRes.body.data.user, token, username };
};

const createGroup = (token, groupName = 'Gia dinh A') =>
  request(app).post(GROUP).set(auth(token)).send({ groupName });

/** Tạo nhóm rồi thêm một thành viên đã có username; trả về admin + member. */
const createGroupWithMember = async () => {
  const admin = await createLoggedInUser({ username: `admin${++counter}` });
  const member = await createLoggedInUser({ username: `mem${++counter}` });

  const groupRes = await createGroup(admin.token);
  await request(app)
    .post(`${GROUP}/add`)
    .set(auth(admin.token))
    .send({ username: member.username });

  return { admin, member, group: groupRes.body.data };
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
describe(`POST ${GROUP} — tạo nhóm`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).post(GROUP).send({ groupName: 'Gia dinh A' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00094 khi thiếu groupName', async () => {
    const { token } = await createLoggedInUser();
    const res = await request(app).post(GROUP).set(auth(token)).send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.GROUP_CREATE_MISSING_NAME.code);
  });

  it('00094 khi groupName rỗng hoặc quá dài', async () => {
    const { token } = await createLoggedInUser();

    const blank = await createGroup(token, '   ');
    expect(blank.status).toBe(400);
    expect(blank.body.code).toBe(RC.GROUP_CREATE_MISSING_NAME.code);

    const tooLong = await createGroup(token, 'a'.repeat(51));
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.code).toBe(RC.GROUP_CREATE_MISSING_NAME.code);
  });

  it('00095 tạo thành công: người tạo là trưởng nhóm và thành viên đầu tiên', async () => {
    const { token, user } = await createLoggedInUser();
    const res = await createGroup(token, '  Gia dinh A  ');

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(RC.GROUP_CREATE_SUCCESS.code);
    expect(res.body.data).toMatchObject({
      name: 'Gia dinh A',
      adminId: user.id,
      memberCount: 1,
    });

    const group = await Group.findById(res.body.data.id);
    expect(group.name).toBe('Gia dinh A');
    expect(group.adminId.toString()).toBe(user.id);
    expect(group.members.map(String)).toEqual([user.id]);

    const savedUser = await User.findById(user.id);
    expect(savedUser.groupId.toString()).toBe(group._id.toString());
  });

  it('00093 khi người dùng đã thuộc một nhóm', async () => {
    const { token } = await createLoggedInUser();
    await createGroup(token);

    const res = await createGroup(token, 'Nhom Thu Hai');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe(RC.GROUP_CREATE_ALREADY_IN_GROUP.code);
    expect(await Group.countDocuments({})).toBe(1);
  });
});

// =====================================================================
describe(`GET ${GROUP} — xem nhóm và thành viên`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).get(GROUP);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00096 khi chưa vào nhóm nào', async () => {
    const { token } = await createLoggedInUser();
    const res = await request(app).get(GROUP).set(auth(token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.GROUP_NOT_IN_GROUP.code);
  });

  it('00098 trả tên nhóm và đầy đủ thành viên, không lộ trường nội bộ', async () => {
    const { admin, member, group } = await createGroupWithMember();
    const res = await request(app).get(GROUP).set(auth(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.GROUP_GET_MEMBERS_SUCCESS.code);
    expect(res.body.data).toMatchObject({
      id: group.id,
      name: 'Gia dinh A',
      adminId: admin.user.id,
      memberCount: 2,
    });
    expect(res.body.data.members).toHaveLength(2);
    expect(res.body.data.members.map((u) => u.id).sort()).toEqual(
      [admin.user.id, member.user.id].sort()
    );

    for (const user of res.body.data.members) {
      expect(user).not.toHaveProperty('password');
      expect(user).not.toHaveProperty('refreshToken');
      expect(user).not.toHaveProperty('verificationCode');
    }
  });
});

// =====================================================================
describe(`GET ${GROUP}/info — thông tin nhóm`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).get(`${GROUP}/info`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00096 khi chưa vào nhóm nào', async () => {
    const { token } = await createLoggedInUser();
    const res = await request(app).get(`${GROUP}/info`).set(auth(token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.GROUP_NOT_IN_GROUP.code);
  });

  it('00098 trả trưởng nhóm và đánh dấu isAdmin đúng', async () => {
    const { admin, member } = await createGroupWithMember();

    const adminRes = await request(app).get(`${GROUP}/info`).set(auth(admin.token));
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.code).toBe(RC.GROUP_GET_INFO_SUCCESS.code);
    expect(adminRes.body.data).toMatchObject({
      name: 'Gia dinh A',
      memberCount: 2,
      isAdmin: true,
      admin: { id: admin.user.id, username: admin.username },
    });

    const memberRes = await request(app).get(`${GROUP}/info`).set(auth(member.token));
    expect(memberRes.status).toBe(200);
    expect(memberRes.body.data.isAdmin).toBe(false);
  });
});

// =====================================================================
describe(`POST ${GROUP}/add — thêm thành viên`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).post(`${GROUP}/add`).send({ username: 'abc' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00096 khi người gọi chưa vào nhóm nào', async () => {
    const { token } = await createLoggedInUser();
    const res = await request(app)
      .post(`${GROUP}/add`)
      .set(auth(token))
      .send({ username: 'ai_do' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.GROUP_NOT_IN_GROUP.code);
  });

  it('00100 khi thiếu username hoặc username sai định dạng', async () => {
    const { token } = await createLoggedInUser();
    await createGroup(token);

    const missing = await request(app).post(`${GROUP}/add`).set(auth(token)).send({});
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe(RC.GROUP_ADD_MEMBER_MISSING_USERNAME.code);

    const invalid = await request(app)
      .post(`${GROUP}/add`)
      .set(auth(token))
      .send({ username: 'ab' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe(RC.GROUP_ADD_MEMBER_MISSING_USERNAME.code);
  });

  it('00099 khi username không tồn tại', async () => {
    const { token } = await createLoggedInUser();
    await createGroup(token);

    const res = await request(app)
      .post(`${GROUP}/add`)
      .set(auth(token))
      .send({ username: 'khong_ton_tai' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.GROUP_ADD_MEMBER_USER_NOT_FOUND.code);
  });

  it('00099 khi người được thêm đã thuộc nhóm khác', async () => {
    const admin = await createLoggedInUser({ username: `admin${++counter}` });
    const other = await createLoggedInUser({ username: `other${++counter}` });

    await createGroup(admin.token);
    await createGroup(other.token);

    const res = await request(app)
      .post(`${GROUP}/add`)
      .set(auth(admin.token))
      .send({ username: other.username });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe(RC.GROUP_ADD_MEMBER_ALREADY_IN_GROUP.code);
  });

  it('00101 khi thành viên (không phải trưởng nhóm) thêm người khác', async () => {
    const { member } = await createGroupWithMember();
    const third = await createLoggedInUser({ username: `third${++counter}` });

    const res = await request(app)
      .post(`${GROUP}/add`)
      .set(auth(member.token))
      .send({ username: third.username });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.GROUP_ADD_MEMBER_NOT_ADMIN.code);
  });

  it('00102 thêm thành công: gán groupId và cập nhật members', async () => {
    const admin = await createLoggedInUser({ username: `admin${++counter}` });
    const target = await createLoggedInUser({ username: `target${++counter}` });
    const groupRes = await createGroup(admin.token);

    const res = await request(app)
      .post(`${GROUP}/add`)
      .set(auth(admin.token))
      .send({ username: target.username });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.GROUP_ADD_MEMBER_SUCCESS.code);
    expect(res.body.data).toMatchObject({
      id: target.user.id,
      username: target.username,
      groupId: groupRes.body.data.id,
    });

    const savedTarget = await User.findById(target.user.id);
    expect(savedTarget.groupId.toString()).toBe(groupRes.body.data.id);

    const group = await Group.findById(groupRes.body.data.id);
    expect(group.members.map(String).sort()).toEqual(
      [admin.user.id, target.user.id].sort()
    );
  });
});

// =====================================================================
describe(`DELETE ${GROUP} — xoá thành viên`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).delete(GROUP).send({ username: 'abc' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00096 khi người gọi chưa vào nhóm nào', async () => {
    const { token } = await createLoggedInUser();
    const res = await request(app)
      .delete(GROUP)
      .set(auth(token))
      .send({ username: 'ai_do' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.GROUP_NOT_IN_GROUP.code);
  });

  it('00107 khi thiếu username', async () => {
    const { token } = await createLoggedInUser();
    await createGroup(token);

    const res = await request(app).delete(GROUP).set(auth(token)).send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.GROUP_DELETE_MEMBER_MISSING_USERNAME.code);
  });

  it('00104 khi thành viên (không phải trưởng nhóm) xoá người khác', async () => {
    const { member } = await createGroupWithMember();

    const res = await request(app)
      .delete(GROUP)
      .set(auth(member.token))
      .send({ username: 'ai_do' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.GROUP_DELETE_MEMBER_NOT_ADMIN.code);
  });

  it('00103 khi người cần xoá không thuộc nhóm', async () => {
    const { admin } = await createGroupWithMember();
    const outsider = await createLoggedInUser({ username: `out${++counter}` });

    const res = await request(app)
      .delete(GROUP)
      .set(auth(admin.token))
      .send({ username: outsider.username });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.GROUP_DELETE_MEMBER_NOT_IN_GROUP.code);
  });

  it('00105 khi trưởng nhóm tự xoá mình', async () => {
    const { admin } = await createGroupWithMember();

    const res = await request(app)
      .delete(GROUP)
      .set(auth(admin.token))
      .send({ username: admin.username });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.GROUP_DELETE_MEMBER_IS_ADMIN.code);
  });

  it('00106 xoá thành công: bỏ groupId và members', async () => {
    const { admin, member, group } = await createGroupWithMember();

    const res = await request(app)
      .delete(GROUP)
      .set(auth(admin.token))
      .send({ username: member.username });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.GROUP_DELETE_MEMBER_SUCCESS.code);
    expect(res.body.data.groupId).toBeNull();

    expect(await User.findById(member.user.id)).not.toBeNull();
    const savedMember = await User.findById(member.user.id);
    expect(savedMember.groupId).toBeNull();

    const savedGroup = await Group.findById(group.id);
    expect(savedGroup.members.map(String)).toEqual([admin.user.id]);
  });
});

// =====================================================================
describe(`DELETE ${BASE} — dọn quan hệ nhóm khi xoá tài khoản`, () => {
  it('trưởng nhóm xoá tài khoản thì chuyển quyền cho thành viên còn lại', async () => {
    const { admin, member, group } = await createGroupWithMember();

    const res = await request(app).delete(BASE).set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.DELETE_USER_SUCCESS.code);

    const savedGroup = await Group.findById(group.id);
    expect(savedGroup.adminId.toString()).toBe(member.user.id);
    expect(savedGroup.members.map(String)).toEqual([member.user.id]);

    // Thành viên được chuyển quyền dùng được API của trưởng nhóm.
    const third = await createLoggedInUser({ username: `third${++counter}` });
    const addRes = await request(app)
      .post(`${GROUP}/add`)
      .set(auth(member.token))
      .send({ username: third.username });
    expect(addRes.body.code).toBe(RC.GROUP_ADD_MEMBER_SUCCESS.code);
  });

  it('thành viên xoá tài khoản thì bị bỏ khỏi danh sách members', async () => {
    const { admin, member, group } = await createGroupWithMember();

    const res = await request(app).delete(BASE).set(auth(member.token));
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.DELETE_USER_SUCCESS.code);

    const savedGroup = await Group.findById(group.id);
    expect(savedGroup.members.map(String)).toEqual([admin.user.id]);

    const membersRes = await request(app).get(GROUP).set(auth(admin.token));
    expect(membersRes.body.data.memberCount).toBe(1);
  });
});

// =====================================================================
describe(`POST ${GROUP}/leave — rời nhóm`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).post(`${GROUP}/leave`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00096 khi chưa vào nhóm nào', async () => {
    const { token } = await createLoggedInUser();
    const res = await request(app).post(`${GROUP}/leave`).set(auth(token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.GROUP_NOT_IN_GROUP.code);
  });

  it('00108 thành viên rời nhóm, nhóm vẫn còn trưởng nhóm', async () => {
    const { admin, member, group } = await createGroupWithMember();

    const res = await request(app).post(`${GROUP}/leave`).set(auth(member.token));
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.GROUP_LEAVE_SUCCESS.code);
    expect(res.body.data).toMatchObject({ left: true, groupDeleted: false, newAdminId: null });

    const savedMember = await User.findById(member.user.id);
    expect(savedMember.groupId).toBeNull();

    const savedGroup = await Group.findById(group.id);
    expect(savedGroup.adminId.toString()).toBe(admin.user.id);
    expect(savedGroup.members.map(String)).toEqual([admin.user.id]);
  });

  it('00108 trưởng nhóm rời nhóm thì chuyển quyền cho thành viên còn lại', async () => {
    const { admin, member, group } = await createGroupWithMember();

    const res = await request(app).post(`${GROUP}/leave`).set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.GROUP_LEAVE_SUCCESS.code);
    expect(res.body.data).toMatchObject({
      left: true,
      groupDeleted: false,
      newAdminId: member.user.id,
    });

    const savedAdmin = await User.findById(admin.user.id);
    expect(savedAdmin.groupId).toBeNull();

    const savedGroup = await Group.findById(group.id);
    expect(savedGroup.adminId.toString()).toBe(member.user.id);
    expect(savedGroup.members.map(String)).toEqual([member.user.id]);

    // Thành viên mới là trưởng nhóm: có quyền thêm người.
    const third = await createLoggedInUser({ username: `third${++counter}` });
    const addRes = await request(app)
      .post(`${GROUP}/add`)
      .set(auth(member.token))
      .send({ username: third.username });
    expect(addRes.body.code).toBe(RC.GROUP_ADD_MEMBER_SUCCESS.code);
  });

  it('00108 người cuối cùng rời nhóm thì xoá nhóm', async () => {
    const { token, user } = await createLoggedInUser();
    const groupRes = await createGroup(token);

    const res = await request(app).post(`${GROUP}/leave`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.GROUP_LEAVE_SUCCESS.code);
    expect(res.body.data).toMatchObject({ left: true, groupDeleted: true });

    expect(await Group.findById(groupRes.body.data.id)).toBeNull();
    const savedUser = await User.findById(user.id);
    expect(savedUser.groupId).toBeNull();
  });
});
