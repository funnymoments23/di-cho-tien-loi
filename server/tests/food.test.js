const request = require('supertest');
const mongoose = require('mongoose');
const os = require('os');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Không gửi email thật: dùng mock như các test Auth/Tài khoản/Nhóm.
jest.mock('../src/utils/email', () => ({
  sendVerificationCode: jest.fn(async () => ({ delivered: false, devCode: null })),
}));

// Không gọi Cloudinary thật khi test: trả về URL giả cố định.
jest.mock('../src/config/cloudinary', () => ({
  isConfigured: () => true,
  uploadBuffer: jest.fn(async () => ({
    secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/foods/food-test.png',
    public_id: 'foods/food-test',
  })),
}));

const app = require('../src/app');
const User = require('../src/models/user.models');
const Group = require('../src/models/group.models');
const Category = require('../src/models/category.models');
const Unit = require('../src/models/unit.models');
const Food = require('../src/models/food.models');
const emailUtil = require('../src/utils/email');
const RC = require('../src/constants/responseCode');

const USER = '/it4788/user';
const GROUP = `${USER}/group`;
const FOOD = '/it4788/food';

let mongod;
let counter = 0;
const nextEmail = () => `food${++counter}@example.com`;

const codeFor = (email) => {
  const calls = emailUtil.sendVerificationCode.mock.calls.filter(
    ([to]) => to === email.toLowerCase()
  );
  return calls.length ? calls[calls.length - 1][1] : undefined;
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

/** Đăng ký + xác minh + đăng nhập; `admin` nâng role trong DB rồi đăng nhập lại. */
const createLoggedInUser = async ({ admin = false, username, name = 'Nguyen Van A' } = {}) => {
  const payload = { email: nextEmail(), password: 'matkhau123', name };

  const registerRes = await request(app).post(USER).send(payload);
  await request(app)
    .post(`${USER}/verify-email`)
    .send({ code: codeFor(payload.email), token: registerRes.body.data.verificationToken });

  if (admin) await User.updateOne({ email: payload.email }, { $set: { role: 'admin' } });

  const loginRes = await request(app)
    .post(`${USER}/login`)
    .send({ email: payload.email, password: payload.password });

  const token = loginRes.body.data.accessToken;
  if (username) await request(app).put(USER).set(auth(token)).send({ username });

  return { user: loginRes.body.data.user, token, username };
};

/** Tạo một nhóm với 3 thành viên: trưởng nhóm, thành viên tạo món, thành viên khác. */
const createGroupFixture = async () => {
  const groupAdmin = await createLoggedInUser({ username: `gadmin${++counter}` });
  const member = await createLoggedInUser({ username: `gmem${++counter}` });
  const otherMember = await createLoggedInUser({ username: `gother${++counter}` });

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
  const outsider = await createLoggedInUser({ username: `outsider${++counter}` });

  return { groupAdmin, member, otherMember, outsider };
};

const createFoodRequest = (token, overrides = {}) =>
  request(app)
    .post(FOOD)
    .set(auth(token))
    .send({ foodName: 'Thịt bò', categoryName: 'Thịt', unitName: 'kg', ...overrides });

const updateFoodRequest = (token, body) =>
  request(app).put(FOOD).set(auth(token)).send(body);

const deleteFoodRequest = (token, body) =>
  request(app).delete(FOOD).set(auth(token)).send(body);

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  // Workaround: mongoose >= 9.10 + Jest 30 chặn dynamic import của driver.
  await mongoose.connect(mongod.getUri(), { runtimeAdapters: { os } });
  await User.init();
  await Group.init();
  await Category.init();
  await Unit.init();
  await Food.init();
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

  // Danh mục / đơn vị dùng chung; tạo trực tiếp vì CRUD của chúng đã có test riêng.
  await Category.create([{ name: 'Thịt' }, { name: 'Rau củ' }]);
  await Unit.create([{ name: 'kg' }, { name: 'gram' }]);

  ctx = await createGroupFixture();
});

