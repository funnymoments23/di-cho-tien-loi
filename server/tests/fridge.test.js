const request = require('supertest');
const mongoose = require('mongoose');
const os = require('os');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Không gửi email thật: dùng mock như các test Auth/Tài khoản/Nhóm/Thực phẩm.
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
const emailUtil = require('../src/utils/email');
const RC = require('../src/constants/responseCode');

const USER = '/it4788/user';
const GROUP = `${USER}/group`;
const FOOD = '/it4788/food';
const FRIDGE = '/it4788/fridge';

let mongod;
let counter = 0;
const nextEmail = () => `fridge${++counter}@example.com`;

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

/** Tạo một nhóm với 3 thành viên: trưởng nhóm, thành viên, thành viên khác. */
const createGroupFixture = async () => {
  const groupAdmin = await createLoggedInUser({ username: `fadmin${++counter}` });
  const member = await createLoggedInUser({ username: `fmem${++counter}` });
  const otherMember = await createLoggedInUser({ username: `fother${++counter}` });

  await request(app)
    .post(GROUP)
    .set(auth(groupAdmin.token))
    .send({ groupName: 'Gia dinh A' });

  for (const person of [member, otherMember]) {
    await request(app)
      .post(`${GROUP}/add`)
      .set(auth(groupAdmin.token))
      .send({ username: person.username });
  }

  // Người dùng hợp lệ nhưng chưa vào nhóm nào.
  const outsider = await createLoggedInUser({ username: `fout${++counter}` });

  return { groupAdmin, member, otherMember, outsider };
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
    .send({ foodName: 'Thịt bò', quantity: 2, useWithin: '2026-11-10', ...overrides });

const updateFridgeRequest = (token, body) =>
  request(app).put(FRIDGE).set(auth(token)).send(body);

const deleteFridgeRequest = (token, body) =>
  request(app).delete(FRIDGE).set(auth(token)).send(body);

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

  await Category.create([{ name: 'Thịt' }, { name: 'Rau củ' }]);
  await Unit.create([{ name: 'kg' }, { name: 'gram' }]);

  ctx = await createGroupFixture();

  // Nhóm đã có hai thực phẩm để thêm vào tủ.
  await createFoodRequest(ctx.member.token, { foodName: 'Thịt bò' });
  await createFoodRequest(ctx.member.token, {
    foodName: 'Cà rốt',
    categoryName: 'Rau củ',
    unitName: 'gram',
  });
});

