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
const MealPlan = require('../src/models/mealPlan.models');
const Recipe = require('../src/models/recipe.models');
const emailUtil = require('../src/utils/email');
const RC = require('../src/constants/responseCode');

const USER = '/it4788/user';
const GROUP = `${USER}/group`;
const FOOD = '/it4788/food';
const FRIDGE = '/it4788/fridge';
const MEAL = '/it4788/meal';

let mongod;
let counter = 0;
const nextEmail = () => `meal${++counter}@example.com`;

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
  const groupAdmin = await createLoggedInUser({ username: `madmin${++counter}` });
  const member = await createLoggedInUser({ username: `mmem${++counter}` });
  const outsider = await createLoggedInUser({ username: `mout${++counter}` });

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
  const otherAdmin = await createLoggedInUser({ username: `mother${++counter}` });
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

const createFridgeRequest = (token, overrides = {}) =>
  request(app)
    .post(FRIDGE)
    .set(auth(token))
    .send({ foodName: 'Thịt bò', quantity: 2, useWithin: '2099-11-10', ...overrides });

const createMealRequest = (token, overrides = {}) =>
  request(app)
    .post(MEAL)
    .set(auth(token))
    .send({ foodName: 'Thịt bò', timestamp: '2026-11-10', name: 'sáng', ...overrides });

const updateMealRequest = (token, body) =>
  request(app).put(MEAL).set(auth(token)).send(body);

const deleteMealRequest = (token, body) =>
  request(app).delete(MEAL).set(auth(token)).send(body);

/** Ngày ISO (YYYY-MM-DD) cách hôm nay `days` ngày, dùng cho test tủ lạnh. */
const daysFromNow = (days) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

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
  await MealPlan.init();
  await Recipe.init();
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
  await MealPlan.deleteMany({});
  await Recipe.deleteMany({});

  await Category.create([{ name: 'Thịt' }, { name: 'Rau củ' }]);
  await Unit.create([{ name: 'kg' }, { name: 'gram' }]);

  ctx = await createGroupFixture();

  const beef = await createFoodRequest(ctx.member.token, { foodName: 'Thịt bò' });
  const carrot = await createFoodRequest(ctx.member.token, {
    foodName: 'Cà rốt',
    categoryName: 'Rau củ',
    unitName: 'gram',
  });

  ctx.foods = { beef: beef.body.data, carrot: carrot.body.data };
});

