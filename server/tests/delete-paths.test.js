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
let counter = 0;
let ctx;

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const createUser = async ({ role = 'user' } = {}) => {
  const id = ++counter;
  return User.create({
    email: `del${id}@example.com`,
    password: await bcrypt.hash('matkhau123', 4),
    name: `Người dùng ${id}`,
    username: `deluser${id}`,
    isVerified: true,
    role,
  });
};

const buildFixture = async () => {
  const admin = await createUser({ role: 'admin' });
  const member = await createUser();
  const group = await Group.create({
    name: 'Gia đình Delete',
    adminId: admin._id,
    members: [admin._id, member._id],
  });
  await User.updateMany(
    { _id: { $in: [admin._id, member._id] } },
    { $set: { groupId: group._id } }
  );

  const category = await Category.create({ name: `Thịt ${++counter}` });
  const unit = await Unit.create({ name: `kg${++counter}` });
  const categoryToDelete = await Category.create({ name: `Rau ${++counter}` });
  const unitToDelete = await Unit.create({ name: `hộp${++counter}` });

  const food = await Food.create({
    name: `Thịt bò ${++counter}`,
    categoryId: category._id,
    unitId: unit._id,
    groupId: group._id,
    createdBy: admin._id,
  });
  const fridge = await FridgeItem.create({
    foodId: food._id,
    groupId: group._id,
    quantity: 2,
    expiryDate: new Date('2030-01-01'),
  });
  const list = await ShoppingList.create({
    name: 'Đi chợ',
    groupId: group._id,
    assignedTo: member._id,
    createdBy: admin._id,
  });
  const task = await Task.create({
    listId: list._id,
    foodId: food._id,
    quantity: 1,
  });
  const meal = await MealPlan.create({
    groupId: group._id,
    foodId: food._id,
    timestamp: new Date('2026-11-02'),
    name: 'sáng',
  });
  const recipe = await Recipe.create({
    foodId: food._id,
    groupId: group._id,
    name: 'Thịt bò xào',
    description: 'Mô tả',
    htmlContent: '<p>Cách làm</p>',
  });

  return {
    admin,
    member,
    group,
    token: signAccessToken(admin),
    categoryToDelete,
    unitToDelete,
    food,
    fridge,
    list,
    task,
    meal,
    recipe,
  };
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

describe('DELETE bằng path param', () => {
  it('DELETE /food/:id', async () => {
    const res = await request(app)
      .delete(`/it4788/food/${ctx.food._id}`)
      .set(auth(ctx.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.FOOD_DELETE_SUCCESS.code);
    expect(await Food.findById(ctx.food._id)).toBeNull();
  });

  it('DELETE /fridge/:itemId', async () => {
    const res = await request(app)
      .delete(`/it4788/fridge/${ctx.fridge._id}`)
      .set(auth(ctx.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.FRIDGE_DELETE_SUCCESS.code);
    expect(await FridgeItem.findById(ctx.fridge._id)).toBeNull();
  });

  it('DELETE /shopping/:listId', async () => {
    const res = await request(app)
      .delete(`/it4788/shopping/${ctx.list._id}`)
      .set(auth(ctx.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.SHOPPING_DELETE_SUCCESS.code);
    expect(await ShoppingList.findById(ctx.list._id)).toBeNull();
    expect(await Task.countDocuments({ listId: ctx.list._id })).toBe(0);
  });

  it('DELETE /shopping/task/:taskId', async () => {
    const res = await request(app)
      .delete(`/it4788/shopping/task/${ctx.task._id}`)
      .set(auth(ctx.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.TASK_DELETE_SUCCESS.code);
    expect(await Task.findById(ctx.task._id)).toBeNull();
  });

  it('DELETE /meal/:planId', async () => {
    const res = await request(app)
      .delete(`/it4788/meal/${ctx.meal._id}`)
      .set(auth(ctx.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.MEAL_DELETE_SUCCESS.code);
    expect(await MealPlan.findById(ctx.meal._id)).toBeNull();
  });

  it('DELETE /recipe/:recipeId', async () => {
    const res = await request(app)
      .delete(`/it4788/recipe/${ctx.recipe._id}`)
      .set(auth(ctx.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.RECIPE_DELETE_SUCCESS.code);
    expect(await Recipe.findById(ctx.recipe._id)).toBeNull();
  });

  it('DELETE /user/group/:username', async () => {
    const res = await request(app)
      .delete(`/it4788/user/group/${ctx.member.username}`)
      .set(auth(ctx.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.GROUP_DELETE_MEMBER_SUCCESS.code);
    expect((await User.findById(ctx.member._id)).groupId).toBeNull();
  });

  it('DELETE /admin/category/:name', async () => {
    const res = await request(app)
      .delete(`/it4788/admin/category/${encodeURIComponent(ctx.categoryToDelete.name)}`)
      .set(auth(ctx.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.CATEGORY_DELETE_SUCCESS.code);
    expect(await Category.findById(ctx.categoryToDelete._id)).toBeNull();
  });

  it('DELETE /admin/unit/:name', async () => {
    const res = await request(app)
      .delete(`/it4788/admin/unit/${encodeURIComponent(ctx.unitToDelete.name)}`)
      .set(auth(ctx.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.UNIT_DELETE_SUCCESS.code);
    expect(await Unit.findById(ctx.unitToDelete._id)).toBeNull();
  });
});
