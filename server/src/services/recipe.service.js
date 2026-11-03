const mongoose = require('mongoose');
const Recipe = require('../models/recipe.models');
const Food = require('../models/food.models');
const User = require('../models/user.models');
const Group = require('../models/group.models');
const RC = require('../constants/responseCode');
const { fail } = require('../utils/response');
const { parsePagination, pageResult, applyPagination } = require('../utils/pagination');
const { toPublicRecipe } = require('../utils/serializers');

// Luôn lấy kèm tên / ảnh của món để client hiển thị trực tiếp.
const RECIPE_POPULATE = [
  { path: 'foodId', select: 'name image' },
  {
    path: 'ingredients.foodId',
    select: 'name image unitId',
    populate: { path: 'unitId', select: 'name' },
  },
];

/** id lấy từ token luôn là ObjectId, vẫn kiểm tra để trả đúng mã thay vì CastError. */
const assertValidId = (userId) => {
  if (!mongoose.isValidObjectId(userId)) throw fail(RC.INVALID_USER_ID); // 00007
};

// Query có thể là mảng khi client lặp tham số: chỉ nhận giá trị chuỗi.
const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Lấy nhóm hiện tại của người dùng.
 * Recipe không có mã "chưa vào nhóm" riêng nên dùng mã nhóm chung 00096.
 */
const loadGroupContext = async (userId) => {
  assertValidId(userId);
  const user = await User.findById(userId).select('groupId');
  if (!user) throw fail(RC.USER_NOT_FOUND); // 00052
  if (!user.groupId) throw fail(RC.GROUP_NOT_IN_GROUP); // 00096

  const group = await Group.findById(user.groupId);
  if (!group) {
    // groupId trỏ tới nhóm đã bị xoá (dữ liệu không nhất quán): dọn tham chiếu.
    await User.updateOne({ _id: user._id }, { $set: { groupId: null } });
    throw fail(RC.GROUP_NOT_IN_GROUP); // 00096
  }

  return { user, group };
};

/**
 * GET /recipe — công thức của nhóm.
 * Đặc tả dùng `?foodId=`; nhóm bổ sung thêm `?foodName=` cho đồng nhất với các
 * API thực phẩm khác (docs/02 mục 2.5). Không truyền tham số thì trả tất cả.
 */
const getRecipes = async (userId, filters = {}) => {
  const { group } = await loadGroupContext(userId); // 00096
  const pagination = parsePagination(filters);

  const query = { groupId: group._id };
  const foodId = normalizeText(filters.foodId);
  const foodName = normalizeText(filters.foodName);

  if (foodId) {
    // foodId sai định dạng thì chắc chắn không có công thức nào khớp.
    if (!mongoose.isValidObjectId(foodId)) {
      return pagination ? pageResult([], 0, pagination) : [];
    }
    query.foodId = foodId;
  } else if (foodName) {
    const food = await Food.findOne({ groupId: group._id, name: foodName });
    if (!food) return pagination ? pageResult([], 0, pagination) : [];
    query.foodId = food._id;
  }

  const total = pagination ? await Recipe.countDocuments(query) : null;
  const recipeQuery = Recipe.find(query).populate(RECIPE_POPULATE).sort({ name: 1 });
  const recipes = await applyPagination(recipeQuery, pagination).then((rows) =>
    rows.map(toPublicRecipe)
  );

  return pagination ? pageResult(recipes, total, pagination) : recipes;
};

/**
 * POST /recipe — thêm công thức cho một món ăn của nhóm.
 * Mọi thành viên trong nhóm đều được quản lý công thức (docs/01 mục 5).
 * Thứ tự kiểm tra: đã vào nhóm (00096) -> thực phẩm tồn tại (00354).
 */
/**
 * Chuẩn hoá danh sách nguyên liệu: tìm thực phẩm theo tên trong nhóm,
 * bỏ nguyên liệu trùng tên và trả về mảng { foodId, quantity }.
 */
const resolveIngredients = async (groupId, inputs = [], notFoundCode) => {
  if (!Array.isArray(inputs) || inputs.length === 0) return [];

  const unique = [];
  const seen = new Set();
  for (const input of inputs) {
    const foodName = normalizeText(input?.foodName);
    if (!foodName || seen.has(foodName)) continue;
    seen.add(foodName);
    unique.push({ foodName, quantity: input.quantity });
  }

  const foods = await Food.find({
    groupId,
    name: { $in: unique.map((item) => item.foodName) },
  }).select('name');
  const byName = new Map(foods.map((food) => [food.name, food]));

  return unique.map((item) => {
    const food = byName.get(item.foodName);
    if (!food) throw fail(notFoundCode);
    return { foodId: food._id, quantity: item.quantity };
  });
};