// =====================================================================
describe(`POST ${FRIDGE} — thêm thực phẩm vào tủ lạnh`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app)
      .post(FRIDGE)
      .send({ foodName: 'Thịt bò', quantity: 2, useWithin: '2026-11-10' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00190 khi thiếu toàn bộ trường', async () => {
    const res = await request(app).post(FRIDGE).set(auth(ctx.member.token)).send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FRIDGE_CREATE_INVALID_FOOD_NAME.code);
  });

  it('00190 khi foodName rỗng', async () => {
    const res = await createFridgeRequest(ctx.member.token, { foodName: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FRIDGE_CREATE_INVALID_FOOD_NAME.code);
  });

  it('00190 khi foodName quá 100 ký tự', async () => {
    const res = await createFridgeRequest(ctx.member.token, { foodName: 'a'.repeat(101) });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FRIDGE_CREATE_INVALID_FOOD_NAME.code);
  });

  it('00191 khi thiếu useWithin', async () => {
    const res = await request(app)
      .post(FRIDGE)
      .set(auth(ctx.member.token))
      .send({ foodName: 'Thịt bò', quantity: 2 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FRIDGE_CREATE_INVALID_USE_WITHIN.code);
  });

  it('00191 khi useWithin không phải ngày hợp lệ', async () => {
    const res = await createFridgeRequest(ctx.member.token, { useWithin: 'không phải ngày' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FRIDGE_CREATE_INVALID_USE_WITHIN.code);
  });

  it('00192 khi quantity <= 0 hoặc không phải số', async () => {
    const zero = await createFridgeRequest(ctx.member.token, { quantity: 0 });
    expect(zero.status).toBe(400);
    expect(zero.body.code).toBe(RC.FRIDGE_CREATE_INVALID_QUANTITY.code);

    const text = await createFridgeRequest(ctx.member.token, { quantity: 'hai' });
    expect(text.status).toBe(400);
    expect(text.body.code).toBe(RC.FRIDGE_CREATE_INVALID_QUANTITY.code);
  });

  it('00193 khi note quá 500 ký tự', async () => {
    const res = await createFridgeRequest(ctx.member.token, { note: 'a'.repeat(501) });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FRIDGE_CREATE_INVALID_NOTE.code);
  });

  it('00196 khi người dùng chưa vào nhóm', async () => {
    const res = await createFridgeRequest(ctx.outsider.token);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.FRIDGE_CREATE_NOT_IN_GROUP.code);
  });

  it('00194 khi thực phẩm không tồn tại', async () => {
    const res = await createFridgeRequest(ctx.member.token, { foodName: 'Cá hồi' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.FRIDGE_CREATE_FOOD_NOT_FOUND.code);
  });

  it('00198 khi thực phẩm thuộc nhóm khác', async () => {
    const otherGroupAdmin = await createLoggedInUser({ username: `g2${++counter}` });
    await request(app)
      .post(GROUP)
      .set(auth(otherGroupAdmin.token))
      .send({ groupName: 'Gia dinh B' });
    await createFoodRequest(otherGroupAdmin.token, { foodName: 'Cá hồi' });

    const res = await createFridgeRequest(ctx.member.token, { foodName: 'Cá hồi' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.FRIDGE_CREATE_FOOD_NOT_IN_GROUP.code);
  });

  it('00199 khi thực phẩm đã có trong tủ', async () => {
    await createFridgeRequest(ctx.member.token);
    const res = await createFridgeRequest(ctx.member.token, { quantity: 5 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(RC.FRIDGE_CREATE_EXISTS.code);
    expect(await FridgeItem.countDocuments({})).toBe(1);
  });

  it('00202 tạo thành công: lưu số lượng, hạn, vị trí, ghi chú', async () => {
    const res = await createFridgeRequest(ctx.member.token, {
      useWithin: '2026-11-10',
      quantity: 2,
      location: 'ngăn mát',
      note: 'mua ở siêu thị',
    });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(RC.FRIDGE_CREATE_SUCCESS.code);
    expect(res.body.data).toMatchObject({
      foodName: 'Thịt bò',
      categoryName: 'Thịt',
      unitName: 'kg',
      quantity: 2,
      location: 'ngăn mát',
      note: 'mua ở siêu thị',
      isNotified: false,
    });
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.foodId).toBeTruthy();

    const saved = await FridgeItem.findById(res.body.data.id);
    expect(saved.quantity).toBe(2);
    expect(saved.expiryDate.toISOString()).toBe('2026-11-10T00:00:00.000Z');
    expect(saved.isNotified).toBe(false);
  });

  it('00202 trim tên thực phẩm và ghi chú', async () => {
    const res = await createFridgeRequest(ctx.member.token, {
      foodName: '  Thịt bò  ',
      note: '  để ngăn trên  ',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.foodName).toBe('Thịt bò');
    expect(res.body.data.note).toBe('để ngăn trên');
  });

  it('00202 hai nhóm khác nhau thêm cùng tên thực phẩm của mình', async () => {
    await createFridgeRequest(ctx.member.token);

    const otherGroupAdmin = await createLoggedInUser({ username: `g2${++counter}` });
    await request(app)
      .post(GROUP)
      .set(auth(otherGroupAdmin.token))
      .send({ groupName: 'Gia dinh B' });
    await createFoodRequest(otherGroupAdmin.token, { foodName: 'Thịt bò' });

    const res = await createFridgeRequest(otherGroupAdmin.token, { foodName: 'Thịt bò' });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe(RC.FRIDGE_CREATE_SUCCESS.code);
    expect(await FridgeItem.countDocuments({})).toBe(2);
  });
});

// =====================================================================
describe(`GET ${FRIDGE} — danh sách đồ trong tủ`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).get(FRIDGE);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00225 khi người dùng chưa vào nhóm', async () => {
    const res = await request(app).get(FRIDGE).set(auth(ctx.outsider.token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.FRIDGE_GET_NOT_IN_GROUP.code);
  });

  it('00228 trả mảng rỗng khi tủ chưa có gì', async () => {
    const res = await request(app).get(FRIDGE).set(auth(ctx.member.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.FRIDGE_GET_SUCCESS.code);
    expect(res.body.data).toEqual([]);
  });

  it('00228 trả đủ thông tin thực phẩm, sắp xếp theo hạn sử dụng', async () => {
    await createFridgeRequest(ctx.member.token, { useWithin: '2026-12-01' });
    await createFridgeRequest(ctx.member.token, {
      foodName: 'Cà rốt',
      useWithin: '2026-11-05',
      quantity: 3,
    });

    const res = await request(app).get(FRIDGE).set(auth(ctx.member.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.FRIDGE_GET_SUCCESS.code);
    expect(res.body.data.map((item) => item.foodName)).toEqual(['Cà rốt', 'Thịt bò']);
    expect(res.body.data[0]).toMatchObject({
      foodName: 'Cà rốt',
      categoryName: 'Rau củ',
      unitName: 'gram',
      quantity: 3,
    });
  });

  it('00228 chỉ trả đồ trong tủ của nhóm mình', async () => {
    await createFridgeRequest(ctx.member.token);

    const otherGroupAdmin = await createLoggedInUser({ username: `g2${++counter}` });
    await request(app)
      .post(GROUP)
      .set(auth(otherGroupAdmin.token))
      .send({ groupName: 'Gia dinh B' });
    await createFoodRequest(otherGroupAdmin.token, { foodName: 'Cá hồi' });
    await createFridgeRequest(otherGroupAdmin.token, { foodName: 'Cá hồi' });

    const res = await request(app).get(FRIDGE).set(auth(ctx.member.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].foodName).toBe('Thịt bò');
  });
});

// =====================================================================
describe(`GET ${FRIDGE}/item — xem một mục trong tủ`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).get(`${FRIDGE}/item`).query({ foodName: 'Thịt bò' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00225 khi người dùng chưa vào nhóm', async () => {
    const res = await request(app)
      .get(`${FRIDGE}/item`)
      .query({ foodName: 'Thịt bò' })
      .set(auth(ctx.outsider.token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.FRIDGE_GET_NOT_IN_GROUP.code);
  });

  it('00229 khi thiếu foodName', async () => {
    const res = await request(app).get(`${FRIDGE}/item`).set(auth(ctx.member.token));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FRIDGE_ITEM_MISSING_FOOD_NAME.code);
  });

  it('00230 khi thực phẩm không tồn tại', async () => {
    const res = await request(app)
      .get(`${FRIDGE}/item`)
      .query({ foodName: 'Cá hồi' })
      .set(auth(ctx.member.token));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.FRIDGE_ITEM_FOOD_NOT_FOUND.code);
  });

  it('00232 khi thực phẩm thuộc nhóm khác', async () => {
    const otherGroupAdmin = await createLoggedInUser({ username: `g2${++counter}` });
    await request(app)
      .post(GROUP)
      .set(auth(otherGroupAdmin.token))
      .send({ groupName: 'Gia dinh B' });
    await createFoodRequest(otherGroupAdmin.token, { foodName: 'Cá hồi' });

    const res = await request(app)
      .get(`${FRIDGE}/item`)
      .query({ foodName: 'Cá hồi' })
      .set(auth(ctx.member.token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.FRIDGE_ITEM_NO_PERMISSION.code);
  });

  it('00234 khi thực phẩm có nhưng chưa được thêm vào tủ', async () => {
    const res = await request(app)
      .get(`${FRIDGE}/item`)
      .query({ foodName: 'Thịt bò' })
      .set(auth(ctx.member.token));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.FRIDGE_ITEM_NOT_CREATED.code);
  });

  it('00237 trả đúng mục trong tủ', async () => {
    await createFridgeRequest(ctx.member.token, { quantity: 4, note: 'còn tươi' });

    const res = await request(app)
      .get(`${FRIDGE}/item`)
      .query({ foodName: 'Thịt bò' })
      .set(auth(ctx.member.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.FRIDGE_ITEM_GET_SUCCESS.code);
    expect(res.body.data).toMatchObject({ foodName: 'Thịt bò', quantity: 4, note: 'còn tươi' });
  });
});

