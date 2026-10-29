const mongoose = require('mongoose');
const FridgeItem = require('../models/fridgeItem.models');
const FridgeEvent = require('../models/fridgeEvent.models');
const Food = require('../models/food.models');
const User = require('../models/user.models');
const Group = require('../models/group.models');
const RC = require('../constants/responseCode');
const { fail } = require('../utils/response');
const { toPublicFridgeItem } = require('../utils/serializers');

// Luôn lấy kèm tên thực phẩm / danh mục / đơn vị để client hiển thị trực tiếp.
const FRIDGE_POPULATE = [
  {
    path: 'foodId',
    select: 'name image categoryId unitId',
    populate: [
      { path: 'categoryId', select: 'name' },
      { path: 'unitId', select: 'name' },
    ],
  },
];

/** id lấy từ token luôn là ObjectId, vẫn kiểm tra để trả đúng mã thay vì CastError. */
const assertValidId = (userId) => {
  if (!mongoose.isValidObjectId(userId)) throw fail(RC.INVALID_USER_ID); // 00007
};

/**
 * Lấy nhóm hiện tại của người dùng.
 * Mỗi nhóm API có mã "chưa vào nhóm" riêng (00196, 00210, 00225...), nên mã
 * được truyền vào.
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
 * Tìm thực phẩm theo tên trong phạm vi nhóm.
 * Trả kèm cờ `otherGroup` để service chọn đúng mã:
 * thực phẩm không tồn tại (00194/00218/00230) hay thuộc nhóm khác (00198/00219/00232).
 */
const findFoodInGroup = async (groupId, foodName) => {
  const food = await Food.findOne({ groupId, name: foodName });
  if (food) return { food, otherGroup: false };

  const existsElsewhere = await Food.exists({ name: foodName });
  return { food: null, otherGroup: Boolean(existsElsewhere) };
};

// Query có thể là mảng khi client lặp tham số (?foodName=a&foodName=b):
// chỉ nhận chuỗi, còn lại coi như không có giá trị.
const normalizeText = (value) => (typeof value === 'string' ? value.trim() : null);

/**
 * Quy ước khi một mục rời khỏi tủ (docs/02 mục 3.3):
 * - Client gửi `reason` (consumed / expired / discarded) thì dùng đúng lý do đó.
 * - Không gửi thì suy ra: còn hạn -> consumed, đã qua ngày hết hạn -> expired.
 * Mốc "hôm nay" tính theo UTC giống cron nhắc hạn, vì `expiryDate` được tạo từ
 * chuỗi YYYY-MM-DD (00:00 UTC).
 */
const resolveRemovalAction = (expiryDate, reason) => {
  if (reason) return reason;

  const now = new Date();
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  return new Date(expiryDate).getTime() < startOfToday.getTime() ? 'expired' : 'consumed';
};

/** GET /fridge — toàn bộ mục trong tủ của nhóm, sắp xếp theo hạn sử dụng gần nhất. */
const getFridgeItems = async (userId) => {
  const { group } = await loadGroupContext(userId, RC.FRIDGE_GET_NOT_IN_GROUP); // 00225

  const items = await FridgeItem.find({ groupId: group._id })
    .populate(FRIDGE_POPULATE)
    .sort({ expiryDate: 1, createdAt: 1 });

  return items.map(toPublicFridgeItem);
};

/** GET /fridge/item?foodName=... — xem một mục trong tủ theo tên thực phẩm. */
const getFridgeItem = async (userId, { foodName } = {}) => {
  const { group } = await loadGroupContext(userId, RC.FRIDGE_GET_NOT_IN_GROUP); // 00225

  const name = normalizeText(foodName);
  if (!name) throw fail(RC.FRIDGE_ITEM_MISSING_FOOD_NAME); // 00229

  const { food, otherGroup } = await findFoodInGroup(group._id, name);
  if (otherGroup) throw fail(RC.FRIDGE_ITEM_NO_PERMISSION); // 00232
  if (!food) throw fail(RC.FRIDGE_ITEM_FOOD_NOT_FOUND); // 00230

  const item = await FridgeItem.findOne({ groupId: group._id, foodId: food._id }).populate(
    FRIDGE_POPULATE
  );
  if (!item) throw fail(RC.FRIDGE_ITEM_NOT_CREATED); // 00234

  return toPublicFridgeItem(item);
};

/**
 * POST /fridge — thêm thực phẩm vào tủ lạnh.
 * Thứ tự kiểm tra theo đặc tả: chưa vào nhóm (00196) -> thực phẩm không tồn tại
 * (00194) / thuộc nhóm khác (00198) -> đã có trong tủ (00199).
 */
const createFridgeItem = async (userId, { foodName, useWithin, quantity, note, location }) => {
  const { group } = await loadGroupContext(userId, RC.FRIDGE_CREATE_NOT_IN_GROUP); // 00196

  const { food, otherGroup } = await findFoodInGroup(group._id, normalizeText(foodName));
  if (otherGroup) throw fail(RC.FRIDGE_CREATE_FOOD_NOT_IN_GROUP); // 00198
  if (!food) throw fail(RC.FRIDGE_CREATE_FOOD_NOT_FOUND); // 00194

  if (await FridgeItem.exists({ groupId: group._id, foodId: food._id })) {
    throw fail(RC.FRIDGE_CREATE_EXISTS); // 00199
  }

  try {
    const item = await FridgeItem.create({
      foodId: food._id,
      groupId: group._id,
      quantity,
      expiryDate: new Date(useWithin),
      location: normalizeText(location) || null,
      note: normalizeText(note) || null,
      isNotified: false,
    });

    await item.populate(FRIDGE_POPULATE);
    return toPublicFridgeItem(item);
  } catch (err) {
    // Hai request thêm cùng một thực phẩm đồng thời: unique index chặn ở DB.
    if (err.code === 11000) throw fail(RC.FRIDGE_CREATE_EXISTS); // 00199
    throw err;
  }
};

