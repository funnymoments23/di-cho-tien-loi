const request = require('supertest');
const mongoose = require('mongoose');
const os = require('os');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Không gửi email thật: dùng mock như các test Auth/Tài khoản/Nhóm/Thực phẩm/Tủ lạnh.
jest.mock('../src/utils/email', () => ({
  sendVerificationCode: jest.fn(async () => ({ delivered: false, devCode: null })),
}));

const app = require('../src/app');
const User = require('../src/models/user.models');
const Group = require('../src/models/group.models');
const Category = require('../src/models/category.models');
const Unit = require('../src/models/unit.models');
const Food = require('../src/models/food.models');
const ShoppingList = require('../src/models/shoppingList.models');
const Task = require('../src/models/task.models');
const emailUtil = require('../src/utils/email');
const RC = require('../src/constants/responseCode');

const USER = '/it4788/user';
const GROUP = `${USER}/group`;
const FOOD = '/it4788/food';
const SHOPPING = '/it4788/shopping';

let mongod;
let counter = 0;
const nextEmail = () => `shopping${++counter}@example.com`;

const codeFor = (email) => {
  const calls = emailUtil.sendVerificationCode.mock.calls.filter(
    ([to]) => to === email.toLowerCase()
  );
  return calls.length ? calls[calls.length - 1][1] : undefined;
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

/** Đăng ký + xác minh + đăng nhập. */
const createLoggedInUser = async ({ username, name = 'Nguyen Van A' } = {}) => {
  const payload = { email: nextEmail(), password: 'matkhau123', name };

  const registerRes = await request(app).post(USER).send(payload);
  await request(app)
    .post(`${USER}/verify-email`)
    .send({ code: codeFor(payload.email), token: registerRes.body.data.verificationToken });

  const loginRes = await request(app)
    .post(`${USER}/login`)
    .send({ email: payload.email, password: payload.password });

  const token = loginRes.body.data.accessToken;
  if (username) await request(app).put(USER).set(auth(token)).send({ username });

  return { user: loginRes.body.data.user, token, username };
};

/** Nhóm có trưởng nhóm + 1 thành viên; thêm 1 người ngoài nhóm. */
const createGroupFixture = async () => {
  const groupAdmin = await createLoggedInUser({ username: `sadmin${++counter}` });
  const member = await createLoggedInUser({ username: `smem${++counter}` });
  const outsider = await createLoggedInUser({ username: `sout${++counter}` });

  await request(app)
    .post(GROUP)
    .set(auth(groupAdmin.token))
    .send({ groupName: 'Gia dinh A' });

  await request(app)
    .post(`${GROUP}/add`)
    .set(auth(groupAdmin.token))
    .send({ username: member.username });

  return { groupAdmin, member, outsider };
};

/** Nhóm thứ hai (để test dữ liệu chéo nhóm). */
const createOtherGroup = async () => {
  const otherAdmin = await createLoggedInUser({ username: `sother${++counter}` });
  await request(app)
    .post(GROUP)
    .set(auth(otherAdmin.token))
    .send({ groupName: 'Gia dinh B' });
  return otherAdmin;
};

const createFoodRequest = (token, overrides = {}) =>
  request(app)
    .post(FOOD)
    .set(auth(token))
    .send({ foodName: 'Thịt bò', categoryName: 'Thịt', unitName: 'kg', ...overrides });

const createListRequest = (token, overrides = {}) =>
  request(app)
    .post(SHOPPING)
    .set(auth(token))
    .send({
      name: 'Đi chợ thứ Bảy',
      assignToUsername: ctx.member.username,
      note: 'mua ở chợ đầu mối',
      date: '2026-11-07',
      ...overrides,
    });

const createList = async (token, overrides = {}) => {
  const res = await createListRequest(token, overrides);
  return res.body.data;
};

const updateListRequest = (token, body) =>
  request(app).put(SHOPPING).set(auth(token)).send(body);

const deleteListRequest = (token, body) =>
  request(app).delete(SHOPPING).set(auth(token)).send(body);

const addTasksRequest = (token, listId, tasks) =>
  request(app).post(`${SHOPPING}/task`).set(auth(token)).send({ listId, tasks });

const getTasksRequest = (token, path = `${SHOPPING}/task`) =>
  request(app).get(path).set(auth(token));

const updateTaskRequest = (token, body) =>
  request(app).put(`${SHOPPING}/task`).set(auth(token)).send(body);

const deleteTaskRequest = (token, body) =>
  request(app).delete(`${SHOPPING}/task`).set(auth(token)).send(body);

const completeTaskRequest = (token, taskId, body = { isCompleted: true }) =>
  request(app)
    .patch(`${SHOPPING}/task/${taskId}/complete`)
    .set(auth(token))
    .send(body);

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  // Workaround: mongoose >= 9.10 + Jest 30 chặn dynamic import của driver.
  await mongoose.connect(mongod.getUri(), { runtimeAdapters: { os } });
  await User.init();
  await Group.init();
  await Category.init();
  await Unit.init();
  await Food.init();
  await ShoppingList.init();
  await Task.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

let ctx;

beforeEach(async () => {
  await User.deleteMany({});
  await Group.deleteMany({});
  await Category.deleteMany({});
  await Unit.deleteMany({});
  await Food.deleteMany({});
  await ShoppingList.deleteMany({});
  await Task.deleteMany({});

  await Category.create([{ name: 'Thịt' }, { name: 'Rau củ' }]);
  await Unit.create([{ name: 'kg' }, { name: 'gram' }]);

  ctx = await createGroupFixture();
  await createFoodRequest(ctx.member.token, { foodName: 'Thịt bò' });
  await createFoodRequest(ctx.member.token, {
    foodName: 'Cà rốt',
    categoryName: 'Rau củ',
    unitName: 'gram',
  });
});

// =====================================================================
describe(`POST ${SHOPPING} — tạo danh sách đi chợ`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).post(SHOPPING).send({ name: 'Đi chợ' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00239 khi thiếu name', async () => {
    const res = await request(app)
      .post(SHOPPING)
      .set(auth(ctx.groupAdmin.token))
      .send({ assignToUsername: ctx.member.username });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.SHOPPING_CREATE_MISSING_NAME.code);
  });

  it('00240 khi thiếu assignToUsername', async () => {
    const res = await request(app)
      .post(SHOPPING)
      .set(auth(ctx.groupAdmin.token))
      .send({ name: 'Đi chợ' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.SHOPPING_CREATE_MISSING_ASSIGNEE.code);
  });

  it('00241 khi note quá 500 ký tự', async () => {
    const res = await createListRequest(ctx.groupAdmin.token, { note: 'a'.repeat(501) });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.SHOPPING_CREATE_INVALID_NOTE.code);
  });

  it('00242 khi date không hợp lệ', async () => {
    const res = await createListRequest(ctx.groupAdmin.token, { date: 'không phải ngày' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.SHOPPING_CREATE_INVALID_DATE.code);
  });

  it('00243 khi người dùng chưa vào nhóm', async () => {
    const res = await createListRequest(ctx.outsider.token);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.SHOPPING_CREATE_UNAUTHORIZED.code);
  });

  it('00243 khi thành viên không phải trưởng nhóm', async () => {
    const res = await createListRequest(ctx.member.token);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.SHOPPING_CREATE_UNAUTHORIZED.code);
  });

  it('00245 khi username được giao không tồn tại', async () => {
    const res = await createListRequest(ctx.groupAdmin.token, {
      assignToUsername: 'khongtontai',
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.SHOPPING_CREATE_ASSIGNEE_NOT_FOUND.code);
  });

  it('00246 khi người được giao thuộc nhóm khác', async () => {
    const otherAdmin = await createOtherGroup();
    const res = await createListRequest(ctx.groupAdmin.token, {
      assignToUsername: otherAdmin.username,
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.SHOPPING_CREATE_CANNOT_ASSIGN.code);
  });

  it('00249 tạo thành công: lưu tên, người được giao, ghi chú, ngày', async () => {
    const res = await createListRequest(ctx.groupAdmin.token);

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(RC.SHOPPING_CREATE_SUCCESS.code);
    expect(res.body.data).toMatchObject({
      name: 'Đi chợ thứ Bảy',
      assignedToName: 'Nguyen Van A',
      assignedToUsername: ctx.member.username,
      note: 'mua ở chợ đầu mối',
      date: '2026-11-07T00:00:00.000Z',
    });
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.assignedTo).toBe(ctx.member.user.id);

    const saved = await ShoppingList.findById(res.body.data.id);
    expect(saved.groupId.toString()).toBe(
      (await User.findById(ctx.groupAdmin.user.id).select('groupId')).groupId.toString()
    );
    expect(saved.createdBy.toString()).toBe(ctx.groupAdmin.user.id);
  });

  it('00249 trim tên và ghi chú', async () => {
    const res = await createListRequest(ctx.groupAdmin.token, {
      name: '  Đi chợ Chủ nhật  ',
      note: '  ghé siêu thị  ',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Đi chợ Chủ nhật');
    expect(res.body.data.note).toBe('ghé siêu thị');
  });

  it('00249 cho phép bỏ trống ghi chú và ngày', async () => {
    const res = await createListRequest(ctx.groupAdmin.token, { note: '', date: undefined });

    expect(res.status).toBe(201);
    expect(res.body.data.note).toBeNull();
    expect(res.body.data.date).toBeNull();
  });

  it('00249 hai nhóm khác nhau tạo danh sách riêng', async () => {
    await createList(ctx.groupAdmin.token);

    const otherAdmin = await createOtherGroup();
    const res = await createListRequest(otherAdmin.token, {
      assignToUsername: otherAdmin.username,
    });

    expect(res.status).toBe(201);
    expect(await ShoppingList.countDocuments({})).toBe(2);
  });
});

// =====================================================================
describe(`PUT ${SHOPPING} — sửa danh sách đi chợ`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).put(SHOPPING).send({ listId: 'a'.repeat(24) });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00251 khi thiếu listId', async () => {
    const res = await updateListRequest(ctx.groupAdmin.token, { newName: 'Đi chợ mới' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.SHOPPING_UPDATE_MISSING_LIST_ID.code);
  });

  it('00252 khi không có trường nào được cập nhật', async () => {
    const list = await createList(ctx.groupAdmin.token);
    const res = await updateListRequest(ctx.groupAdmin.token, { listId: list.id });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.SHOPPING_UPDATE_NEED_ONE_FIELD.code);
  });

  it('00253 khi newName rỗng', async () => {
    const list = await createList(ctx.groupAdmin.token);
    const res = await updateListRequest(ctx.groupAdmin.token, {
      listId: list.id,
      newName: '   ',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.SHOPPING_UPDATE_INVALID_NAME.code);
  });

  it('00254 khi newAssignToUsername rỗng', async () => {
    const list = await createList(ctx.groupAdmin.token);
    const res = await updateListRequest(ctx.groupAdmin.token, {
      listId: list.id,
      newAssignToUsername: '',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.SHOPPING_UPDATE_INVALID_ASSIGNEE.code);
  });

  it('00255 khi newNote quá 500 ký tự', async () => {
    const list = await createList(ctx.groupAdmin.token);
    const res = await updateListRequest(ctx.groupAdmin.token, {
      listId: list.id,
      newNote: 'a'.repeat(501),
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.SHOPPING_UPDATE_INVALID_NOTE.code);
  });

  it('00256 khi newDate không hợp lệ', async () => {
    const list = await createList(ctx.groupAdmin.token);
    const res = await updateListRequest(ctx.groupAdmin.token, {
      listId: list.id,
      newDate: 'ngày sai',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.SHOPPING_UPDATE_INVALID_DATE.code);
  });

  it('00258 khi thành viên không phải trưởng nhóm', async () => {
    const list = await createList(ctx.groupAdmin.token);
    const res = await updateListRequest(ctx.member.token, {
      listId: list.id,
      newName: 'Đổi tên',
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.SHOPPING_UPDATE_NOT_GROUP_ADMIN.code);
  });

  it('00258 khi người dùng chưa vào nhóm', async () => {
    const list = await createList(ctx.groupAdmin.token);
    const res = await updateListRequest(ctx.outsider.token, {
      listId: list.id,
      newName: 'Đổi tên',
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.SHOPPING_UPDATE_NOT_GROUP_ADMIN.code);
  });

  it('00260 khi danh sách không tồn tại', async () => {
    const res = await updateListRequest(ctx.groupAdmin.token, {
      listId: new mongoose.Types.ObjectId().toString(),
      newName: 'Đổi tên',
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.SHOPPING_UPDATE_LIST_NOT_FOUND.code);
  });

  it('00261 khi danh sách thuộc nhóm khác', async () => {
    const otherAdmin = await createOtherGroup();
    const otherList = await createList(otherAdmin.token, {
      assignToUsername: otherAdmin.username,
    });

    const res = await updateListRequest(ctx.groupAdmin.token, {
      listId: otherList.id,
      newName: 'Đổi tên',
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.SHOPPING_UPDATE_NOT_LIST_ADMIN.code);
  });

  it('00262 khi người được giao mới không tồn tại', async () => {
    const list = await createList(ctx.groupAdmin.token);
    const res = await updateListRequest(ctx.groupAdmin.token, {
      listId: list.id,
      newAssignToUsername: 'khongtontai',
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.SHOPPING_UPDATE_USER_NOT_FOUND.code);
  });

  it('00263 khi giao cho người thuộc nhóm khác', async () => {
    const list = await createList(ctx.groupAdmin.token);
    const otherAdmin = await createOtherGroup();

    const res = await updateListRequest(ctx.groupAdmin.token, {
      listId: list.id,
      newAssignToUsername: otherAdmin.username,
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.SHOPPING_UPDATE_CANNOT_ASSIGN.code);
  });

  it('00266 sửa được tên, người được giao, ghi chú và ngày', async () => {
    const list = await createList(ctx.groupAdmin.token);
    const res = await updateListRequest(ctx.groupAdmin.token, {
      listId: list.id,
      newName: 'Đi chợ Chủ nhật',
      newAssignToUsername: ctx.groupAdmin.username,
      newNote: 'đổi ghi chú',
      newDate: '2026-12-01',
    });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.SHOPPING_UPDATE_SUCCESS.code);
    expect(res.body.data).toMatchObject({
      name: 'Đi chợ Chủ nhật',
      assignedToUsername: ctx.groupAdmin.username,
      note: 'đổi ghi chú',
      date: '2026-12-01T00:00:00.000Z',
    });
  });

  it('00266 gửi newNote rỗng để xoá ghi chú, newDate null để bỏ ngày', async () => {
    const list = await createList(ctx.groupAdmin.token);
    const res = await updateListRequest(ctx.groupAdmin.token, {
      listId: list.id,
      newNote: '',
      newDate: null,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.note).toBeNull();
    expect(res.body.data.date).toBeNull();
  });
});

// =====================================================================
describe(`DELETE ${SHOPPING} — xoá danh sách đi chợ`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).delete(SHOPPING).send({ listId: 'a'.repeat(24) });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00268 khi thiếu listId', async () => {
    const res = await deleteListRequest(ctx.groupAdmin.token, {});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.SHOPPING_DELETE_MISSING_LIST_ID.code);
  });

  it('00270 khi thành viên không phải trưởng nhóm', async () => {
    const list = await createList(ctx.groupAdmin.token);
    const res = await deleteListRequest(ctx.member.token, { listId: list.id });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.SHOPPING_DELETE_NOT_GROUP_ADMIN.code);
  });

  it('00270 khi người dùng chưa vào nhóm', async () => {
    const list = await createList(ctx.groupAdmin.token);
    const res = await deleteListRequest(ctx.outsider.token, { listId: list.id });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.SHOPPING_DELETE_NOT_GROUP_ADMIN.code);
  });

  it('00272 khi danh sách không tồn tại', async () => {
    const res = await deleteListRequest(ctx.groupAdmin.token, {
      listId: new mongoose.Types.ObjectId().toString(),
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.SHOPPING_DELETE_LIST_NOT_FOUND.code);
  });

  it('00273 khi danh sách thuộc nhóm khác', async () => {
    const otherAdmin = await createOtherGroup();
    const otherList = await createList(otherAdmin.token, {
      assignToUsername: otherAdmin.username,
    });

    const res = await deleteListRequest(ctx.groupAdmin.token, { listId: otherList.id });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.SHOPPING_DELETE_NOT_LIST_ADMIN.code);
  });

  it('00275 xoá thành công và xoá luôn các món bên trong', async () => {
    const list = await createList(ctx.groupAdmin.token);
    await addTasksRequest(ctx.groupAdmin.token, list.id, [
      { foodName: 'Thịt bò', quantity: 2 },
    ]);

    const res = await deleteListRequest(ctx.groupAdmin.token, { listId: list.id });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.SHOPPING_DELETE_SUCCESS.code);
    expect(res.body.data.name).toBe('Đi chợ thứ Bảy');
    expect(res.body.data.taskCount).toBe(1);
    expect(await ShoppingList.countDocuments({})).toBe(0);
    expect(await Task.countDocuments({})).toBe(0);
  });
});