// =====================================================================
describe(`PUT ${FRIDGE} — sửa mục trong tủ`, () => {
  let itemId;

  beforeEach(async () => {
    const res = await createFridgeRequest(ctx.member.token);
    itemId = res.body.data.id;
  });

  it('00006 khi không có token', async () => {
    const res = await request(app).put(FRIDGE).send({ itemId, newQuantity: 3 });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00204 khi thiếu itemId', async () => {
    const res = await updateFridgeRequest(ctx.member.token, { newQuantity: 3 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FRIDGE_UPDATE_MISSING_ITEM_ID.code);
  });

  it('00204 khi itemId sai định dạng', async () => {
    const res = await updateFridgeRequest(ctx.member.token, {
      itemId: 'khong-phai-object-id',
      newQuantity: 3,
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FRIDGE_UPDATE_MISSING_ITEM_ID.code);
  });

  it('00204 khi không cung cấp trường nào để cập nhật', async () => {
    const res = await updateFridgeRequest(ctx.member.token, { itemId });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FRIDGE_UPDATE_NEED_ONE_FIELD.code);
  });

  it('00205 khi newUseWithin không hợp lệ', async () => {
    const res = await updateFridgeRequest(ctx.member.token, {
      itemId,
      newUseWithin: 'ngày mai',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FRIDGE_UPDATE_INVALID_USE_WITHIN.code);
  });

  it('00206 khi newQuantity <= 0 hoặc không phải số', async () => {
    const zero = await updateFridgeRequest(ctx.member.token, { itemId, newQuantity: 0 });
    expect(zero.status).toBe(400);
    expect(zero.body.code).toBe(RC.FRIDGE_UPDATE_INVALID_QUANTITY.code);

    const text = await updateFridgeRequest(ctx.member.token, { itemId, newQuantity: 'ba' });
    expect(text.status).toBe(400);
    expect(text.body.code).toBe(RC.FRIDGE_UPDATE_INVALID_QUANTITY.code);
  });

  it('00207 khi newNote quá 500 ký tự', async () => {
    const res = await updateFridgeRequest(ctx.member.token, {
      itemId,
      newNote: 'a'.repeat(501),
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FRIDGE_UPDATE_INVALID_NOTE.code);
  });

  it('00207 khi newFoodName rỗng', async () => {
    const res = await updateFridgeRequest(ctx.member.token, {
      itemId,
      newFoodName: '   ',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FRIDGE_UPDATE_INVALID_FOOD_NAME.code);
  });

  it('00210 khi người dùng chưa vào nhóm', async () => {
    const res = await updateFridgeRequest(ctx.outsider.token, { itemId, newQuantity: 3 });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.FRIDGE_UPDATE_NOT_IN_GROUP.code);
  });

  it('00213 khi mục trong tủ không tồn tại', async () => {
    const res = await updateFridgeRequest(ctx.member.token, {
      itemId: new mongoose.Types.ObjectId().toString(),
      newQuantity: 3,
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.FRIDGE_UPDATE_ITEM_NOT_FOUND.code);
  });

  it('00212 khi mục trong tủ thuộc nhóm khác', async () => {
    const otherGroupAdmin = await createLoggedInUser({ username: `g2${++counter}` });
    await request(app)
      .post(GROUP)
      .set(auth(otherGroupAdmin.token))
      .send({ groupName: 'Gia dinh B' });
    await createFoodRequest(otherGroupAdmin.token, { foodName: 'Cá hồi' });
    const other = await createFridgeRequest(otherGroupAdmin.token, { foodName: 'Cá hồi' });

    const res = await updateFridgeRequest(ctx.member.token, {
      itemId: other.body.data.id,
      newQuantity: 3,
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.FRIDGE_UPDATE_NOT_ADMIN.code);
  });

  it('00214 khi tên thực phẩm mới không tồn tại trong nhóm', async () => {
    const res = await updateFridgeRequest(ctx.member.token, {
      itemId,
      newFoodName: 'Cá hồi',
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.FRIDGE_UPDATE_NEW_FOOD_NOT_FOUND.code);
  });

  it('00199 khi thực phẩm mới đã có mục khác trong tủ', async () => {
    await createFridgeRequest(ctx.member.token, { foodName: 'Cà rốt' });

    const res = await updateFridgeRequest(ctx.member.token, {
      itemId,
      newFoodName: 'Cà rốt',
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe(RC.FRIDGE_CREATE_EXISTS.code);
  });

  it('00216 cập nhật số lượng, hạn, ghi chú, vị trí và đặt lại isNotified', async () => {
    await FridgeItem.updateOne({ _id: itemId }, { $set: { isNotified: true } });

    const res = await updateFridgeRequest(ctx.member.token, {
      itemId,
      newQuantity: 5,
      newUseWithin: '2026-12-20',
      newNote: 'mua thêm',
      newLocation: 'ngăn đá',
    });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.FRIDGE_UPDATE_SUCCESS.code);
    expect(res.body.data).toMatchObject({
      quantity: 5,
      note: 'mua thêm',
      location: 'ngăn đá',
      isNotified: false,
    });
    expect(new Date(res.body.data.useWithin).toISOString()).toBe('2026-12-20T00:00:00.000Z');
  });

  it('00216 đổi tên thực phẩm', async () => {
    const res = await updateFridgeRequest(ctx.member.token, {
      itemId,
      newFoodName: 'Cà rốt',
    });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.FRIDGE_UPDATE_SUCCESS.code);
    expect(res.body.data).toMatchObject({
      foodName: 'Cà rốt',
      categoryName: 'Rau củ',
      unitName: 'gram',
    });
  });

  it('00216 xoá ghi chú / vị trí bằng chuỗi rỗng', async () => {
    await updateFridgeRequest(ctx.member.token, {
      itemId,
      newNote: 'ghi chú',
      newLocation: 'ngăn mát',
    });

    const res = await updateFridgeRequest(ctx.member.token, {
      itemId,
      newNote: '',
      newLocation: '',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.note).toBeNull();
    expect(res.body.data.location).toBeNull();
  });
});

// =====================================================================
describe(`DELETE ${FRIDGE} — xoá mục trong tủ`, () => {
  beforeEach(async () => {
    await createFridgeRequest(ctx.member.token);
  });

  it('00006 khi không có token', async () => {
    const res = await request(app).delete(FRIDGE).send({ foodName: 'Thịt bò' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00217 khi thiếu foodName', async () => {
    const res = await deleteFridgeRequest(ctx.member.token, {});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FRIDGE_DELETE_MISSING_FOOD_NAME.code);
  });

  it('00218 khi thực phẩm không tồn tại', async () => {
    const res = await deleteFridgeRequest(ctx.member.token, { foodName: 'Cá hồi' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.FRIDGE_DELETE_FOOD_NOT_FOUND.code);
  });

  it('00219 khi thực phẩm thuộc nhóm khác', async () => {
    const otherGroupAdmin = await createLoggedInUser({ username: `g2${++counter}` });
    await request(app)
      .post(GROUP)
      .set(auth(otherGroupAdmin.token))
      .send({ groupName: 'Gia dinh B' });
    await createFoodRequest(otherGroupAdmin.token, { foodName: 'Cá hồi' });

    const res = await deleteFridgeRequest(ctx.member.token, { foodName: 'Cá hồi' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.FRIDGE_DELETE_NO_PERMISSION.code);
  });

  it('00221 khi thực phẩm chưa được thêm vào tủ', async () => {
    const res = await deleteFridgeRequest(ctx.member.token, { foodName: 'Cà rốt' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.FRIDGE_DELETE_ITEM_NOT_CREATED.code);
  });

  it('00224 xoá thành công, các mục khác giữ nguyên', async () => {
    await createFridgeRequest(ctx.member.token, { foodName: 'Cà rốt' });

    const res = await deleteFridgeRequest(ctx.member.token, { foodName: 'Thịt bò' });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.FRIDGE_DELETE_SUCCESS.code);
    expect(res.body.data.foodName).toBe('Thịt bò');
    expect(await FridgeItem.countDocuments({})).toBe(1);
  });
});

// =====================================================================
describe('Dọn dữ liệu liên quan tới tủ lạnh', () => {
  it('người cuối cùng rời nhóm thì đồ trong tủ của nhóm cũng bị xoá', async () => {
    const solo = await createLoggedInUser({ username: `solo${++counter}` });
    await request(app)
      .post(GROUP)
      .set(auth(solo.token))
      .send({ groupName: 'Gia dinh C' });
    await createFoodRequest(solo.token, { foodName: 'Trứng' });
    await createFridgeRequest(solo.token, { foodName: 'Trứng' });

    expect(await FridgeItem.countDocuments({})).toBe(1);

    const res = await request(app).post(`${GROUP}/leave`).set(auth(solo.token));
    expect(res.status).toBe(200);
    expect(await FridgeItem.countDocuments({})).toBe(0);
  });
});

// =====================================================================
describe(`GET ${FOOD}/search?inFridge= — lọc theo tủ lạnh`, () => {
  beforeEach(async () => {
    await createFridgeRequest(ctx.member.token); // chỉ "Thịt bò" ở trong tủ
  });

  it('inFridge=true chỉ trả thực phẩm đang có trong tủ', async () => {
    const res = await request(app)
      .get(`${FOOD}/search`)
      .query({ inFridge: 'true' })
      .set(auth(ctx.member.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.FOOD_GET_SUCCESS.code);
    expect(res.body.data.map((item) => item.name)).toEqual(['Thịt bò']);
  });

  it('inFridge=false chỉ trả thực phẩm chưa có trong tủ', async () => {
    const res = await request(app)
      .get(`${FOOD}/search`)
      .query({ inFridge: 'false' })
      .set(auth(ctx.member.token));

    expect(res.status).toBe(200);
    expect(res.body.data.map((item) => item.name)).toEqual(['Cà rốt']);
  });

  it('xoá thực phẩm cũng xoá mục tủ lạnh tham chiếu', async () => {
    const res = await request(app)
      .delete(FOOD)
      .set(auth(ctx.member.token))
      .send({ foodName: 'Thịt bò' });

    expect(res.status).toBe(200);
    expect(await FridgeItem.countDocuments({})).toBe(0);
  });
});