const createRecipe = async (
  userId,
  { foodName, name, description, htmlContent, ingredients }
) => {
  const { user, group } = await loadGroupContext(userId); // 00096

  const food = await Food.findOne({ groupId: group._id, name: normalizeText(foodName) });
  if (!food) throw fail(RC.RECIPE_CREATE_FOOD_NOT_FOUND); // 00354

  const resolvedIngredients = await resolveIngredients(
    group._id,
    ingredients,
    RC.RECIPE_CREATE_FOOD_NOT_FOUND // 00354
  );

  const recipe = await Recipe.create({
    foodId: food._id,
    groupId: group._id,
    name,
    description,
    htmlContent,
    ingredients: resolvedIngredients,
    createdBy: user._id,
  });

  await recipe.populate(RECIPE_POPULATE);
  return toPublicRecipe(recipe);
};

/**
 * PUT /recipe — sửa món / tên / mô tả / nội dung HTML của công thức.
 * Công thức của nhóm khác coi như không tồn tại (00365).
 */
const updateRecipe = async (userId, payload) => {
  const {
    recipeId,
    newFoodName,
    newName,
    newDescription,
    newHtmlContent,
    newIngredients,
  } = payload;

  const { group } = await loadGroupContext(userId); // 00096

  const hasUpdate =
    newFoodName !== undefined ||
    newName !== undefined ||
    newDescription !== undefined ||
    newHtmlContent !== undefined ||
    newIngredients !== undefined;
  if (!hasUpdate) throw fail(RC.RECIPE_UPDATE_NEED_ONE_FIELD); // 00360

  // Từng trường mới được gửi nhưng rỗng: mã riêng của trường đó.
  if (newFoodName !== undefined && !normalizeText(newFoodName)) {
    throw fail(RC.RECIPE_UPDATE_INVALID_FOOD_NAME); // 00361
  }
  if (newDescription !== undefined && !normalizeText(newDescription)) {
    throw fail(RC.RECIPE_UPDATE_INVALID_DESCRIPTION); // 00362
  }
  if (newHtmlContent !== undefined && !normalizeText(newHtmlContent)) {
    throw fail(RC.RECIPE_UPDATE_INVALID_HTML); // 00363
  }
  if (newName !== undefined && !normalizeText(newName)) {
    throw fail(RC.RECIPE_UPDATE_INVALID_NAME); // 00364
  }

  const recipe = await Recipe.findById(recipeId);
  if (!recipe) throw fail(RC.RECIPE_UPDATE_NOT_FOUND); // 00365
  if (!recipe.groupId.equals(group._id)) throw fail(RC.RECIPE_UPDATE_NOT_FOUND); // 00365

  if (newFoodName !== undefined) {
    const food = await Food.findOne({ groupId: group._id, name: normalizeText(newFoodName) });
    if (!food) throw fail(RC.RECIPE_UPDATE_NEW_FOOD_NOT_FOUND); // 00367
    recipe.foodId = food._id;
  }

  if (newName !== undefined) recipe.name = normalizeText(newName);
  if (newDescription !== undefined) recipe.description = normalizeText(newDescription);
  if (newHtmlContent !== undefined) recipe.htmlContent = newHtmlContent;

  if (newIngredients !== undefined) {
    recipe.ingredients = await resolveIngredients(
      group._id,
      newIngredients,
      RC.RECIPE_UPDATE_NEW_FOOD_NOT_FOUND // 00367
    );
  }

  await recipe.save();
  await recipe.populate(RECIPE_POPULATE);
  return toPublicRecipe(recipe);
};

/**
 * DELETE /recipe — xoá công thức theo recipeId.
 * Công thức của nhóm khác coi như không tồn tại (00373).
 */
const deleteRecipe = async (userId, { recipeId }) => {
  const { group } = await loadGroupContext(userId); // 00096

  const recipe = await Recipe.findById(recipeId).populate(RECIPE_POPULATE);
  if (!recipe) throw fail(RC.RECIPE_DELETE_NOT_FOUND); // 00373
  if (!recipe.groupId.equals(group._id)) throw fail(RC.RECIPE_DELETE_NOT_FOUND); // 00373

  const data = toPublicRecipe(recipe);
  await Recipe.deleteOne({ _id: recipe._id });
  return data;
};

module.exports = {
  getRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
};