// =====================================================================
describe(`POST ${SHOPPING}/task — thêm món vào danh sách`, () => {
  let list;

  beforeEach(async () => {
    list = await createList(ctx.groupAdmin.token);
  });

  it('00006 khi không có token', async () => {
    const res = await request(app).post(`${SHOPPING}/task`).send({ listId: list.id });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00277 khi thiếu listId', async () => {
    const res = await request(app)
      .post(`${SHOPPING}/task`)
      .set(auth(ctx.groupAdmin.token))
      .send({ tasks: [{ foodName: 'Thịt bò', quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.TASK_CREATE_MISSING_LIST_ID.code);
  });

  it('00278 khi thiếu mảng tasks', async () => {
    const res = await request(app)
      .post(`${SHOPPING}/task`)
      .set(auth(ctx.groupAdmin.token))
      .send({ listId: list.id });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.TASK_CREATE_MISSING_TASKS.code);
  });

  it('00279 khi mảng tasks rỗng', async () => {
    const res = await addTasksRequest(ctx.groupAdmin.token, list.id, []);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.TASK_CREATE_INVALID_TASKS.code);
  });

  it('00279 khi một món thiếu foodName', async () => {
    const res = await addTasksRequest(ctx.groupAdmin.token, list.id, [{ quantity: 1 }]);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.TASK_CREATE_INVALID_TASKS.code);
  });

  it('00279 khi quantity không hợp lệ', async () => {
    const res = await addTasksRequest(ctx.groupAdmin.token, list.id, [
      { foodName: 'Thịt bò', quantity: 0 },
    ]);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.TASK_CREATE_INVALID_TASKS.code);
  });

  it('00281 khi thành viên không phải trưởng nhóm', async () => {
    const res = await addTasksRequest(ctx.member.token, list.id, [
      { foodName: 'Thịt bò', quantity: 1 },
    ]);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.TASK_CREATE_NOT_GROUP_ADMIN.code);
  });

  it('00283 khi danh sách không tồn tại', async () => {
    const res = await addTasksRequest(
      ctx.groupAdmin.token,
      new mongoose.Types.ObjectId().toString(),
      [{ foodName: 'Thịt bò', quantity: 1 }]
    );
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.TASK_CREATE_LIST_NOT_FOUND.code);
  });

  it('00284 khi danh sách thuộc nhóm khác', async () => {
    const otherAdmin = await createOtherGroup();
    const otherList = await createList(otherAdmin.token, {
      assignToUsername: otherAdmin.username,
    });

    const res = await addTasksRequest(ctx.groupAdmin.token, otherList.id, [
      { foodName: 'Thịt bò', quantity: 1 },
    ]);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.TASK_CREATE_NOT_LIST_ADMIN.code);
  });

  it('00285 khi thực phẩm không tồn tại trong nhóm', async () => {
    const res = await addTasksRequest(ctx.groupAdmin.token, list.id, [
      { foodName: 'Cá hồi', quantity: 1 },
    ]);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.TASK_CREATE_FOOD_NOT_FOUND.code);
  });

  it('00285x khi cùng một thực phẩm lặp trong mảng gửi lên', async () => {
    const res = await addTasksRequest(ctx.groupAdmin.token, list.id, [
      { foodName: 'Thịt bò', quantity: 1 },
      { foodName: 'Thịt bò', quantity: 2 },
    ]);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe(RC.TASK_CREATE_FOOD_ALREADY_IN_LIST.code);
    expect(await Task.countDocuments({})).toBe(0);
  });

  it('00285x khi thực phẩm đã có trong danh sách', async () => {
    await addTasksRequest(ctx.groupAdmin.token, list.id, [
      { foodName: 'Thịt bò', quantity: 1 },
    ]);
    const res = await addTasksRequest(ctx.groupAdmin.token, list.id, [
      { foodName: 'Thịt bò', quantity: 3 },
    ]);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe(RC.TASK_CREATE_FOOD_ALREADY_IN_LIST.code);
    expect(await Task.countDocuments({})).toBe(1);
  });

  it('00287 thêm thành công nhiều món, trả kèm tên và đơn vị', async () => {
    const res = await addTasksRequest(ctx.groupAdmin.token, list.id, [
      { foodName: 'Thịt bò', quantity: 2 },
      { foodName: 'Cà rốt', quantity: '3' },
    ]);

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(RC.TASK_CREATE_SUCCESS.code);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({
      foodName: 'Thịt bò',
      unitName: 'kg',
      quantity: 2,
      isCompleted: false,
    });
    expect(res.body.data[1]).toMatchObject({
      foodName: 'Cà rốt',
      unitName: 'gram',
      quantity: 3,
    });
    expect(await Task.countDocuments({ listId: list.id })).toBe(2);
  });
});