// =====================================================================
describe(`POST ${MEAL} — lập kế hoạch bữa ăn`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app)
      .post(MEAL)
      .send({ foodName: 'Thịt bò', timestamp: '2026-11-10', name: 'sáng' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00313 khi thiếu toàn bộ trường', async () => {
    const res = await request(app).post(MEAL).set(auth(ctx.groupAdmin.token)).send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.MEAL_CREATE_MISSING_FIELDS.code);
  });

  it('00313 khi foodName rỗng', async () => {
    const res = await createMealRequest(ctx.groupAdmin.token, { foodName: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.MEAL_CREATE_MISSING_FIELDS.code);
  });

  it('00315 khi timestamp không phải ngày hợp lệ', async () => {
    const missing = await request(app)
      .post(MEAL)
      .set(auth(ctx.groupAdmin.token))
      .send({ foodName: 'Thịt bò', name: 'sáng' });
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe(RC.MEAL_CREATE_MISSING_FIELDS.code);

    const invalid = await createMealRequest(ctx.groupAdmin.token, {
      timestamp: 'không phải ngày',
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe(RC.MEAL_CREATE_INVALID_TIMESTAMP.code);
  });

  it('00316 khi tên bữa không hợp lệ', async () => {
    const res = await createMealRequest(ctx.groupAdmin.token, { name: 'chiều' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.MEAL_CREATE_INVALID_NAME.code);
  });

  it('00319 khi người dùng chưa vào nhóm', async () => {
    const res = await createMealRequest(ctx.outsider.token);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.MEAL_CREATE_NOT_GROUP_ADMIN.code);
  });

  it('00319 khi thành viên (không phải trưởng nhóm) lập kế hoạch', async () => {
    const res = await createMealRequest(ctx.member.token);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.MEAL_CREATE_NOT_GROUP_ADMIN.code);
  });

  it('00317 khi thực phẩm không tồn tại trong nhóm', async () => {
    const res = await createMealRequest(ctx.groupAdmin.token, { foodName: 'Cá hồi' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.MEAL_CREATE_FOOD_NOT_FOUND.code);
  });

  it('00317 khi thực phẩm thuộc nhóm khác', async () => {
    const otherAdmin = await createOtherGroup();
    await createFoodRequest(otherAdmin.token, { foodName: 'Cá hồi' });

    const res = await createMealRequest(ctx.groupAdmin.token, { foodName: 'Cá hồi' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.MEAL_CREATE_FOOD_NOT_FOUND.code);
  });

  it('00322 tạo thành công và chuẩn hoá tên bữa "Sang" -> "sáng"', async () => {
    const res = await createMealRequest(ctx.groupAdmin.token, {
      timestamp: '2026-11-10',
      name: 'Sang',
    });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(RC.MEAL_CREATE_SUCCESS.code);

    const data = res.body.data;
    expect(data.foodId).toBe(ctx.foods.beef.id);
    expect(data.foodName).toBe('Thịt bò');
    expect(data.categoryName).toBe('Thịt');
    expect(data.unitName).toBe('kg');
    expect(data.name).toBe('sáng');
    expect(new Date(data.timestamp).toISOString()).toBe('2026-11-10T00:00:00.000Z');
    expect(await MealPlan.countDocuments({})).toBe(1);
  });
});

// =====================================================================
describe(`GET ${MEAL} — lịch bữa ăn`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).get(MEAL);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00345 khi người dùng chưa vào nhóm', async () => {
    const res = await request(app).get(MEAL).set(auth(ctx.outsider.token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.MEAL_GET_NOT_IN_GROUP.code);
  });

  it('00348 trả toàn bộ kế hoạch, sắp theo ngày rồi sáng/trưa/tối', async () => {
    await createMealRequest(ctx.groupAdmin.token, { timestamp: '2026-11-11', name: 'trưa' });
    await createMealRequest(ctx.groupAdmin.token, { timestamp: '2026-11-10', name: 'tối' });
    await createMealRequest(ctx.groupAdmin.token, { timestamp: '2026-11-10', name: 'sáng' });

    const res = await request(app).get(MEAL).set(auth(ctx.member.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.MEAL_GET_SUCCESS.code);
    expect(res.body.data.map((plan) => `${plan.timestamp.slice(0, 10)}:${plan.name}`)).toEqual([
      '2026-11-10:sáng',
      '2026-11-10:tối',
      '2026-11-11:trưa',
    ]);
  });

  it('00348 lọc theo ?date= và ?from=&to=', async () => {
    await createMealRequest(ctx.groupAdmin.token, { timestamp: '2026-11-10', name: 'sáng' });
    await createMealRequest(ctx.groupAdmin.token, { timestamp: '2026-11-10', name: 'tối' });
    await createMealRequest(ctx.groupAdmin.token, { timestamp: '2026-11-11', name: 'trưa' });

    const byDate = await request(app)
      .get(`${MEAL}?date=2026-11-10`)
      .set(auth(ctx.member.token));
    expect(byDate.status).toBe(200);
    expect(byDate.body.data).toHaveLength(2);

    const byRange = await request(app)
      .get(`${MEAL}?from=2026-11-10&to=2026-11-10`)
      .set(auth(ctx.member.token));
    expect(byRange.body.data).toHaveLength(2);

    const fromOnly = await request(app)
      .get(`${MEAL}?from=2026-11-11`)
      .set(auth(ctx.member.token));
    expect(fromOnly.body.data).toHaveLength(1);
    expect(fromOnly.body.data[0].name).toBe('trưa');
  });

  it('00348 không lộ kế hoạch của nhóm khác', async () => {
    const otherAdmin = await createOtherGroup();
    await createFoodRequest(otherAdmin.token, { foodName: 'Cá hồi' });
    await createMealRequest(otherAdmin.token, { foodName: 'Cá hồi' });

    const res = await request(app).get(MEAL).set(auth(ctx.member.token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// =====================================================================
describe(`PUT ${MEAL} — sửa kế hoạch bữa ăn`, () => {
  let plan;

  beforeEach(async () => {
    const res = await createMealRequest(ctx.groupAdmin.token);
    plan = res.body.data;
  });

  it('00332 khi thiếu planId', async () => {
    const res = await updateMealRequest(ctx.groupAdmin.token, { newName: 'trưa' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.MEAL_UPDATE_MISSING_PLAN_ID.code);
  });

  it('00332 khi planId sai định dạng', async () => {
    const res = await updateMealRequest(ctx.groupAdmin.token, {
      planId: 'khong-phai-id',
      newName: 'trưa',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.MEAL_UPDATE_MISSING_PLAN_ID.code);
  });

  it('00333 khi không có trường nào để cập nhật', async () => {
    const res = await updateMealRequest(ctx.groupAdmin.token, { planId: plan.id });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.MEAL_UPDATE_NEED_ONE_FIELD.code);
  });

  it('00334 khi newFoodName rỗng', async () => {
    const res = await updateMealRequest(ctx.groupAdmin.token, {
      planId: plan.id,
      newFoodName: '  ',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.MEAL_UPDATE_INVALID_FOOD_NAME.code);
  });

  it('00335 khi newTimestamp không hợp lệ', async () => {
    const res = await updateMealRequest(ctx.groupAdmin.token, {
      planId: plan.id,
      newTimestamp: 'hôm qua',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.MEAL_UPDATE_INVALID_TIMESTAMP.code);
  });

  it('00336 khi newName không hợp lệ', async () => {
    const res = await updateMealRequest(ctx.groupAdmin.token, {
      planId: plan.id,
      newName: 'đêm',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.MEAL_UPDATE_INVALID_NAME.code);
  });

  it('00337 khi kế hoạch không tồn tại', async () => {
    const res = await updateMealRequest(ctx.groupAdmin.token, {
      planId: new mongoose.Types.ObjectId().toString(),
      newName: 'trưa',
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.MEAL_UPDATE_NOT_FOUND.code);
  });

  it('00339 khi thành viên không phải trưởng nhóm', async () => {
    const res = await updateMealRequest(ctx.member.token, {
      planId: plan.id,
      newName: 'trưa',
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.MEAL_UPDATE_NOT_GROUP_ADMIN.code);
  });

  it('00341 khi thực phẩm mới không tồn tại', async () => {
    const res = await updateMealRequest(ctx.groupAdmin.token, {
      planId: plan.id,
      newFoodName: 'Cá hồi',
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.MEAL_UPDATE_NEW_FOOD_NOT_FOUND.code);
  });

  it('00344 cập nhật món, ngày và tên bữa', async () => {
    const res = await updateMealRequest(ctx.groupAdmin.token, {
      planId: plan.id,
      newFoodName: 'Cà rốt',
      newTimestamp: '2026-11-12',
      newName: 'tối',
    });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.MEAL_UPDATE_SUCCESS.code);
    expect(res.body.data.foodName).toBe('Cà rốt');
    expect(res.body.data.name).toBe('tối');
    expect(new Date(res.body.data.timestamp).toISOString()).toBe('2026-11-12T00:00:00.000Z');
  });
});

// =====================================================================
describe(`DELETE ${MEAL} — xoá kế hoạch bữa ăn`, () => {
  let plan;

  beforeEach(async () => {
    const res = await createMealRequest(ctx.groupAdmin.token);
    plan = res.body.data;
  });

  it('00323 khi thiếu planId', async () => {
    const res = await deleteMealRequest(ctx.groupAdmin.token, {});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.MEAL_DELETE_MISSING_FIELDS.code);
  });

  it('00324 khi planId sai định dạng', async () => {
    const res = await deleteMealRequest(ctx.groupAdmin.token, { planId: '123' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.MEAL_DELETE_INVALID_PLAN_ID.code);
  });

  it('00325 khi kế hoạch không tồn tại', async () => {
    const res = await deleteMealRequest(ctx.groupAdmin.token, {
      planId: new mongoose.Types.ObjectId().toString(),
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.MEAL_DELETE_NOT_FOUND.code);
  });

  it('00327 khi thành viên không phải trưởng nhóm', async () => {
    const res = await deleteMealRequest(ctx.member.token, { planId: plan.id });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.MEAL_DELETE_NOT_GROUP_ADMIN.code);
  });

  it('00330 xoá thành công và trả lại dữ liệu vừa xoá', async () => {
    const res = await deleteMealRequest(ctx.groupAdmin.token, { planId: plan.id });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.MEAL_DELETE_SUCCESS.code);
    expect(res.body.data.id).toBe(plan.id);
    expect(await MealPlan.countDocuments({})).toBe(0);
  });
});

// =====================================================================
describe(`GET ${MEAL}/suggestion — gợi ý món từ tủ lạnh`, () => {
  it('00345 khi người dùng chưa vào nhóm', async () => {
    const res = await request(app).get(`${MEAL}/suggestion`).set(auth(ctx.outsider.token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.MEAL_GET_NOT_IN_GROUP.code);
  });

  it('00348 trả mảng rỗng khi tủ lạnh trống', async () => {
    const res = await request(app).get(`${MEAL}/suggestion`).set(auth(ctx.member.token));
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.MEAL_GET_SUCCESS.code);
    expect(res.body.data).toEqual([]);
  });

  it('00348 ưu tiên thực phẩm sắp hết hạn và bỏ qua mục đã hết hạn', async () => {
    // Thịt bò hết hạn sau 5 ngày, cà rốt sau 1 ngày, thêm một món đã hết hạn.
    await createFridgeRequest(ctx.member.token, {
      foodName: 'Thịt bò',
      useWithin: daysFromNow(5),
    });
    await createFridgeRequest(ctx.member.token, {
      foodName: 'Cà rốt',
      useWithin: daysFromNow(1),
    });
    await createFoodRequest(ctx.member.token, {
      foodName: 'Cá hồi',
      categoryName: 'Rau củ',
      unitName: 'gram',
    });
    const expired = await createFridgeRequest(ctx.member.token, {
      foodName: 'Cá hồi',
      useWithin: daysFromNow(-1),
    });
    expect(expired.status).toBe(201);

    await Recipe.create([
      {
        groupId: ctx.foods.beef.groupId,
        foodId: ctx.foods.beef.id,
        name: 'Bò xào',
        description: 'Món bò xào rau củ',
        htmlContent: '<p>Cách làm bò xào</p>',
      },
      {
        groupId: ctx.foods.carrot.groupId,
        foodId: ctx.foods.carrot.id,
        name: 'Cà rốt hầm',
        description: 'Món cà rốt hầm',
        htmlContent: '<p>Cách làm cà rốt hầm</p>',
      },
      {
        groupId: ctx.foods.beef.groupId,
        foodId: (await Food.findOne({ groupId: ctx.foods.beef.groupId, name: 'Cá hồi' }))._id,
        name: 'Cá hồi áp chảo',
        description: 'Món cá hồi',
        htmlContent: '<p>Cách làm cá hồi</p>',
      },
    ]);

    const res = await request(app).get(`${MEAL}/suggestion`).set(auth(ctx.member.token));

    expect(res.status).toBe(200);
    expect(res.body.data.map((item) => item.name)).toEqual(['Cà rốt hầm', 'Bò xào']);
    expect(res.body.data[0].foodName).toBe('Cà rốt');
    expect(res.body.data[0].quantity).toBe(2);
    expect(res.body.data[0].daysUntilExpiry).toBeLessThanOrEqual(1);
  });

  it('00348 tôn trọng tham số limit', async () => {
    await createFridgeRequest(ctx.member.token, { useWithin: daysFromNow(3) });
    await createFridgeRequest(ctx.member.token, {
      foodName: 'Cà rốt',
      useWithin: daysFromNow(4),
    });
    await Recipe.create([
      {
        groupId: ctx.foods.beef.groupId,
        foodId: ctx.foods.beef.id,
        name: 'Bò xào',
        description: 'Món bò xào',
        htmlContent: '<p>1</p>',
      },
      {
        groupId: ctx.foods.carrot.groupId,
        foodId: ctx.foods.carrot.id,
        name: 'Cà rốt hầm',
        description: 'Món cà rốt hầm',
        htmlContent: '<p>2</p>',
      },
    ]);

    const res = await request(app)
      .get(`${MEAL}/suggestion?limit=1`)
      .set(auth(ctx.member.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

// =====================================================================
describe('Dọn dữ liệu liên quan khi xoá thực phẩm', () => {
  it('xoá thực phẩm xoá luôn kế hoạch bữa ăn và công thức của món đó', async () => {
    await createMealRequest(ctx.groupAdmin.token);
    await Recipe.create({
      groupId: ctx.foods.beef.groupId,
      foodId: ctx.foods.beef.id,
      name: 'Bò xào',
      description: 'Món bò xào',
      htmlContent: '<p>1</p>',
    });

    const res = await request(app)
      .delete(FOOD)
      .set(auth(ctx.groupAdmin.token))
      .send({ foodName: 'Thịt bò' });

    expect(res.status).toBe(200);
    expect(await MealPlan.countDocuments({})).toBe(0);
    expect(await Recipe.countDocuments({})).toBe(0);
  });
});
