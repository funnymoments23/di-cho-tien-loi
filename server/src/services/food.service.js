const mongoose = require('mongoose');
const Food = require('../models/food.models');
const Category = require('../models/category.models');
const Unit = require('../models/unit.models');
const User = require('../models/user.models');
const Group = require('../models/group.models');
const FridgeItem = require('../models/fridgeItem.models');
const RC = require('../constants/responseCode');
const { fail } = require('../utils/response');
const { toPublicFood } = require('../utils/serializers');

// Luôn lấy kèm tên danh mục / đơn vị để response dễ dùng ở client.
const FOOD_POPULATE = [
  { path: 'categoryId', select: 'name' },
  { path: 'unitId', select: 'name' },
];

/** id lấy từ token luôn là ObjectId, vẫn kiểm tra để trả đúng mã thay vì CastError. */
const assertValidId = (userId) => {
  if (!mongoose.isValidObjectId(userId)) throw fail(RC.INVALID_USER_ID); // 00007
};

/**
 * Lấy nhóm hiện tại của người dùng.
 * Mỗi nhóm API có mã "chưa vào nhóm" riêng (00156, 00185...), nên mã được truyền vào.
 */
const loadGroupContext = async (userId, notInGroupCode) => {
  assertValidId(userId);
  const user = await User.findById(userId).select('groupId');
  if (!user) throw fail(RC.USER_NOT_FOUND); // 00052
  if (!user.groupId) throw fail(notInGroupCode);

  const group = await Group.findById(user.groupId);
  if (!group) {
    // groupId trỏ tới nhóm đã bị xoá (dữ liệu không nhất quán): dọn tham chiếu.
    await User.updateOne({ _id: user._id }, { $set: { groupId: null } });
    throw fail(notInGroupCode);
  }

  return { user, group };
};

/** Người dùng được sửa/xoá thực phẩm nếu là người tạo hoặc trưởng nhóm. */
const canManageFood = (food, user, group) =>
  Boolean(food.createdBy && food.createdBy.equals(user._id)) || group.adminId.equals(user._id);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findFoodOrFail = async (groupId, foodName, notFoundCode) => {
  const food = await Food.findOne({ groupId, name: foodName });
  if (!food) throw fail(notFoundCode);
  return food;
};

/**
 * GET /food — toàn bộ thực phẩm của nhóm, sắp xếp theo tên.
 * `filters.keyword` / `filters.categoryName` phục vụ chung cho GET /food/search.
 */
const getFoods = async (userId, filters = {}) => {
  const { group } = await loadGroupContext(userId, RC.FOOD_GET_NOT_IN_GROUP); // 00185

  // Query có thể là mảng nếu client gửi lặp tham số (?keyword=a&keyword=b):
  // chỉ nhận giá trị chuỗi để tránh lỗi truy vấn.
  const keyword = typeof filters.keyword === 'string' ? filters.keyword.trim() : '';
  const categoryName =
    typeof filters.categoryName === 'string' ? filters.categoryName.trim() : '';

  const query = { groupId: group._id };

  if (keyword) {
    query.name = new RegExp(escapeRegex(keyword), 'i');
  }

  if (categoryName) {
    const category = await Category.findOne({ name: categoryName });
    // Danh mục không tồn tại thì chắc chắn không có thực phẩm nào khớp.
    if (!category) return [];
    query.categoryId = category._id;
  }

  // `inFridge=true|false` chỉ lọc thực phẩm đang có / không có trong tủ lạnh
  // của nhóm (API bổ sung GET /food/search, docs/02 mục 3.1).
  const inFridge = typeof filters.inFridge === 'string' ? filters.inFridge.trim().toLowerCase() : '';
  if (inFridge === 'true' || inFridge === 'false') {
    const fridgeFoodIds = await FridgeItem.distinct('foodId', { groupId: group._id });
    query._id = inFridge === 'true' ? { $in: fridgeFoodIds } : { $nin: fridgeFoodIds };
  }

  const foods = await Food.find(query).populate(FOOD_POPULATE).sort({ name: 1 });
  return foods.map(toPublicFood);
};

/** GET /food/search — tìm theo từ khoá tên và/hoặc danh mục. */
const searchFoods = async (userId, filters = {}) => getFoods(userId, filters);

/**
 * POST /food — tạo thực phẩm trong nhóm.
 * Thứ tự kiểm tra theo đặc tả: trùng tên (00151) -> đơn vị (00153) -> danh mục (00155).
 */
