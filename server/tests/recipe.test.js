const request = require('supertest');
const mongoose = require('mongoose');
const os = require('os');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Không gửi email thật: dùng mock như các test Auth/Tài khoản/Nhóm/Thực phẩm/Tủ lạnh/Đi chợ/Bữa ăn.
jest.mock('../src/utils/email', () => ({
  sendVerificationCode: jest.fn(async () => ({ delivered: false, devCode: null })),
}));

const app = require('../src/app');
const User = require('../src/models/user.models');
const Group = require('../src/models/group.models');
const Category = require('../src/models/category.models');
const Unit = require('../src/models/unit.models');
const Food = require('../src/models/food.models');
const Recipe = require('../src/models/recipe.models');
const emailUtil = require('../src/utils/email');
const RC = require('../src/constants/responseCode');

const USER = '/it4788/user';
const GROUP = `${USER}/group`;
const FOOD = '/it4788/food';
const RECIPE = '/it4788/recipe';

let mongod;
let counter = 0;
const nextEmail = () => `recipe${++counter}@example.com`;

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
    .send({ groupName: 'Gia dinh A' });

  await request(app)
    .post(`${GROUP}/add`)
    .set(auth(groupAdmin.token))
    .send({ username: member.username });

  return { groupAdmin, member, outsider };
};

/** Nhóm thứ hai (để test dữ liệu chéo nhóm). */
const createOtherGroup = async () => {
  const otherAdmin = await createLoggedInUser({ username: `rother${++counter}` });
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

const createRecipeRequest = (token, overrides = {}) =>
  request(app)
    .post(RECIPE)
    .set(auth(token))
    .send({
      foodName: 'Thịt bò',
      name: 'Bò xào',
      description: 'Món bò xào rau củ',
      htmlContent: '<p>Cách làm bò xào</p>',
      ...overrides,
    });

const updateRecipeRequest = (token, body) =>
  request(app).put(RECIPE).set(auth(token)).send(body);

const deleteRecipeRequest = (token, body) =>
  request(app).delete(RECIPE).set(auth(token)).send(body);

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  // Workaround: mongoose >= 9.10 + Jest 30 chặn dynamic import của driver.
  await mongoose.connect(mongod.getUri(), { runtimeAdapters: { os } });
  await User.init();
  await Group.init();
  await Category.init();
  await Unit.init();
  await Food.init();
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

/** Tạo sẵn một công thức của món Thịt bò. */
const createBeefRecipe = async (token = ctx.member.token, overrides = {}) => {
  const res = await createRecipeRequest(token, overrides);
  return res.body.data;
};

// =====================================================================
describe(`POST ${RECIPE} — thêm công thức`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app)
      .post(RECIPE)
      .send({ foodName: 'Thịt bò', name: 'Bò xào', description: 'Mô tả', htmlContent: '<p>1</p>' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00349 khi thiếu toàn bộ trường', async () => {
    const res = await request(app).post(RECIPE).set(auth(ctx.member.token)).send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.RECIPE_CREATE_MISSING_FIELDS.code);
  });

  it('00349 khi foodName rỗng', async () => {
    const res = await createRecipeRequest(ctx.member.token, { foodName: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.RECIPE_CREATE_MISSING_FIELDS.code);
  });

  it('00351 khi tên công thức quá 200 ký tự', async () => {
    const res = await createRecipeRequest(ctx.member.token, { name: 'a'.repeat(201) });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.RECIPE_CREATE_INVALID_NAME.code);
  });

  it('00352 khi mô tả quá 2000 ký tự', async () => {
    const res = await createRecipeRequest(ctx.member.token, { description: 'a'.repeat(2001) });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.RECIPE_CREATE_INVALID_DESCRIPTION.code);
  });

  it('00353 khi htmlContent sai kiểu', async () => {
    const res = await createRecipeRequest(ctx.member.token, { htmlContent: 123 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.RECIPE_CREATE_INVALID_HTML.code);
  });

  it('00096 khi người dùng chưa vào nhóm', async () => {
    const res = await createRecipeRequest(ctx.outsider.token);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.GROUP_NOT_IN_GROUP.code);
  });

  it('00354 khi thực phẩm không tồn tại trong nhóm', async () => {
    const res = await createRecipeRequest(ctx.member.token, { foodName: 'Cá hồi' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.RECIPE_CREATE_FOOD_NOT_FOUND.code);
  });

  it('00354 khi thực phẩm thuộc nhóm khác', async () => {
    const otherAdmin = await createOtherGroup();
    await createFoodRequest(otherAdmin.token, { foodName: 'Cá hồi' });

    const res = await createRecipeRequest(ctx.member.token, { foodName: 'Cá hồi' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.RECIPE_CREATE_FOOD_NOT_FOUND.code);
  });

  it('00357 tạo thành công (thành viên thường cũng được tạo)', async () => {
    const res = await createRecipeRequest(ctx.member.token);

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(RC.RECIPE_CREATE_SUCCESS.code);

    const data = res.body.data;
    expect(data.foodId).toBe(ctx.foods.beef.id);
    expect(data.foodName).toBe('Thịt bò');
    expect(data.name).toBe('Bò xào');
    expect(data.description).toBe('Món bò xào rau củ');
    expect(data.htmlContent).toBe('<p>Cách làm bò xào</p>');
    expect(await Recipe.countDocuments({})).toBe(1);
  });
});

