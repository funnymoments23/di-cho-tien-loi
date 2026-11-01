const FridgeEvent = require('../models/fridgeEvent.models');

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfUtcDay = (date = new Date()) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

/**
 * Xác định lý do một mục rời tủ:
 * - client gửi `reason` thì dùng lý do đó;
 * - không gửi thì hết hạn trước hôm nay -> expired, còn lại -> consumed.
 * Dùng chung cho DELETE /fridge, xoá thực phẩm và xoá nhóm.
 */
const resolveRemovalAction = (expiryDate, reason) => {
  if (reason) return reason;
  return new Date(expiryDate).getTime() < startOfUtcDay().getTime() ? 'expired' : 'consumed';
};

/**
 * Ghi lịch sử một mục rời tủ lạnh.
 *
 * @param {object} item FridgeItem (nên populate foodId để có tên/danh mục/đơn vị)
 * @param {'consumed'|'expired'|'discarded'} action
 * @param {string|import('mongoose').Types.ObjectId|null} actedBy
 * @param {object|null} [food] Food đã populate, dùng khi item.foodId chỉ là ObjectId
 */
const recordFridgeRemoval = async (item, action, actedBy, food = null) => {
  try {
    const foodDoc = food || (item.foodId && typeof item.foodId === 'object' ? item.foodId : null);
    return await FridgeEvent.create({
      groupId: item.groupId,
      foodId: foodDoc?._id ?? item.foodId?._id ?? item.foodId ?? null,
      foodName: foodDoc?.name ?? item.foodName ?? 'Không xác định',
      categoryName: foodDoc?.categoryId?.name ?? item.categoryName ?? null,
      unitName: foodDoc?.unitId?.name ?? item.unitName ?? null,
      quantity: item.quantity,
      expiryDate: item.expiryDate,
      location: item.location ?? null,
      action,
      actedBy: actedBy ?? null,
    });
  } catch (err) {
    // Báo cáo là tính năng phụ; lỗi ghi lịch sử không được làm hỏng thao tác xoá.
    if (process.env.NODE_ENV !== 'test') {
      console.error('[fridge] không ghi được lịch sử xoá mục tủ lạnh:', err.message);
    }
    return null;
  }
};

module.exports = {
  DAY_MS,
  startOfUtcDay,
  resolveRemovalAction,
  recordFridgeRemoval,
};