// =====================================================================
describe(`GET ${SHOPPING}/task — danh sách đi chợ kèm món`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).get(`${SHOPPING}/task`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00288 khi người dùng chưa vào nhóm', async () => {
    const res = await getTasksRequest(ctx.outsider.token);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.TASK_GET_NOT_IN_GROUP.code);
  });

  it('00292 trả mảng rỗng khi nhóm chưa có danh sách', async () => {
    const res = await getTasksRequest(ctx.member.token);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.TASK_GET_SUCCESS.code);
    expect(res.body.data).toEqual([]);
  });

  it('00292 trả danh sách kèm món, sắp xếp theo ngày đi chợ', async () => {
    const later = await createList(ctx.groupAdmin.token, { name: 'Đi chợ xa', date: '2026-12-01' });
    const sooner = await createList(ctx.groupAdmin.token, {
      name: 'Đi chợ gần',
      date: '2026-11-05',
    });

    await addTasksRequest(ctx.groupAdmin.token, later.id, [
      { foodName: 'Thịt bò', quantity: 2 },
    ]);
    await addTasksRequest(ctx.groupAdmin.token, sooner.id, [
      { foodName: 'Cà rốt', quantity: 1 },
      { foodName: 'Thịt bò', quantity: 3 },
    ]);

    const res = await getTasksRequest(ctx.member.token);

    expect(res.status).toBe(200);
    expect(res.body.data.map((list) => list.name)).toEqual(['Đi chợ gần', 'Đi chợ xa']);
    expect(res.body.data[0].taskCount).toBe(2);
    expect(res.body.data[0].completedCount).toBe(0);
    expect(res.body.data[0].tasks.map((task) => task.foodName)).toEqual([
      'Cà rốt',
      'Thịt bò',
    ]);
  });

  it('00292 chỉ trả danh sách của nhóm mình', async () => {
    await createList(ctx.groupAdmin.token);

    const otherAdmin = await createOtherGroup();
    await createList(otherAdmin.token, { assignToUsername: otherAdmin.username });

    const res = await getTasksRequest(ctx.member.token);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Đi chợ thứ Bảy');
  });

  it('00292 GET /shopping trả cùng dữ liệu (API bổ sung)', async () => {
    await createList(ctx.groupAdmin.token);

    const res = await getTasksRequest(ctx.member.token, SHOPPING);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.TASK_GET_SUCCESS.code);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].tasks).toEqual([]);
  });
});

