const request = require('supertest');
const mongoose = require('mongoose');
const os = require('os');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Không gửi email thật: dùng mock như các test Auth/Tài khoản/Nhóm/Thực phẩm/Tủ lạnh/Đi chợ.
jest.mock('../src/utils/email', () => ({
  sendVerificationCode: jest.fn(async () => ({ delivered: false, devCode: null })),
}));

const app = require('../src/app');
const User = require('../src/models/user.models');
const Group = require('../src/models/group.models');
const Category = require('../src/models/category.models');
const Unit = require('../src/models/unit.models');
const Food = require('../src/models/food.models');
const FridgeItem = require('../src/models/fridgeItem.models');
const FridgeEvent = require('../src/models/fridgeEvent.models');
const ShoppingList = require('../src/models/shoppingList.models');
const Task = require('../src/models/task.models');
const emailUtil = require('../src/utils/email');
const RC = require('../src/constants/responseCode');

const USER = '/it4788/user';
const GROUP = `${USER}/group`;
const FOOD = '/it4788/food';
const FRIDGE = '/it4788/fridge';
const SHOPPING = '/it4788/shopping';
const REPORT = '/it4788/report';

let mongod;
let counter = 0;
const nextEmail = () => `report${++counter}@example.com`;

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
  const groupAdmin = await createLoggedInUser({ username: `radmin${++counter}` });
  const member = await createLoggedInUser({ username: `rmem${++counter}` });
  const outsider = await createLoggedInUser({ username: `rout${++counter}` });

  await request(app)
    .post(GROUP)
    .set(auth(groupAdmin.token))
    .send({ groupName: 'Gia dinh Report' });

  await request(app)
    .post(`${GROUP}/add`)
    .set(auth(groupAdmin.token))
    .send({ username: member.username });

  return { groupAdmin, member, outsider };
};

const createFoodRequest = (token, overrides = {}) =>
  request(app)
    .post(FOOD)
    .set(auth(token))
    .send({ foodName: 'Thịt bò', categoryName: 'Thịt', unitName: 'kg', ...overrides });

const createList = async (token, overrides = {}) => {
  const res = await request(app)
    .post(SHOPPING)
    .set(auth(token))
    .send({
      name: 'Đi chợ thứ Bảy',
      assignToUsername: ctx.member.username,
      date: '2026-11-07',
      ...overrides,
    });
  return res.body.data;
};

const addTasks = (token, listId, tasks) =>
  request(app).post(`${SHOPPING}/task`).set(auth(token)).send({ listId, tasks });

const completeTask = (token, taskId, isCompleted = true) =>
  request(app)
    .patch(`${SHOPPING}/task/${taskId}/complete`)
    .set(auth(token))
    .send({ isCompleted });

const createFridgeItem = (token, overrides = {}) =>
  request(app)
    .post(FRIDGE)
    .set(auth(token))
    .send({ foodName: 'Thịt bò', quantity: 2, useWithin: '2030-01-01', ...overrides });

const deleteFridgeItem = (token, body) =>
  request(app).delete(FRIDGE).set(auth(token)).send(body);

const getReport = (token, path, query) =>
  request(app).get(`${REPORT}${path}`).set(auth(token)).query(query ?? {});

const todayKey = () => new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  // Workaround: mongoose >= 9.10 + Jest 30 chặn dynamic import của driver.
  await mongoose.connect(mongod.getUri(), { runtimeAdapters: { os } });
  await User.init();
  await Group.init();
  await Category.init();
  await Unit.init();
  await Food.init();
  await FridgeItem.init();
  await FridgeEvent.init();
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
  await FridgeItem.deleteMany({});
  await FridgeEvent.deleteMany({});
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
  await createFoodRequest(ctx.member.token, { foodName: 'Cá hồi' });
});