// =====================================================================
describe(`GET ${FOOD} — danh sách thực phẩm của nhóm`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app).get(FOOD);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00185 khi người dùng chưa vào nhóm', async () => {
    const res = await request(app).get(FOOD).set(auth(ctx.outsider.token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.FOOD_GET_NOT_IN_GROUP.code);
  });

  it('00188 trả mảng rỗng khi nhóm chưa có thực phẩm', async () => {
    const res = await request(app).get(FOOD).set(auth(ctx.member.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.FOOD_GET_SUCCESS.code);
    expect(res.body.data).toEqual([]);
  });

  it('00188 trả thực phẩm kèm tên danh mục/đơn vị, sắp xếp theo tên', async () => {
    await createFoodRequest(ctx.member.token, { foodName: 'Thịt bò' });
    await createFoodRequest(ctx.member.token, {
      foodName: 'Cà rốt',
      categoryName: 'Rau củ',
      unitName: 'gram',
    });

    const res = await request(app).get(FOOD).set(auth(ctx.member.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.FOOD_GET_SUCCESS.code);
    expect(res.body.data.map((item) => item.name)).toEqual(['Cà rốt', 'Thịt bò']);
    expect(res.body.data[0]).toMatchObject({
      categoryName: 'Rau củ',
      unitName: 'gram',
    });
    expect(res.body.data[0].categoryId).toBeTruthy();
    expect(res.body.data[0].unitId).toBeTruthy();
  });

  it('00188 chỉ trả thực phẩm của nhóm mình, không lẫn nhóm khác', async () => {
    await createFoodRequest(ctx.member.token);

    const otherGroupAdmin = await createLoggedInUser({ username: `g2${++counter}` });
    await request(app)
      .post(GROUP)
      .set(auth(otherGroupAdmin.token))
      .send({ groupName: 'Gia dinh B' });
    await createFoodRequest(otherGroupAdmin.token, { foodName: 'Cá hồi' });

    const res = await request(app).get(FOOD).set(auth(ctx.member.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Thịt bò');
  });
});

// =====================================================================
describe(`GET ${FOOD}/search — tìm kiếm thực phẩm`, () => {
  beforeEach(async () => {
    await createFoodRequest(ctx.member.token, { foodName: 'Thịt bò' });
    await createFoodRequest(ctx.member.token, {
      foodName: 'Cà rốt',
      categoryName: 'Rau củ',
      unitName: 'gram',
    });
  });

  it('00006 khi không có token', async () => {
    const res = await request(app).get(`${FOOD}/search?keyword=thịt`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00185 khi người dùng chưa vào nhóm', async () => {
    const res = await request(app).get(`${FOOD}/search`).set(auth(ctx.outsider.token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.FOOD_GET_NOT_IN_GROUP.code);
  });

  it('00188 lọc theo từ khoá, không phân biệt hoa/thường', async () => {
    const res = await request(app)
      .get(`${FOOD}/search`)
      .query({ keyword: 'THỊT' })
      .set(auth(ctx.member.token));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.FOOD_GET_SUCCESS.code);
    expect(res.body.data.map((item) => item.name)).toEqual(['Thịt bò']);
  });

  it('00188 lọc theo danh mục', async () => {
    const res = await request(app)
      .get(`${FOOD}/search`)
      .query({ categoryName: 'Rau củ' })
      .set(auth(ctx.member.token));

    expect(res.status).toBe(200);
    expect(res.body.data.map((item) => item.name)).toEqual(['Cà rốt']);
  });

  it('00188 trả mảng rỗng khi danh mục không tồn tại', async () => {
    const res = await request(app)
      .get(`${FOOD}/search`)
      .query({ categoryName: 'Không có' })
      .set(auth(ctx.member.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('00188 từ khoá chứa ký tự đặc biệt không làm lỗi truy vấn', async () => {
    const res = await request(app)
      .get(`${FOOD}/search`)
      .query({ keyword: '.*[(' })
      .set(auth(ctx.member.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// =====================================================================
describe(`POST ${FOOD} — tạo thực phẩm`, () => {
  it('00006 khi không có token', async () => {
    const res = await request(app)
      .post(FOOD)
      .send({ foodName: 'Thịt bò', categoryName: 'Thịt', unitName: 'kg' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00147 khi thiếu toàn bộ trường', async () => {
    const res = await request(app).post(FOOD).set(auth(ctx.member.token)).send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FOOD_CREATE_MISSING_FIELDS.code);
  });

  it('00147 khi tên thực phẩm rỗng', async () => {
    // Chuỗi rỗng sau trim được coi là thiếu trường (giống category/unit),
    // còn tên quá dài là sai định dạng -> 00148.
    const blank = await createFoodRequest(ctx.member.token, { foodName: '   ' });
    expect(blank.status).toBe(400);
    expect(blank.body.code).toBe(RC.FOOD_CREATE_MISSING_FIELDS.code);
  });

  it('00148 khi tên thực phẩm quá 100 ký tự', async () => {
    const tooLong = await createFoodRequest(ctx.member.token, { foodName: 'a'.repeat(101) });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.code).toBe(RC.FOOD_CREATE_INVALID_NAME.code);
  });

  it('00149 khi thiếu tên danh mục', async () => {
    const res = await request(app)
      .post(FOOD)
      .set(auth(ctx.member.token))
      .send({ foodName: 'Thịt bò', unitName: 'kg' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FOOD_CREATE_MISSING_CATEGORY.code);
  });

  it('00150 khi thiếu tên đơn vị', async () => {
    const res = await request(app)
      .post(FOOD)
      .set(auth(ctx.member.token))
      .send({ foodName: 'Thịt bò', categoryName: 'Thịt' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FOOD_CREATE_MISSING_UNIT.code);
  });

  it('00156 khi người dùng chưa vào nhóm', async () => {
    const res = await createFoodRequest(ctx.outsider.token);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.FOOD_CREATE_NOT_IN_GROUP.code);
  });

  it('00153 khi đơn vị không tồn tại', async () => {
    const res = await createFoodRequest(ctx.member.token, { unitName: 'tấn' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.FOOD_CREATE_UNIT_NOT_FOUND.code);
  });

  it('00155 khi danh mục không tồn tại', async () => {
    const res = await createFoodRequest(ctx.member.token, { categoryName: 'Hải sản' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.FOOD_CREATE_CATEGORY_NOT_FOUND.code);
  });

  it('00151 khi tên đã tồn tại trong nhóm (kể cả sau khi trim)', async () => {
    await createFoodRequest(ctx.member.token);
    const res = await createFoodRequest(ctx.member.token, { foodName: '  Thịt bò  ' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(RC.FOOD_CREATE_EXISTS.code);
    expect(await Food.countDocuments({})).toBe(1);
  });

  it('00160 tạo thành công: tên được trim, gắn nhóm và người tạo', async () => {
    const res = await createFoodRequest(ctx.member.token, {
      foodName: '  Thịt bò  ',
      categoryName: 'Thịt',
      unitName: 'kg',
    });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(RC.FOOD_CREATE_SUCCESS.code);
    expect(res.body.data).toMatchObject({
      name: 'Thịt bò',
      categoryName: 'Thịt',
      unitName: 'kg',
      image: null,
    });
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.createdBy).toBeTruthy();

    const saved = await Food.findById(res.body.data.id);
    expect(saved.name).toBe('Thịt bò');
    expect(saved.groupId).toBeTruthy();
  });

  it('00160 cho phép hai nhóm khác nhau dùng cùng tên thực phẩm', async () => {
    await createFoodRequest(ctx.member.token);

    const otherGroupAdmin = await createLoggedInUser({ username: `g2${++counter}` });
    await request(app)
      .post(GROUP)
      .set(auth(otherGroupAdmin.token))
      .send({ groupName: 'Gia dinh B' });

    const res = await createFoodRequest(otherGroupAdmin.token, { foodName: 'Thịt bò' });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe(RC.FOOD_CREATE_SUCCESS.code);
    expect(await Food.countDocuments({ name: 'Thịt bò' })).toBe(2);
  });

  it('00160 nhận ảnh multipart/form-data ở field `image`', async () => {
    const res = await request(app)
      .post(FOOD)
      .set(auth(ctx.member.token))
      .field('foodName', 'Thịt bò')
      .field('categoryName', 'Thịt')
      .field('unitName', 'kg')
      .attach('image', Buffer.from('fake-png-bytes'), 'food.png');

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(RC.FOOD_CREATE_SUCCESS.code);
    expect(res.body.data.image).toMatch(/^https:\/\/res\.cloudinary\.com\/.+\.png$/);
  });

  it('00158 khi tệp tải lên không phải ảnh', async () => {
    const res = await request(app)
      .post(FOOD)
      .set(auth(ctx.member.token))
      .field('foodName', 'Thịt bò')
      .field('categoryName', 'Thịt')
      .field('unitName', 'kg')
      .attach('image', Buffer.from('not-an-image'), 'note.txt');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FOOD_CREATE_UPLOAD_FAILED.code);
  });
});

// =====================================================================
describe(`PUT ${FOOD} — sửa thực phẩm`, () => {
  beforeEach(async () => {
    await createFoodRequest(ctx.member.token);
  });

  it('00006 khi không có token', async () => {
    const res = await request(app).put(FOOD).send({ foodName: 'Thịt bò', newName: 'Thịt heo' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00161 khi thiếu foodName', async () => {
    const res = await updateFoodRequest(ctx.member.token, { newName: 'Thịt heo' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FOOD_UPDATE_MISSING_FIELDS.code);
  });

  it('00161 khi foodName rỗng', async () => {
    // Chuỗi rỗng sau trim được coi là thiếu trường, đồng nhất với các API khác.
    const res = await updateFoodRequest(ctx.member.token, { foodName: '   ', newName: 'Thịt heo' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FOOD_UPDATE_MISSING_FIELDS.code);
  });

  it('00162 khi foodName quá 100 ký tự', async () => {
    const res = await updateFoodRequest(ctx.member.token, {
      foodName: 'a'.repeat(101),
      newName: 'Thịt heo',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FOOD_UPDATE_INVALID_NAME.code);
  });

  it('00163 khi không cung cấp trường nào để cập nhật', async () => {
    const res = await updateFoodRequest(ctx.member.token, { foodName: 'Thịt bò' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FOOD_UPDATE_NEED_ONE_FIELD.code);
  });

  it('00166 khi newName rỗng', async () => {
    const res = await updateFoodRequest(ctx.member.token, { foodName: 'Thịt bò', newName: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FOOD_UPDATE_INVALID_NEW_NAME.code);
  });

  it('00164 khi newCategory rỗng', async () => {
    const res = await updateFoodRequest(ctx.member.token, {
      foodName: 'Thịt bò',
      newCategory: '   ',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FOOD_UPDATE_INVALID_CATEGORY.code);
  });

  it('00165 khi newUnit rỗng', async () => {
    const res = await updateFoodRequest(ctx.member.token, { foodName: 'Thịt bò', newUnit: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FOOD_UPDATE_INVALID_UNIT.code);
  });

  it('00167 khi thực phẩm không tồn tại', async () => {
    const res = await updateFoodRequest(ctx.member.token, {
      foodName: 'Không có',
      newName: 'Mới',
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.FOOD_UPDATE_NOT_FOUND.code);
  });

  it('00167 khi không phải người tạo và không phải trưởng nhóm', async () => {
    const res = await updateFoodRequest(ctx.otherMember.token, {
      foodName: 'Thịt bò',
      newName: 'Thịt heo',
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.FOOD_UPDATE_NO_PERMISSION.code);
  });

  it('00169 khi đơn vị mới không tồn tại', async () => {
    const res = await updateFoodRequest(ctx.member.token, {
      foodName: 'Thịt bò',
      newUnit: 'tấn',
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.FOOD_UPDATE_UNIT_NOT_FOUND.code);
  });

  it('00171 khi danh mục mới không tồn tại', async () => {
    const res = await updateFoodRequest(ctx.member.token, {
      foodName: 'Thịt bò',
      newCategory: 'Hải sản',
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.FOOD_UPDATE_CATEGORY_NOT_FOUND.code);
  });

  it('00173 khi tên mới đã tồn tại trong nhóm', async () => {
    await createFoodRequest(ctx.member.token, { foodName: 'Cà rốt', categoryName: 'Rau củ' });

    const res = await updateFoodRequest(ctx.member.token, {
      foodName: 'Thịt bò',
      newName: 'Cà rốt',
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe(RC.FOOD_UPDATE_NAME_EXISTS.code);
    expect(await Food.exists({ name: 'Thịt bò' })).toBeTruthy();
  });

  it('00178 người tạo sửa được tên, danh mục và đơn vị', async () => {
    const res = await updateFoodRequest(ctx.member.token, {
      foodName: 'Thịt bò',
      newName: 'Thịt heo',
      newCategory: 'Rau củ',
      newUnit: 'gram',
    });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.FOOD_UPDATE_SUCCESS.code);
    expect(res.body.data).toMatchObject({
      name: 'Thịt heo',
      categoryName: 'Rau củ',
      unitName: 'gram',
    });
  });

  it('00178 trưởng nhóm sửa được thực phẩm do thành viên tạo', async () => {
    const res = await updateFoodRequest(ctx.groupAdmin.token, {
      foodName: 'Thịt bò',
      newName: 'Thịt bò Úc',
    });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.FOOD_UPDATE_SUCCESS.code);
    expect(res.body.data.name).toBe('Thịt bò Úc');
  });

  it('00178 chỉ cập nhật ảnh cũng hợp lệ', async () => {
    const res = await request(app)
      .put(FOOD)
      .set(auth(ctx.member.token))
      .field('foodName', 'Thịt bò')
      .attach('image', Buffer.from('fake-png-bytes'), 'new.png');

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.FOOD_UPDATE_SUCCESS.code);
    expect(res.body.data.image).toMatch(/^https:\/\/res\.cloudinary\.com\/.+\.png$/);
  });
});

// =====================================================================
describe(`DELETE ${FOOD} — xoá thực phẩm`, () => {
  beforeEach(async () => {
    await createFoodRequest(ctx.member.token);
  });

  it('00006 khi không có token', async () => {
    const res = await request(app).delete(FOOD).send({ foodName: 'Thịt bò' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(RC.NO_TOKEN.code);
  });

  it('00179 khi thiếu foodName', async () => {
    const res = await deleteFoodRequest(ctx.member.token, {});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(RC.FOOD_DELETE_MISSING_NAME.code);
  });

  it('00180 khi thực phẩm không tồn tại', async () => {
    const res = await deleteFoodRequest(ctx.member.token, { foodName: 'Không có' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe(RC.FOOD_DELETE_NOT_FOUND.code);
  });

  it('00181 khi không phải người tạo và không phải trưởng nhóm', async () => {
    const res = await deleteFoodRequest(ctx.otherMember.token, { foodName: 'Thịt bò' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(RC.FOOD_DELETE_NO_PERMISSION.code);
    expect(await Food.countDocuments({})).toBe(1);
  });

  it('00184 người tạo xoá được thực phẩm của mình', async () => {
    const res = await deleteFoodRequest(ctx.member.token, { foodName: 'Thịt bò' });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.FOOD_DELETE_SUCCESS.code);
    expect(res.body.data.name).toBe('Thịt bò');
    expect(await Food.countDocuments({})).toBe(0);
  });

  it('00184 trưởng nhóm xoá được thực phẩm do thành viên tạo', async () => {
    const res = await deleteFoodRequest(ctx.groupAdmin.token, { foodName: 'Thịt bò' });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(RC.FOOD_DELETE_SUCCESS.code);
    expect(await Food.countDocuments({})).toBe(0);
  });
});