// =====================================================================
describe(`DELETE ${SHOPPING}/task — xoá một món`, () => {
  let list;
  let task;

  beforeEach(async () => {
    list = await createList(ctx.groupAdmin.token);
    const res = await addTasksRequest(ctx.groupAdmin.token, list.id, [
      { foodName: 'Thịt bò', quantity: 2 },
    ]);
    task = res.body.data[0];
  });

  it('00006 khi không có token', async () => {
    const res = await request(app).delete(`${SHOPPING}/task`).send({ taskId: task.id });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00294 khi thiếu taskId', async () => {
    const res = await deleteTaskRequest(ctx.groupAdmin.token, {});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.TASK_DELETE_MISSING_TASK_ID.code);
  });

  it('00297 khi thành viên không phải trưởng nhóm', async () => {
    const res = await deleteTaskRequest(ctx.member.token, { taskId: task.id });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.TASK_DELETE_NOT_GROUP_ADMIN.code);
  });

  it('00296 khi nhiệm vụ không tồn tại', async () => {
    const res = await deleteTaskRequest(ctx.groupAdmin.token, {
      taskId: new mongoose.Types.ObjectId().toString(),
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.TASK_DELETE_NOT_FOUND.code);
  });

  it('00296 khi nhiệm vụ thuộc nhóm khác', async () => {
    const otherAdmin = await createOtherGroup();
    await createFoodRequest(otherAdmin.token, { foodName: 'Thịt bò' });
    const otherList = await createList(otherAdmin.token, {
      assignToUsername: otherAdmin.username,
    });
    const otherTasks = await addTasksRequest(otherAdmin.token, otherList.id, [
      { foodName: 'Thịt bò', quantity: 1 },
    ]);

    const res = await deleteTaskRequest(ctx.groupAdmin.token, {
      taskId: otherTasks.body.data[0].id,
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.TASK_DELETE_NOT_FOUND.code);
  });

  it('00299 xoá thành công', async () => {
    const res = await deleteTaskRequest(ctx.groupAdmin.token, { taskId: task.id });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.TASK_DELETE_SUCCESS.code);
    expect(res.body.data.foodName).toBe('Thịt bò');
    expect(await Task.countDocuments({})).toBe(0);
  });
});

