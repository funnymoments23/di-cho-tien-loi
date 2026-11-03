const mongoose = require('mongoose');
const MealPlan = require('../models/mealPlan.models');
const Recipe = require('../models/recipe.models');
const FridgeItem = require('../models/fridgeItem.models');
const Food = require('../models/food.models');
const User = require('../models/user.models');
const Group = require('../models/group.models');
const RC = require('../constants/responseCode');
const { fail } = require('../utils/response');
const { parsePagination, pageResult, applyPagination } = require('../utils/pagination');
const { toPublicMealPlan, toPublicRecipe } = require('../utils/serializers');

// Luôn lấy kèm tên / ảnh / danh mục / đơn vị của món để client hiển thị trực tiếp.
const MEAL_POPULATE = [
  {
    path: 'foodId',
    select: 'name image categoryId unitId',
    populate: [
      { path: 'categoryId', select: 'name' },
      { path: 'unitId', select: 'name' },
    ],
  },
];

// Thứ tự hiển thị trong một ngày: sáng -> trưa -> tối.
const MEAL_ORDER = { 'sáng': 0, 'trưa': 1, 'tối': 2 };

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Chấp nhận cả tên bữa có dấu và không dấu để tránh lỗi gõ từ client.
const MEAL_NAME_ALIASES = new Map([
  ['sáng', 'sáng'],
  ['sang', 'sáng'],
  ['trưa', 'trưa'],
  ['tối', 'tối'],
  ['toi', 'tối'],
]);

/** id lấy từ token luôn là ObjectId, vẫn kiểm tra để trả đúng mã thay vì CastError. */
const assertValidId = (userId) => {
  if (!mongoose.isValidObjectId(userId)) throw fail(RC.INVALID_USER_ID); // 00007
};

// Query có thể là mảng khi client lặp tham số (?date=a&date=b):
// chỉ nhận giá trị chuỗi để tránh lỗi truy vấn.
const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Lấy nhóm hiện tại của người dùng.
 * Mỗi nhóm API có mã "chưa vào nhóm" riêng, nên mã được truyền vào.
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

/**
 * Lấy nhóm và bắt buộc người dùng là trưởng nhóm.
 * Kế hoạch bữa ăn chỉ trưởng nhóm được lập / sửa / xoá (mã 00319, 00339, 00327).
 */
const loadGroupAdminContext = async (userId, notInGroupCode, notAdminCode) => {
  const { user, group } = await loadGroupContext(userId, notInGroupCode);
  if (!group.adminId.equals(user._id)) throw fail(notAdminCode);
  return { user, group };
};

/** Chuẩn hoá "Sáng" / "sang" / "trưa" / "tối" về đúng ba giá trị của đặc tả. */
const normalizeMealName = (value, invalidCode) => {
  const canonical = MEAL_NAME_ALIASES.get(normalizeText(value).toLowerCase());
  if (!canonical) throw fail(invalidCode);
  return canonical;
};