const createFood = async (userId, { foodName, categoryName, unitName, image }) => {
  const { user, group } = await loadGroupContext(userId, RC.FOOD_CREATE_NOT_IN_GROUP); // 00156

  if (await Food.exists({ groupId: group._id, name: foodName })) {
    throw fail(RC.FOOD_CREATE_EXISTS); // 00151
  }

  const unit = await Unit.findOne({ name: unitName });
  if (!unit) throw fail(RC.FOOD_CREATE_UNIT_NOT_FOUND); // 00153

  const category = await Category.findOne({ name: categoryName });
  if (!category) throw fail(RC.FOOD_CREATE_CATEGORY_NOT_FOUND); // 00155

  try {
    const food = await Food.create({
      name: foodName,
      categoryId: category._id,
      unitId: unit._id,
      image: image || null,
      groupId: group._id,
      createdBy: user._id,
    });

    await food.populate(FOOD_POPULATE);
    return toPublicFood(food);
  } catch (err) {
    // Hai request tạo cùng tên đồng thời: unique index chặn ở DB.
    if (err.code === 11000) throw fail(RC.FOOD_CREATE_EXISTS); // 00151
    throw err;
  }
};

/**
 * PUT /food — sửa tên / danh mục / đơn vị / ảnh.
 * Chỉ người tạo hoặc trưởng nhóm được sửa (00167 — FORBIDDEN).
 */
const updateFood = async (userId, payload) => {
  const { foodName, newName, newCategory, newUnit, image } = payload;

  const { user, group } = await loadGroupContext(userId, RC.FOOD_UPDATE_NOT_FOUND); // 00167

  // Không có trường nào để cập nhật (ảnh tính là một trường).
  if (newName === undefined && newCategory === undefined && newUnit === undefined && image === undefined) {
    throw fail(RC.FOOD_UPDATE_NEED_ONE_FIELD); // 00163
  }

  // Ba trường mới được gửi nhưng rỗng: mã lỗi riêng cho từng trường.
  if (newName !== undefined && !newName) throw fail(RC.FOOD_UPDATE_INVALID_NEW_NAME); // 00166
  if (newCategory !== undefined && !newCategory) throw fail(RC.FOOD_UPDATE_INVALID_CATEGORY); // 00164
  if (newUnit !== undefined && !newUnit) throw fail(RC.FOOD_UPDATE_INVALID_UNIT); // 00165

  const food = await findFoodOrFail(group._id, foodName, RC.FOOD_UPDATE_NOT_FOUND); // 00167

  if (!canManageFood(food, user, group)) {
    throw fail(RC.FOOD_UPDATE_NO_PERMISSION); // 00167 (403)
  }

  if (newCategory !== undefined) {
    const category = await Category.findOne({ name: newCategory });
    if (!category) throw fail(RC.FOOD_UPDATE_CATEGORY_NOT_FOUND); // 00171
    food.categoryId = category._id;
  }

  if (newUnit !== undefined) {
    const unit = await Unit.findOne({ name: newUnit });
    if (!unit) throw fail(RC.FOOD_UPDATE_UNIT_NOT_FOUND); // 00169
    food.unitId = unit._id;
  }

  if (newName !== undefined && newName !== food.name) {
    if (await Food.exists({ groupId: group._id, name: newName, _id: { $ne: food._id } })) {
      throw fail(RC.FOOD_UPDATE_NAME_EXISTS); // 00173
    }
    food.name = newName;
  }

  if (image !== undefined) food.image = image || null;

  try {
    await food.save();
  } catch (err) {
    if (err.code === 11000) throw fail(RC.FOOD_UPDATE_NAME_EXISTS); // 00173
    throw err;
  }

  await food.populate(FOOD_POPULATE);
  return toPublicFood(food);
};

/**
 * DELETE /food — xoá thực phẩm theo tên.
 * Chỉ người tạo hoặc trưởng nhóm được xoá (00181).
 */
const deleteFood = async (userId, { foodName }) => {
  const { user, group } = await loadGroupContext(userId, RC.FOOD_DELETE_NOT_FOUND); // 00180

  const food = await findFoodOrFail(group._id, foodName, RC.FOOD_DELETE_NOT_FOUND); // 00180

  if (!canManageFood(food, user, group)) {
    throw fail(RC.FOOD_DELETE_NO_PERMISSION); // 00181
  }

  await food.populate(FOOD_POPULATE);
  const data = toPublicFood(food);
  await Food.deleteOne({ _id: food._id });
  // Dọn mục tủ lạnh tham chiếu tới thực phẩm vừa xoá để không còn bản ghi mồ côi.
  await FridgeItem.deleteMany({ foodId: food._id });
  return data;
};

module.exports = {
  getFoods,
  searchFoods,
  createFood,
  updateFood,
  deleteFood,
};