/**
 * PUT /fridge — sửa số lượng / hạn sử dụng / ghi chú / vị trí / tên thực phẩm.
 * Chỉ sửa được mục trong tủ của nhóm mình (00212 khi mục thuộc nhóm khác).
 */
const updateFridgeItem = async (userId, payload) => {
  const { itemId, newFoodName, newUseWithin, newQuantity, newNote, newLocation } = payload;

  const { group } = await loadGroupContext(userId, RC.FRIDGE_UPDATE_NOT_IN_GROUP); // 00210

  const hasUpdate =
    newFoodName !== undefined ||
    newUseWithin !== undefined ||
    newQuantity !== undefined ||
    newNote !== undefined ||
    newLocation !== undefined;
  if (!hasUpdate) throw fail(RC.FRIDGE_UPDATE_NEED_ONE_FIELD); // 00204

  // Tên mới được gửi nhưng rỗng: mã riêng (00207), không phải "thiếu trường".
  if (newFoodName !== undefined && !normalizeText(newFoodName)) {
    throw fail(RC.FRIDGE_UPDATE_INVALID_FOOD_NAME); // 00207
  }

  const item = await FridgeItem.findById(itemId);
  if (!item) throw fail(RC.FRIDGE_UPDATE_ITEM_NOT_FOUND); // 00213
  if (!item.groupId.equals(group._id)) throw fail(RC.FRIDGE_UPDATE_NOT_ADMIN); // 00212

  if (newFoodName !== undefined) {
    const { food } = await findFoodInGroup(group._id, normalizeText(newFoodName));
    if (!food) throw fail(RC.FRIDGE_UPDATE_NEW_FOOD_NOT_FOUND); // 00214

    if (!food._id.equals(item.foodId)) {
      if (
        await FridgeItem.exists({
          groupId: group._id,
          foodId: food._id,
          _id: { $ne: item._id },
        })
      ) {
        throw fail(RC.FRIDGE_CREATE_EXISTS); // 00199 — thực phẩm mới đã có trong tủ
      }
      item.foodId = food._id;
    }
  }

  if (newQuantity !== undefined) item.quantity = newQuantity;
  if (newNote !== undefined) item.note = normalizeText(newNote) || null;
  if (newLocation !== undefined) item.location = normalizeText(newLocation) || null;

  if (newUseWithin !== undefined) {
    item.expiryDate = new Date(newUseWithin);
    // Hạn mới thì phải nhắc lại từ đầu (xem docs/01 mục 6.3).
    item.isNotified = false;
  }

  try {
    await item.save();
  } catch (err) {
    if (err.code === 11000) throw fail(RC.FRIDGE_CREATE_EXISTS); // 00199
    throw err;
  }

  await item.populate(FRIDGE_POPULATE);
  return toPublicFridgeItem(item);
};

/**
 * DELETE /fridge — xoá mục trong tủ theo tên thực phẩm.
 * Thực phẩm thuộc nhóm khác trả 00219 (không có quyền).
 * Trước khi xoá, ghi một `FridgeEvent` để báo cáo tiêu thụ / lãng phí có dữ liệu.
 */
const deleteFridgeItem = async (userId, { foodName, reason }) => {
  const { group } = await loadGroupContext(userId, RC.FRIDGE_DELETE_NO_PERMISSION); // 00219

  const { food, otherGroup } = await findFoodInGroup(group._id, normalizeText(foodName));
  if (otherGroup) throw fail(RC.FRIDGE_DELETE_NO_PERMISSION); // 00219
  if (!food) throw fail(RC.FRIDGE_DELETE_FOOD_NOT_FOUND); // 00218

  const item = await FridgeItem.findOne({ groupId: group._id, foodId: food._id }).populate(
    FRIDGE_POPULATE
  );
  if (!item) throw fail(RC.FRIDGE_DELETE_ITEM_NOT_CREATED); // 00221

  const data = toPublicFridgeItem(item);

  // Ghi lịch sử trước khi xoá. Lỗi ghi lịch sử không được làm hỏng thao tác xoá
  // (báo cáo là tính năng phụ, xoá mục vẫn là nghiệp vụ chính của người dùng).
  try {
    const populatedFood = item.foodId;
    await FridgeEvent.create({
      groupId: group._id,
      foodId: populatedFood?._id ?? null,
      foodName: populatedFood?.name ?? data.foodName ?? 'Không xác định',
      categoryName: populatedFood?.categoryId?.name ?? null,
      unitName: populatedFood?.unitId?.name ?? null,
      quantity: item.quantity,
      expiryDate: item.expiryDate,
      location: item.location ?? null,
      action: resolveRemovalAction(item.expiryDate, reason),
      actedBy: userId,
    });
  } catch (err) {
    console.error('[fridge] không ghi được lịch sử xoá mục tủ lạnh:', err);
  }

  await FridgeItem.deleteOne({ _id: item._id });
  return data;
};

module.exports = {
  getFridgeItems,
  getFridgeItem,
  createFridgeItem,
  updateFridgeItem,
  deleteFridgeItem,
};