// =====================================================================
describe(`GET ${RECIPE} — danh sách công thức`, () => {
  beforeEach(async () => {
    await createRecipeRequest(ctx.member.token);
    await createRecipeRequest(ctx.member.token, {
      foodName: 'Cà rốt',
      name: 'Cà rốt hầm',
      description: 'Món cà rốt hầm',
      htmlContent: '<p>Cách làm cà rốt hầm</p>',
    });
  });

  it('00006 khi không có token', async () => {
    const res = await request(app).get(RECIPE);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00096 khi người dùng chưa vào nhóm', async () => {
    const res = await request(app).get(RECIPE).set(auth(ctx.outsider.token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.GROUP_NOT_IN_GROUP.code);
  });

  it('00378 trả toàn bộ công thức của nhóm', async () => {
    const res = await request(app).get(RECIPE).set(auth(ctx.member.token));
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.RECIPE_GET_SUCCESS.code);
    expect(res.body.data).toHaveLength(2);
  });

  it('00378 lọc theo foodName', async () => {
    const res = await request(app)
      .get(`${RECIPE}?foodName=${encodeURIComponent('Cà rốt')}`)
      .set(auth(ctx.member.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Cà rốt hầm');
  });

  it('00378 lọc theo foodId (đặc tả gốc)', async () => {
    const res = await request(app)
      .get(`${RECIPE}?foodId=${ctx.foods.beef.id}`)
      .set(auth(ctx.member.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Bò xào');
  });

  it('00378 trả mảng rỗng khi foodId sai định dạng hoặc không tồn tại', async () => {
    const invalid = await request(app)
      .get(`${RECIPE}?foodId=khong-phai-id`)
      .set(auth(ctx.member.token));
    expect(invalid.status).toBe(200);
    expect(invalid.body.data).toEqual([]);

    const unknown = await request(app)
      .get(`${RECIPE}?foodName=${encodeURIComponent('Cá hồi')}`)
      .set(auth(ctx.member.token));
    expect(unknown.status).toBe(200);
    expect(unknown.body.data).toEqual([]);
  });

  it('00378 không lộ công thức của nhóm khác', async () => {
    const otherAdmin = await createOtherGroup();
    await createFoodRequest(otherAdmin.token, { foodName: 'Cá hồi' });
    await createRecipeRequest(otherAdmin.token, { foodName: 'Cá hồi', name: 'Cá hồi áp chảo' });

    const res = await request(app).get(RECIPE).set(auth(ctx.member.token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.map((item) => item.name)).not.toContain('Cá hồi áp chảo');
  });
});

// =====================================================================
describe(`PUT ${RECIPE} — sửa công thức`, () => {
  let recipe;

  beforeEach(async () => {
    recipe = await createBeefRecipe();
  });

  it('00359 khi thiếu recipeId', async () => {
    const res = await updateRecipeRequest(ctx.member.token, { newName: 'Bò nướng' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.RECIPE_UPDATE_MISSING_RECIPE_ID.code);
  });

  it('00359 khi recipeId sai định dạng', async () => {
    const res = await updateRecipeRequest(ctx.member.token, {
      recipeId: 'khong-phai-id',
      newName: 'Bò nướng',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.RECIPE_UPDATE_MISSING_RECIPE_ID.code);
  });

  it('00360 khi không có trường nào để cập nhật', async () => {
    const res = await updateRecipeRequest(ctx.member.token, { recipeId: recipe.id });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.RECIPE_UPDATE_NEED_ONE_FIELD.code);
  });

  it('00361 khi newFoodName rỗng', async () => {
    const res = await updateRecipeRequest(ctx.member.token, {
      recipeId: recipe.id,
      newFoodName: '  ',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.RECIPE_UPDATE_INVALID_FOOD_NAME.code);
  });

  it('00362 khi newDescription rỗng', async () => {
    const res = await updateRecipeRequest(ctx.member.token, {
      recipeId: recipe.id,
      newDescription: '  ',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.RECIPE_UPDATE_INVALID_DESCRIPTION.code);
  });

  it('00363 khi newHtmlContent rỗng', async () => {
    const res = await updateRecipeRequest(ctx.member.token, {
      recipeId: recipe.id,
      newHtmlContent: '   ',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.RECIPE_UPDATE_INVALID_HTML.code);
  });

  it('00364 khi newName rỗng', async () => {
    const res = await updateRecipeRequest(ctx.member.token, {
      recipeId: recipe.id,
      newName: '  ',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.RECIPE_UPDATE_INVALID_NAME.code);
  });

  it('00365 khi công thức không tồn tại', async () => {
    const res = await updateRecipeRequest(ctx.member.token, {
      recipeId: new mongoose.Types.ObjectId().toString(),
      newName: 'Bò nướng',
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.RECIPE_UPDATE_NOT_FOUND.code);
  });

  it('00367 khi thực phẩm mới không tồn tại', async () => {
    const res = await updateRecipeRequest(ctx.member.token, {
      recipeId: recipe.id,
      newFoodName: 'Cá hồi',
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.RECIPE_UPDATE_NEW_FOOD_NOT_FOUND.code);
  });

  it('00370 cập nhật món, tên, mô tả và nội dung HTML', async () => {
    const res = await updateRecipeRequest(ctx.member.token, {
      recipeId: recipe.id,
      newFoodName: 'Cà rốt',
      newName: 'Cà rốt hầm',
      newDescription: 'Món cà rốt hầm',
      newHtmlContent: '<p>Cách làm cà rốt hầm</p>',
    });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.RECIPE_UPDATE_SUCCESS.code);
    expect(res.body.data.foodName).toBe('Cà rốt');
    expect(res.body.data.name).toBe('Cà rốt hầm');
    expect(res.body.data.description).toBe('Món cà rốt hầm');
    expect(res.body.data.htmlContent).toBe('<p>Cách làm cà rốt hầm</p>');
  });
});

// =====================================================================
describe(`DELETE ${RECIPE} — xoá công thức`, () => {
  let recipe;

  beforeEach(async () => {
    recipe = await createBeefRecipe();
  });

  it('00371 khi thiếu recipeId', async () => {
    const res = await deleteRecipeRequest(ctx.member.token, {});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.RECIPE_DELETE_MISSING_FIELDS.code);
  });

  it('00372 khi recipeId sai định dạng', async () => {
    const res = await deleteRecipeRequest(ctx.member.token, { recipeId: '123' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.RECIPE_DELETE_INVALID_RECIPE_ID.code);
  });

  it('00373 khi công thức không tồn tại', async () => {
    const res = await deleteRecipeRequest(ctx.member.token, {
      recipeId: new mongoose.Types.ObjectId().toString(),
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.RECIPE_DELETE_NOT_FOUND.code);
  });

  it('00376 xoá thành công và trả lại dữ liệu vừa xoá', async () => {
    const res = await deleteRecipeRequest(ctx.member.token, { recipeId: recipe.id });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.RECIPE_DELETE_SUCCESS.code);
    expect(res.body.data.id).toBe(recipe.id);
    expect(await Recipe.countDocuments({})).toBe(0);
  });
});
