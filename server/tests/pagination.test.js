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
const FridgeItem = require('../src/models/fridgeItem.models');
const ShoppingList = require('../src/models/shoppingList.models');
const Task = require('../src/models/task.models');
const MealPlan = require('../src/models/mealPlan.models');
const Recipe = require('../src/models/recipe.models');
const { signAccessToken } = require('../src/utils/jwt');
const RC = require('../src/constants/responseCode');

let mongod;
let ctx;

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const buildFixture = async () => {
  const user = await User.create({
    email: 'page@example.com',
    password: await bcrypt.hash('matkhau123', 4),
    name: 'Người dùng phân trang',
    username: 'pageuser',
    isVerified: true,
  });
  const group = await Group.create({
    name: 'Gia đình Page',
    adminId: user._id,
    members: [user._id],
  });
  user.groupId = group._id;
  await user.save();

  const category = await Category.create({ name: 'Danh mục Page' });
  const unit = await Unit.create({ name: 'kg Page' });

  const foods = [];
  for (let i = 1; i <= 3; i += 1) {
    foods.push(
      await Food.create({
        name: `Món ${i}`,
        categoryId: category._id,
        unitId: unit._id,
        groupId: group._id,
        createdBy: user._id,
      })
    );
    await FridgeItem.create({
      foodId: foods[i - 1]._id,
      groupId: group._id,
      quantity: i,
      expiryDate: new Date(`2030-01-0${i}`),
    });
    await ShoppingList.create({
      name: `Danh sách ${i}`,
      groupId: group._id,
      assignedTo: user._id,
      createdBy: user._id,
    });
    await MealPlan.create({
      groupId: group._id,
      foodId: foods[i - 1]._id,
      timestamp: new Date(`2026-11-0${i}`),
      name: 'sáng',
    });
    await Recipe.create({
      foodId: foods[i - 1]._id,
      groupId: group._id,
      name: `Công thức ${i}`,
      description: 'Mô tả',
      htmlContent: '<p>Nội dung</p>',
    });
  }

  const lists = await ShoppingList.find({ groupId: group._id }).sort({ name: 1 });
  await Task.create({
    listId: lists[0]._id,
    foodId: foods[0]._id,
    quantity: 1,
  });

  return { user, token: signAccessToken(user), group, foods, lists };
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
    FridgeItem.deleteMany({}),
    Task.deleteMany({}),
    ShoppingList.deleteMany({}),
    MealPlan.deleteMany({}),
    Recipe.deleteMany({}),
    Food.deleteMany({}),
    Category.deleteMany({}),
    Unit.deleteMany({}),
    User.deleteMany({}),
    Group.deleteMany({}),
  ]);
  ctx = await buildFixture();
});

describe('Phân trang danh sách', () => {
  it('GET /food?page=2&limit=2 trả trang thứ hai và total', async () => {
    const res = await request(app)
      .get('/it4788/food')
      .query({ page: 2, limit: 2 })
      .set(auth(ctx.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 3, page: 2, limit: 2, totalPages: 2 });
    expect(res.body.data.items).toHaveLength(1);
  });

  it('GET /food không truyền page/limit vẫn trả mảng như cũ', async () => {
    const res = await request(app).get('/it4788/food').set(auth(ctx.token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(3);
  });

  it('GET /fridge?page=1&limit=2', async () => {
    const res = await request(app)
      .get('/it4788/fridge')
      .query({ page: 1, limit: 2 })
      .set(auth(ctx.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 3, page: 1, limit: 2, totalPages: 2 });
    expect(res.body.data.items).toHaveLength(2);
  });

  it('GET /shopping?page=1&limit=2', async () => {
    const res = await request(app)
      .get('/it4788/shopping')
      .query({ page: 1, limit: 2 })
      .set(auth(ctx.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 3, page: 1, limit: 2, totalPages: 2 });
    expect(res.body.data.items).toHaveLength(2);
  });

  it('GET /meal?page=1&limit=2', async () => {
    const res = await request(app)
      .get('/it4788/meal')
      .query({ page: 1, limit: 2 })
      .set(auth(ctx.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 3, page: 1, limit: 2, totalPages: 2 });
    expect(res.body.data.items).toHaveLength(2);
  });

  it('GET /recipe?page=2&limit=2', async () => {
    const res = await request(app)
      .get('/it4788/recipe')
      .query({ page: 2, limit: 2 })
      .set(auth(ctx.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 3, page: 2, limit: 2, totalPages: 2 });
    expect(res.body.data.items).toHaveLength(1);
  });

  it('page/limit sai trả 00410', async () => {
    for (const query of [
      { page: 0 },
      { page: 'abc' },
      { limit: 0 },
      { limit: 101 },
    ]) {
      const res = await request(app)
        .get('/it4788/food')
        .query(query)
        .set(auth(ctx.token));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe(RC.PAGINATION_INVALID.code);
    }
  });
});