// =====================================================================
describe(`GET ${REPORT}/* — xác thực và khoảng thời gian`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).get(`${REPORT}/overview`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00385 khi người dùng chưa vào nhóm', async () => {
    const res = await getReport(ctx.outsider.token, '/shopping');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.REPORT_NOT_IN_GROUP.code);
  });

  it('00386 khi from sai định dạng', async () => {
    const res = await getReport(ctx.groupAdmin.token, '/shopping', { from: '2026/01/01' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.REPORT_INVALID_DATE_RANGE.code);
  });

  it('00386 khi là ngày không tồn tại', async () => {
    const res = await getReport(ctx.groupAdmin.token, '/shopping', { to: '2026-02-31' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.REPORT_INVALID_DATE_RANGE.code);
  });

  it('00386 khi from > to', async () => {
    const res = await getReport(ctx.groupAdmin.token, '/shopping', {
      from: '2026-12-31',
      to: '2026-01-01',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.REPORT_INVALID_DATE_RANGE.code);
  });

  it('00386 khi khoảng dài hơn 366 ngày', async () => {
    const res = await getReport(ctx.groupAdmin.token, '/shopping', {
      from: '2020-01-01',
      to: '2026-01-01',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.REPORT_INVALID_DATE_RANGE.code);
  });

  it('mặc định 30 ngày gần nhất tính theo giờ Việt Nam', async () => {
    const res = await getReport(ctx.groupAdmin.token, '/shopping');
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.REPORT_SHOPPING_SUCCESS.code);
    expect(res.body.data.range.days).toBe(30);
    expect(res.body.data.range.to).toBe(todayKey());
  });
});

// =====================================================================
describe(`GET ${REPORT}/shopping — báo cáo mua sắm`, () => {
  it('trả số 0 khi chưa có dữ liệu', async () => {
    const res = await getReport(ctx.groupAdmin.token, '/shopping');
    expect(res.status).toBe(200);
    expect(res.body.data.summary).toEqual({
      lists: 0,
      items: 0,
      completedItems: 0,
      completionRate: 0,
    });
    expect(res.body.data.series).toHaveLength(30);
    expect(res.body.data.byCategory).toEqual([]);
    expect(res.body.data.byAssignee).toEqual([]);
  });

  it('đếm danh sách, món và tỉ lệ hoàn thành', async () => {
    const list = await createList(ctx.groupAdmin.token);
    const tasksRes = await addTasks(ctx.groupAdmin.token, list.id, [
      { foodName: 'Thịt bò', quantity: 2 },
      { foodName: 'Cà rốt', quantity: 1 },
    ]);
    const [firstTask] = tasksRes.body.data;

    await completeTask(ctx.member.token, firstTask.id);

    const res = await getReport(ctx.groupAdmin.token, '/shopping');
    expect(res.status).toBe(200);
    expect(res.body.data.summary).toEqual({
      lists: 1,
      items: 2,
      completedItems: 1,
      completionRate: 0.5,
    });
  });

  it('chuỗi theo ngày ghi nhận món tạo và món hoàn thành hôm nay', async () => {
    const list = await createList(ctx.groupAdmin.token);
    const tasksRes = await addTasks(ctx.groupAdmin.token, list.id, [
      { foodName: 'Thịt bò', quantity: 2 },
      { foodName: 'Cà rốt', quantity: 1 },
    ]);
    await completeTask(ctx.member.token, tasksRes.body.data[0].id);

    const res = await getReport(ctx.groupAdmin.token, '/shopping');
    const today = res.body.data.series.find((entry) => entry.date === todayKey());

    expect(today).toEqual({
      date: todayKey(),
      lists: 1,
      itemsCreated: 2,
      itemsCompleted: 1,
    });
  });

  it('gộp theo danh mục và người được giao', async () => {
    const list = await createList(ctx.groupAdmin.token);
    await addTasks(ctx.groupAdmin.token, list.id, [
      { foodName: 'Thịt bò', quantity: 2 },
      { foodName: 'Cà rốt', quantity: 1 },
    ]);

    const res = await getReport(ctx.groupAdmin.token, '/shopping');
    expect(res.body.data.byCategory).toEqual([
      { category: 'Rau củ', items: 1, completedItems: 0 },
      { category: 'Thịt', items: 1, completedItems: 0 },
    ]);

    expect(res.body.data.byAssignee).toHaveLength(1);
    expect(res.body.data.byAssignee[0]).toMatchObject({
      name: 'Nguyen Van A',
      username: ctx.member.username,
      lists: 1,
      items: 2,
      completedItems: 0,
    });
  });

  it('không lẫn dữ liệu của nhóm khác', async () => {
    const otherAdmin = await createLoggedInUser({ username: `rother${++counter}` });
    await request(app)
      .post(GROUP)
      .set(auth(otherAdmin.token))
      .send({ groupName: 'Gia dinh Khac' });

    await createFoodRequest(otherAdmin.token, { foodName: 'Cá hồi' });
    const otherListRes = await request(app)
      .post(SHOPPING)
      .set(auth(otherAdmin.token))
      .send({ name: 'Chợ nhóm khác', assignToUsername: otherAdmin.username });
    await addTasks(otherAdmin.token, otherListRes.body.data.id, [
      { foodName: 'Cá hồi', quantity: 5 },
    ]);

    const res = await getReport(ctx.groupAdmin.token, '/shopping');
    expect(res.body.data.summary).toEqual({
      lists: 0,
      items: 0,
      completedItems: 0,
      completionRate: 0,
    });
  });

  it('khoảng thời gian trong quá khứ không tính dữ liệu hôm nay', async () => {
    const list = await createList(ctx.groupAdmin.token);
    await addTasks(ctx.groupAdmin.token, list.id, [{ foodName: 'Thịt bò', quantity: 2 }]);

    const res = await getReport(ctx.groupAdmin.token, '/shopping', {
      from: '2000-01-01',
      to: '2000-01-31',
    });
    expect(res.body.data.summary.items).toBe(0);
    expect(res.body.data.summary.lists).toBe(0);
  });

  it('completedAt được đặt khi tick và xoá khi bỏ tick', async () => {
    const list = await createList(ctx.groupAdmin.token);
    const tasksRes = await addTasks(ctx.groupAdmin.token, list.id, [
      { foodName: 'Thịt bò', quantity: 2 },
    ]);
    const taskId = tasksRes.body.data[0].id;

    await completeTask(ctx.member.token, taskId, true);
    let task = await Task.findById(taskId);
    expect(task.completedAt).toBeInstanceOf(Date);

    await completeTask(ctx.member.token, taskId, false);
    task = await Task.findById(taskId);
    expect(task.completedAt).toBeNull();
  });
});

// =====================================================================
describe(`GET ${REPORT}/consumption — báo cáo tiêu thụ`, () => {
  it('mục còn hạn bị xoá được tính là tiêu thụ', async () => {
    await createFridgeItem(ctx.member.token, { foodName: 'Thịt bò', quantity: 3 });
    const del = await deleteFridgeItem(ctx.member.token, { foodName: 'Thịt bò' });
    expect(del.status).toBe(200);

    const event = await FridgeEvent.findOne({ action: 'consumed' });
    expect(event).toBeTruthy();
    expect(event.quantity).toBe(3);

    const res = await getReport(ctx.groupAdmin.token, '/consumption');
    expect(res.status).toBe(200);
    expect(res.body.data.summary).toEqual({ items: 1, quantity: 3 });
    expect(res.body.data.byFood).toEqual([
      { name: 'Thịt bò', items: 1, quantity: 3, unitName: 'kg' },
    ]);
    expect(res.body.data.byCategory).toEqual([{ name: 'Thịt', items: 1, quantity: 3 }]);
  });

  it('mục đã hết hạn bị xoá không nằm trong báo cáo tiêu thụ', async () => {
    await createFridgeItem(ctx.member.token, {
      foodName: 'Cà rốt',
      quantity: 1,
      useWithin: '2020-01-01',
    });
    await deleteFridgeItem(ctx.member.token, { foodName: 'Cà rốt' });

    const res = await getReport(ctx.groupAdmin.token, '/consumption');
    expect(res.body.data.summary).toEqual({ items: 0, quantity: 0 });
  });

  it('không lẫn sự kiện của nhóm khác', async () => {
    const otherAdmin = await createLoggedInUser({ username: `rother2${++counter}` });
    await request(app)
      .post(GROUP)
      .set(auth(otherAdmin.token))
      .send({ groupName: 'Gia dinh Khac 2' });
    await createFoodRequest(otherAdmin.token, { foodName: 'Cá hồi' });
    await createFridgeItem(otherAdmin.token, { foodName: 'Cá hồi' });
    await deleteFridgeItem(otherAdmin.token, { foodName: 'Cá hồi' });

    const res = await getReport(ctx.groupAdmin.token, '/consumption');
    expect(res.body.data.summary).toEqual({ items: 0, quantity: 0 });
  });
});

// =====================================================================
describe(`GET ${REPORT}/waste — báo cáo lãng phí`, () => {
  it('mục hết hạn bị xoá được tính là lãng phí', async () => {
    await createFridgeItem(ctx.member.token, {
      foodName: 'Cà rốt',
      quantity: 2,
      useWithin: '2020-01-01',
    });
    await deleteFridgeItem(ctx.member.token, { foodName: 'Cà rốt' });

    const res = await getReport(ctx.groupAdmin.token, '/waste');
    expect(res.status).toBe(200);
    expect(res.body.data.summary).toMatchObject({
      items: 1,
      quantity: 2,
      consumedQuantity: 0,
      wasteRate: 1,
    });
    expect(res.body.data.byReason).toEqual([{ name: 'expired', items: 1, quantity: 2 }]);
  });

  it('tính tỉ lệ lãng phí trên cả phần đã tiêu thụ', async () => {
    await createFridgeItem(ctx.member.token, {
      foodName: 'Cà rốt',
      quantity: 2,
      useWithin: '2020-01-01',
    });
    await createFridgeItem(ctx.member.token, { foodName: 'Thịt bò', quantity: 2 });

    await deleteFridgeItem(ctx.member.token, { foodName: 'Cà rốt' });
    await deleteFridgeItem(ctx.member.token, { foodName: 'Thịt bò' });

    const res = await getReport(ctx.groupAdmin.token, '/waste');
    expect(res.body.data.summary).toEqual({
      items: 1,
      quantity: 2,
      consumedQuantity: 2,
      wasteRate: 0.5,
    });
  });

  it('reason do client gửi được ưu tiên hơn quy ước theo hạn', async () => {
    await createFridgeItem(ctx.member.token, {
      foodName: 'Cà rốt',
      quantity: 1,
      useWithin: '2020-01-01',
    });
    await deleteFridgeItem(ctx.member.token, {
      foodName: 'Cà rốt',
      reason: 'consumed',
    });

    const waste = await getReport(ctx.groupAdmin.token, '/waste');
    const consumption = await getReport(ctx.groupAdmin.token, '/consumption');
    expect(waste.body.data.summary.items).toBe(0);
    expect(consumption.body.data.summary.items).toBe(1);
  });

  it('00226 khi reason không hợp lệ', async () => {
    await createFridgeItem(ctx.member.token);
    const res = await deleteFridgeItem(ctx.member.token, {
      foodName: 'Thịt bò',
      reason: 'khong-hop-le',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FRIDGE_DELETE_INVALID_REASON.code);
  });
});

// =====================================================================
describe(`GET ${REPORT}/fridge — ảnh chụp tủ lạnh`, () => {
  it('đếm tổng, sắp hết hạn và đã hết hạn', async () => {
    await createFridgeItem(ctx.member.token, {
      foodName: 'Thịt bò',
      quantity: 2,
      useWithin: todayKey(),
    });
    await createFridgeItem(ctx.member.token, {
      foodName: 'Cà rốt',
      quantity: 1,
      useWithin: '2020-01-01',
    });
    await createFridgeItem(ctx.member.token, {
      foodName: 'Cá hồi',
      quantity: 4,
      useWithin: '2030-01-01',
      location: 'ngăn đá',
    });

    const res = await getReport(ctx.groupAdmin.token, '/fridge');
    expect(res.status).toBe(200);
    expect(res.body.data.summary).toEqual({
      totalItems: 3,
      totalQuantity: 7,
      expiringSoon: 1,
      expired: 1,
    });

    const statusByName = Object.fromEntries(
      res.body.data.items.map((item) => [item.foodName, item.status])
    );
    expect(statusByName).toEqual({
      'Thịt bò': 'expiringSoon',
      'Cà rốt': 'expired',
      'Cá hồi': 'fresh',
    });

    const salmon = res.body.data.items.find((item) => item.foodName === 'Cá hồi');
    expect(salmon).toMatchObject({
      categoryName: 'Thịt',
      unitName: 'kg',
      location: 'ngăn đá',
    });

    expect(res.body.data.byLocation).toEqual(
      expect.arrayContaining([
        { name: 'Không xác định', items: 2, quantity: 3 },
        { name: 'ngăn đá', items: 1, quantity: 4 },
      ])
    );
  });

  it('không lẫn dữ liệu tủ của nhóm khác', async () => {
    const otherAdmin = await createLoggedInUser({ username: `rother3${++counter}` });
    await request(app)
      .post(GROUP)
      .set(auth(otherAdmin.token))
      .send({ groupName: 'Gia dinh Khac 3' });
    await createFoodRequest(otherAdmin.token, { foodName: 'Cá hồi' });
    await createFridgeItem(otherAdmin.token, { foodName: 'Cá hồi' });

    const res = await getReport(ctx.groupAdmin.token, '/fridge');
    expect(res.body.data.summary.totalItems).toBe(0);
  });
});

// =====================================================================
describe(`GET ${REPORT}/overview — báo cáo tổng hợp`, () => {
  it('gộp đủ bốn khối số liệu', async () => {
    const list = await createList(ctx.groupAdmin.token);
    await addTasks(ctx.groupAdmin.token, list.id, [{ foodName: 'Thịt bò', quantity: 2 }]);

    await createFridgeItem(ctx.member.token, { foodName: 'Thịt bò', quantity: 2 });
    await deleteFridgeItem(ctx.member.token, { foodName: 'Thịt bò', reason: 'consumed' });

    const res = await getReport(ctx.groupAdmin.token, '/overview');
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.REPORT_OVERVIEW_SUCCESS.code);
    expect(Object.keys(res.body.data).sort()).toEqual([
      'consumption',
      'fridge',
      'range',
      'shopping',
      'waste',
    ]);
    expect(res.body.data.shopping.items).toBe(1);
    expect(res.body.data.consumption).toEqual({ items: 1, quantity: 2 });
  });
});
