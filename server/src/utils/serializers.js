/**
 * Chuyển document User (Mongoose) thành object an toàn để trả cho client.
 * Bỏ toàn bộ trường nội bộ: password, refreshToken, mã xác minh email.
 */
const toPublicUser = (user) => ({
  id: user._id,
  email: user.email,
  name: user.name,
  username: user.username ?? null,
  avatar: user.avatar ?? null,
  gender: user.gender ?? null,
  birthday: user.birthday ?? null,
  language: user.language,
  timezone: user.timezone,
  role: user.role,
  groupId: user.groupId,
  isVerified: user.isVerified,
});

/**
 * Chuyển document Group thành object trả cho client.
 * `members` (mảng ObjectId) không trả trực tiếp; API xem nhóm trả kèm
 * danh sách người dùng đã qua toPublicUser.
 */
const toPublicGroup = (group) => ({
  id: group._id,
  name: group.name,
  adminId: group.adminId,
  memberCount: group.members?.length ?? 0,
  createdAt: group.createdAt,
});

/** Chuyển document Category hoặc Unit (chỉ có `name`) thành object trả cho client. */
const toPublicLookup = (item) => ({
  id: item._id,
  name: item.name,
});

/**
 * Chuyển document Food thành object trả cho client.
 * `categoryId` / `unitId` cần được populate (chỉ lấy `name`) trước khi gọi;
 * nếu chưa populate thì hai trường tên sẽ là null thay vì lộ ObjectId thô.
 */
const toPublicFood = (food) => {
  const category = food.categoryId;
  const unit = food.unitId;

  return {
    id: food._id,
    name: food.name,
    image: food.image ?? null,
    categoryId: category?._id ?? null,
    categoryName: category?.name ?? null,
    unitId: unit?._id ?? null,
    unitName: unit?.name ?? null,
    groupId: food.groupId,
    createdBy: food.createdBy ?? null,
    createdAt: food.createdAt,
    updatedAt: food.updatedAt,
  };
};

/**
 * Chuyển document FridgeItem thành object trả cho client.
 * `foodId` cần được populate (kèm `categoryId` / `unitId` chỉ lấy `name`)
 * trước khi gọi. Trường lưu là `expiryDate` nhưng API trả `useWithin`
 * theo đặc tả (xem docs/02 mục 4.2).
 */
const toPublicFridgeItem = (item) => {
  const food = item.foodId;
  const isPopulated = Boolean(food && typeof food === 'object' && food.name !== undefined);
  const category = isPopulated ? food.categoryId : null;
  const unit = isPopulated ? food.unitId : null;

  return {
    id: item._id,
    foodId: isPopulated ? food._id : food,
    foodName: isPopulated ? food.name : null,
    image: isPopulated ? food.image ?? null : null,
    categoryId: category?._id ?? null,
    categoryName: category?.name ?? null,
    unitId: unit?._id ?? null,
    unitName: unit?.name ?? null,
    quantity: item.quantity,
    useWithin: item.expiryDate,
    location: item.location ?? null,
    note: item.note ?? null,
    isNotified: item.isNotified,
    groupId: item.groupId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

module.exports = {
  toPublicUser,
  toPublicGroup,
  toPublicLookup,
  toPublicFood,
  toPublicFridgeItem,
};
