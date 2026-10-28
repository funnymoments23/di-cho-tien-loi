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

module.exports = { toPublicUser, toPublicGroup };