// =====================================================================
describe(`PUT ${SHOPPING}/task — sửa một món`, () => {
  let list;
  let task;

  beforeEach(async () => {
    list = await createList(ctx.groupAdmin.token);
    const res = await addTasksRequest(ctx.groupAdmin.token, list.id, [
      { foodName: 'Thịt bò', quantity: 2 },
    ]);
    task = res.body.data[0];
  });

  it('00006 khi không có token', async () => {
    const res = await request(app)
      .put(`${SHOPPING}/task`)
      .send({ taskId: task.id, newQuantity: 3 });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00301 khi thiếu taskId', async () => {
    const res = await updateTaskRequest(ctx.groupAdmin.token, { newQuantity: 3 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.TASK_UPDATE_MISSING_TASK_ID.code);
  });

  it('00302 khi không có trường nào được cập nhật', async () => {
    const res = await updateTaskRequest(ctx.groupAdmin.token, { taskId: task.id });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.TASK_UPDATE_NEED_ONE_FIELD.code);
  });

  it('00303 khi newFoodName rỗng', async () => {
    const res = await updateTaskRequest(ctx.groupAdmin.token, {
      taskId: task.id,
      newFoodName: '   ',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.TASK_UPDATE_INVALID_FOOD_NAME.code);
  });

  it('00304 khi newQuantity không hợp lệ', async () => {
    const res = await updateTaskRequest(ctx.groupAdmin.token, {
      taskId: task.id,
      newQuantity: -1,
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.TASK_UPDATE_INVALID_QUANTITY.code);
  });

  it('00307 khi thành viên không phải trưởng nhóm', async () => {
    const res = await updateTaskRequest(ctx.member.token, {
      taskId: task.id,
      newQuantity: 3,
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.TASK_UPDATE_NOT_GROUP_ADMIN.code);
  });

  it('00306 khi nhiệm vụ không tồn tại', async () => {
    const res = await updateTaskRequest(ctx.groupAdmin.token, {
      taskId: new mongoose.Types.ObjectId().toString(),
      newQuantity: 3,
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.TASK_UPDATE_NOT_FOUND.code);
  });

  it('00308 khi tên thực phẩm mới không tồn tại', async () => {
    const res = await updateTaskRequest(ctx.groupAdmin.token, {
      taskId: task.id,
      newFoodName: 'Cá hồi',
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.TASK_UPDATE_FOOD_NOT_FOUND.code);
  });

  it('00309 khi thực phẩm mới đã có trong cùng danh sách', async () => {
    await addTasksRequest(ctx.groupAdmin.token, list.id, [
      { foodName: 'Cà rốt', quantity: 1 },
    ]);

    const res = await updateTaskRequest(ctx.groupAdmin.token, {
      taskId: task.id,
      newFoodName: 'Cà rốt',
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe(RC.TASK_UPDATE_FOOD_ALREADY_IN_LIST.code);
  });

  it('00312 sửa được tên và số lượng', async () => {
    const res = await updateTaskRequest(ctx.groupAdmin.token, {
      taskId: task.id,
      newFoodName: 'Cà rốt',
      newQuantity: 5,
    });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.TASK_UPDATE_SUCCESS.code);
    expect(res.body.data).toMatchObject({
      foodName: 'Cà rốt',
      unitName: 'gram',
      quantity: 5,
    });
  });

  it('00312 chỉ sửa số lượng', async () => {
    const res = await updateTaskRequest(ctx.groupAdmin.token, {
      taskId: task.id,
      newQuantity: 7,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.foodName).toBe('Thịt bò');
    expect(res.body.data.quantity).toBe(7);
  });
});

// =====================================================================
describe('Dọn dữ liệu liên quan', () => {
  it('xoá thực phẩm cũng xoá món tham chiếu trong danh sách đi chợ', async () => {
    const list = await createList(ctx.groupAdmin.token);
    await addTasksRequest(ctx.groupAdmin.token, list.id, [
      { foodName: 'Thịt bò', quantity: 2 },
    ]);

    const res = await request(app)
      .delete(FOOD)
      .set(auth(ctx.member.token))
      .send({ foodName: 'Thịt bò' });

    expect(res.status).toBe(200);
    expect(await Task.countDocuments({})).toBe(0);
    expect(await ShoppingList.countDocuments({})).toBe(1);
  });

  it('người cuối cùng rời nhóm thì danh sách và món của nhóm bị xoá', async () => {
    const list = await createList(ctx.groupAdmin.token);
    await addTasksRequest(ctx.groupAdmin.token, list.id, [
      { foodName: 'Thịt bò', quantity: 2 },
    ]);

    await request(app).post(`${GROUP}/leave`).set(auth(ctx.member.token));
    const res = await request(app).post(`${GROUP}/leave`).set(auth(ctx.groupAdmin.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.GROUP_LEAVE_SUCCESS.code);
    expect(await ShoppingList.countDocuments({})).toBe(0);
    expect(await Task.countDocuments({})).toBe(0);
  });
});

// =====================================================================
describe(`PATCH ${SHOPPING}/task/:taskId/complete — đánh dấu đã mua (bổ sung)`, () => {
  let list;
  let task;

  beforeEach(async () => {
    list = await createList(ctx.groupAdmin.token);
    const res = await addTasksRequest(ctx.groupAdmin.token, list.id, [
      { foodName: 'Thịt bò', quantity: 2 },
    ]);
    task = res.body.data[0];
  });

  it('00006 khi không có token', async () => {
    const res = await request(app)
      .patch(`${SHOPPING}/task/${task.id}/complete`)
      .send({ isCompleted: true });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00300 khi thiếu isCompleted', async () => {
    const res = await completeTaskRequest(ctx.member.token, task.id, {});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.TASK_UPDATE_MISSING_FIELDS.code);
  });

  it('00300 khi isCompleted không phải boolean', async () => {
    const res = await completeTaskRequest(ctx.member.token, task.id, { isCompleted: 'yes' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.TASK_UPDATE_MISSING_FIELDS.code);
  });

  it('00288 khi người dùng chưa vào nhóm', async () => {
    const res = await completeTaskRequest(ctx.outsider.token, task.id);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.TASK_GET_NOT_IN_GROUP.code);
  });

  it('00306 khi nhiệm vụ không tồn tại', async () => {
    const res = await completeTaskRequest(
      ctx.member.token,
      new mongoose.Types.ObjectId().toString()
    );
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.TASK_UPDATE_NOT_FOUND.code);
  });

  it('00312 thành viên (không phải trưởng nhóm) tick được đã mua', async () => {
    const res = await completeTaskRequest(ctx.member.token, task.id);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.TASK_UPDATE_SUCCESS.code);
    expect(res.body.data.isCompleted).toBe(true);
    expect((await Task.findById(task.id)).isCompleted).toBe(true);
  });

  it('00312 bỏ tick để mua lại', async () => {
    await completeTaskRequest(ctx.member.token, task.id, { isCompleted: true });
    const res = await completeTaskRequest(ctx.member.token, task.id, {
      isCompleted: false,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.isCompleted).toBe(false);
  });

  it('00292 completedCount phản ánh số món đã mua', async () => {
    await completeTaskRequest(ctx.member.token, task.id);
    const res = await getTasksRequest(ctx.member.token);

    expect(res.body.data[0].taskCount).toBe(1);
    expect(res.body.data[0].completedCount).toBe(1);
  });
});