/** Phân tích tham số ngày; trả null nếu không hợp lệ để bỏ qua bộ lọc. */
const parseDate = (value) => {
  const text = normalizeText(value);
  if (!text) return null;

  const date = DATE_ONLY.test(text) ? new Date(`${text}T00:00:00.000Z`) : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Dựng điều kiện lọc theo `date` (một ngày) hoặc `from`–`to` (khoảng ngày / tuần).
 * Tham số sai định dạng bị bỏ qua thay vì làm hỏng cả danh sách.
 */
const buildTimeFilter = (filters = {}) => {
  const date = parseDate(filters.date);
  if (date) {
    return { $gte: date, $lt: new Date(date.getTime() + DAY_MS) };
  }

  const from = parseDate(filters.from);
  const to = parseDate(filters.to);
  if (!from && !to) return null;

  const range = {};
  if (from) range.$gte = from;
  if (to) {
    // `to=2026-11-10` phải bao gồm cả ngày 10, nên cận trên là đầu ngày 11.
    const toText = normalizeText(filters.to);
    range[DATE_ONLY.test(toText) ? '$lt' : '$lte'] = DATE_ONLY.test(toText)
      ? new Date(to.getTime() + DAY_MS)
      : to;
  }
  return range;
};

/** Sắp xếp theo ngày, rồi tới thứ tự bữa sáng / trưa / tối, rồi thứ tự tạo. */
const compareMealPlans = (a, b) => {
  const timeDiff = new Date(a.timestamp) - new Date(b.timestamp);
  if (timeDiff !== 0) return timeDiff;

  const orderDiff = (MEAL_ORDER[a.name] ?? 99) - (MEAL_ORDER[b.name] ?? 99);
  if (orderDiff !== 0) return orderDiff;

  return new Date(a.createdAt) - new Date(b.createdAt);
};

/**
 * GET /meal — lịch bữa ăn của nhóm.
 * Hỗ trợ `?date=YYYY-MM-DD` (một ngày) và `?from=&to=` (tuần / khoảng ngày).
 */
const getMealPlans = async (userId, filters = {}) => {
  const { group } = await loadGroupContext(userId, RC.MEAL_GET_NOT_IN_GROUP); // 00345

  const pagination = parsePagination(filters);
  const query = { groupId: group._id };
  const timeFilter = buildTimeFilter(filters);
  if (timeFilter) query.timestamp = timeFilter;

  const total = pagination ? await MealPlan.countDocuments(query) : null;
  const planQuery = MealPlan.find(query)
    .populate(MEAL_POPULATE)
    .sort({ timestamp: 1, createdAt: 1 });
  const plans = await applyPagination(planQuery, pagination).then((rows) => rows.map(toPublicMealPlan));

  if (pagination) return pageResult(plans, total, pagination);

  return plans.sort(compareMealPlans);
};

/**
 * POST /meal — trưởng nhóm xếp một món vào bữa.
 * Thứ tự kiểm tra: quyền trưởng nhóm (00319) -> tên bữa (00316)
 * -> thực phẩm tồn tại trong nhóm (00317).
 */
const createMealPlan = async (userId, { foodName, timestamp, name }) => {
  const { user, group } = await loadGroupAdminContext(
    userId,
    RC.MEAL_CREATE_NOT_GROUP_ADMIN, // 00319 — chưa vào nhóm
    RC.MEAL_CREATE_NOT_GROUP_ADMIN // 00319 — không phải trưởng nhóm
  );

  const mealName = normalizeMealName(name, RC.MEAL_CREATE_INVALID_NAME); // 00316

  const food = await Food.findOne({ groupId: group._id, name: normalizeText(foodName) });
  if (!food) throw fail(RC.MEAL_CREATE_FOOD_NOT_FOUND); // 00317

  const plan = await MealPlan.create({
    groupId: group._id,
    foodId: food._id,
    timestamp: new Date(timestamp),
    name: mealName,
    createdBy: user._id,
  });

  await plan.populate(MEAL_POPULATE);
  return toPublicMealPlan(plan);
};

/**
 * PUT /meal — sửa món / ngày / tên bữa của một kế hoạch.
 * Chỉ trưởng nhóm của nhóm sở hữu kế hoạch mới được sửa.
 */
const updateMealPlan = async (userId, payload) => {
  const { planId, newFoodName, newTimestamp, newName } = payload;

  const { group } = await loadGroupAdminContext(
    userId,
    RC.MEAL_UPDATE_NOT_GROUP_ADMIN, // 00339 — chưa vào nhóm
    RC.MEAL_UPDATE_NOT_GROUP_ADMIN // 00339 — không phải trưởng nhóm
  );

  const hasUpdate = newFoodName !== undefined || newTimestamp !== undefined || newName !== undefined;
  if (!hasUpdate) throw fail(RC.MEAL_UPDATE_NEED_ONE_FIELD); // 00333

  // Tên mới được gửi nhưng rỗng: mã riêng của từng trường.
  if (newFoodName !== undefined && !normalizeText(newFoodName)) {
    throw fail(RC.MEAL_UPDATE_INVALID_FOOD_NAME); // 00334
  }
  const mealName =
    newName !== undefined ? normalizeMealName(newName, RC.MEAL_UPDATE_INVALID_NAME) : undefined; // 00336

  const plan = await MealPlan.findById(planId);
  if (!plan) throw fail(RC.MEAL_UPDATE_NOT_FOUND); // 00337
  // Kế hoạch của nhóm khác coi như không tồn tại trong phạm vi nhóm này.
  if (!plan.groupId.equals(group._id)) throw fail(RC.MEAL_UPDATE_NOT_FOUND); // 00337

  if (newFoodName !== undefined) {
    const food = await Food.findOne({ groupId: group._id, name: normalizeText(newFoodName) });
    if (!food) throw fail(RC.MEAL_UPDATE_NEW_FOOD_NOT_FOUND); // 00341
    plan.foodId = food._id;
  }

  if (newTimestamp !== undefined) plan.timestamp = new Date(newTimestamp);
  if (mealName !== undefined) plan.name = mealName;

  await plan.save();
  await plan.populate(MEAL_POPULATE);
  return toPublicMealPlan(plan);
};

/**
 * DELETE /meal — xoá kế hoạch bữa ăn theo planId.
 * Chỉ trưởng nhóm của nhóm sở hữu kế hoạch mới được xoá.
 */
const deleteMealPlan = async (userId, { planId }) => {
  const { group } = await loadGroupAdminContext(
    userId,
    RC.MEAL_DELETE_NOT_GROUP_ADMIN, // 00327 — chưa vào nhóm
    RC.MEAL_DELETE_NOT_GROUP_ADMIN // 00327 — không phải trưởng nhóm
  );

  const plan = await MealPlan.findById(planId).populate(MEAL_POPULATE);
  if (!plan) throw fail(RC.MEAL_DELETE_NOT_FOUND); // 00325
  if (!plan.groupId.equals(group._id)) throw fail(RC.MEAL_DELETE_NOT_FOUND); // 00325

  const data = toPublicMealPlan(plan);
  await MealPlan.deleteOne({ _id: plan._id });
  return data;
};

/**
 * GET /meal/suggestion — gợi ý công thức nấu được từ thực phẩm đang có trong tủ.
 *
 * Thuật toán (docs/02 mục 3.2):
 * 1. Lấy các mục còn hạn trong tủ của nhóm (mỗi thực phẩm lấy hạn gần nhất,
 *    cộng dồn số lượng nếu có nhiều mục).
 * 2. Với mỗi công thức, đối chiếu danh sách nguyên liệu với tủ. Công thức cũ
 *    chỉ có `foodId` (chưa có `ingredients`) vẫn được coi là một nguyên liệu.
 * 3. Chỉ giữ công thức khớp ít nhất một nguyên liệu; xếp hạng theo số nguyên
 *    liệu khớp giảm dần, rồi theo hạn sử dụng gần nhất để ưu tiên tiêu thụ
 *    thực phẩm sắp hết hạn.
 */
const suggestMeals = async (userId, { limit } = {}) => {
  const { group } = await loadGroupContext(userId, RC.MEAL_GET_NOT_IN_GROUP); // 00345

  const now = new Date();
  // Hạn sử dụng thường được nhập theo ngày, nên mục hết hạn hôm nay vẫn
  // còn dùng được tới hết ngày: so sánh với đầu ngày thay vì thời điểm hiện tại.
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  // Mục đã hết hạn không còn dùng được nên không đưa vào gợi ý.
  const fridgeItems = await FridgeItem.find({
    groupId: group._id,
    expiryDate: { $gte: startOfToday },
  })
    .select('foodId quantity expiryDate location note')
    .sort({ expiryDate: 1 });

  if (fridgeItems.length === 0) return [];

  // Gộp theo thực phẩm: lấy hạn gần nhất và tổng số lượng đang có trong tủ.
  const fridgeByFood = new Map();
  for (const item of fridgeItems) {
    const foodId = item.foodId.toString();
    const current = fridgeByFood.get(foodId);
    if (!current) {
      fridgeByFood.set(foodId, {
        quantity: item.quantity,
        expiryDate: item.expiryDate,
        location: item.location ?? null,
        note: item.note ?? null,
      });
      continue;
    }

    current.quantity += item.quantity;
    if (item.expiryDate < current.expiryDate) {
      current.expiryDate = item.expiryDate;
      current.location = item.location ?? null;
      current.note = item.note ?? null;
    }
  }

  const recipes = await Recipe.find({ groupId: group._id })
    .populate([
      { path: 'foodId', select: 'name' },
      {
        path: 'ingredients.foodId',
        select: 'name unitId',
        populate: { path: 'unitId', select: 'name' },
      },
    ])
    .sort({ name: 1 });

  const suggestions = [];

  for (const recipe of recipes) {
    const primaryFoodId = recipe.foodId?._id ?? recipe.foodId;
    const ingredients = (recipe.ingredients ?? []).map((ingredient) => ({
      foodId: ingredient.foodId?._id ?? ingredient.foodId,
      foodName: ingredient.foodId?.name ?? null,
      quantity: ingredient.quantity,
      unitName: ingredient.foodId?.unitId?.name ?? null,
    }));

    // Công thức cũ chưa có ingredients[] thì dùng món ăn chính làm nguyên liệu.
    if (ingredients.length === 0 && primaryFoodId) {
      ingredients.push({
        foodId: primaryFoodId,
        foodName: recipe.foodId?.name ?? null,
        quantity: 1,
        unitName: null,
      });
    }

    const matchedIngredients = [];
    const missingIngredients = [];

    for (const ingredient of ingredients) {
      const fridge = ingredient.foodId
        ? fridgeByFood.get(ingredient.foodId.toString())
        : null;

      if (!fridge) {
        missingIngredients.push({
          foodId: ingredient.foodId ?? null,
          foodName: ingredient.foodName ?? null,
        });
        continue;
      }

      matchedIngredients.push({
        ...ingredient,
        fridgeQuantity: fridge.quantity,
        expiryDate: fridge.expiryDate,
        daysUntilExpiry: Math.ceil(
          (fridge.expiryDate.getTime() - now.getTime()) / DAY_MS
        ),
        location: fridge.location ?? null,
        note: fridge.note ?? null,
      });
    }

    if (matchedIngredients.length === 0) continue;

    const nearest = matchedIngredients.reduce((soonest, ingredient) =>
      ingredient.expiryDate < soonest.expiryDate ? ingredient : soonest
    );
    const daysUntilExpiry = nearest.daysUntilExpiry;
    const reason =
      daysUntilExpiry <= 0
        ? `Dùng ${nearest.foodName ?? 'nguyên liệu'} hết hạn hôm nay`
        : `Dùng ${nearest.foodName ?? 'nguyên liệu'} còn ${daysUntilExpiry} ngày`;

    suggestions.push({
      ...toPublicRecipe(recipe),
      reason,
      matchedCount: matchedIngredients.length,
      totalIngredients: ingredients.length,
      matchedIngredients,
      missingIngredients,
      // Giữ các trường cũ để client đang dùng không bị vỡ.
      quantity: nearest.fridgeQuantity,
      expiryDate: nearest.expiryDate,
      daysUntilExpiry,
      location: nearest.location,
      note: nearest.note,
    });
  }

  // Khớp nhiều nguyên liệu hơn lên trước; cùng số nguyên liệu thì ưu tiên
  // công thức dùng thực phẩm sắp hết hạn nhất, cuối cùng xếp theo tên.
  suggestions.sort((a, b) => {
    if (b.matchedCount !== a.matchedCount) {
      return b.matchedCount - a.matchedCount;
    }
    const expiryDiff = new Date(a.expiryDate) - new Date(b.expiryDate);
    if (expiryDiff !== 0) return expiryDiff;
    return a.name.localeCompare(b.name);
  });

  const parsedLimit = Number.parseInt(limit, 10);
  const max =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 100)
      : 20;
  return suggestions.slice(0, max);
};

module.exports = {
  getMealPlans,
  suggestMeals,
  createMealPlan,
  updateMealPlan,
  deleteMealPlan,
};
