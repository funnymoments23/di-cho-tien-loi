const mongoose = require('mongoose');
const User = require('../models/user.models');
const RC = require('../constants/responseCode');
const { fail } = require('../utils/response');
const { toAdminUser } = require('../utils/serializers');
const { detachUserFromGroup } = require('./group.service');
const { listUsersQuerySchema } = require('../validations/adminUser.validation');

/** id trên path luôn là ObjectId, vẫn kiểm tra để trả mã riêng thay vì CastError. */
const assertValidId = (userId) => {
  if (!mongoose.isValidObjectId(userId)) throw fail(RC.ADMIN_USER_INVALID_ID); // 00393
};

const findUserOrFail = async (userId, { withGroup = true } = {}) => {
  assertValidId(userId);
  let query = User.findById(userId);
  if (withGroup) query = query.populate('groupId', 'name');
  const user = await query;
  if (!user) throw fail(RC.ADMIN_USER_NOT_FOUND); // 00392
  return user;
};

/** Thoát ký tự đặc biệt để keyword người dùng nhập không bị hiểu là regex. */
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Kiểm tra + chuẩn hoá query của GET /admin/user.
 * Sai tham số nào cũng trả 00394 để client biết lỗi nằm ở query.
 */
const parseListQuery = (query = {}) => {
  const { value, error } = listUsersQuerySchema.validate(query, {
    abortEarly: true,
    stripUnknown: true,
  });
  if (error) throw fail(RC.ADMIN_USER_INVALID_QUERY); // 00394
  return value;
};

/**
 * GET /admin/user — danh sách người dùng có lọc và phân trang.
 *
 * Hỗ trợ:
 * - `keyword`: tìm gần đúng trong email / tên / username (không phân biệt hoa thường)
 * - `role`: user | admin
 * - `status`: active | locked
 * - `isVerified`: true | false
 * - `groupId`: lọc theo nhóm
 * - `page`, `limit` (tối đa 100), `sort`, `order`
 */
const listUsers = async (query) => {
  const { keyword, role, status, isVerified, groupId, page, limit, sort, order } =
    parseListQuery(query);

  const filter = {};
  if (keyword) {
    const pattern = new RegExp(escapeRegex(keyword), 'i');
    filter.$or = [{ email: pattern }, { name: pattern }, { username: pattern }];
  }
  if (role) filter.role = role;
  // Tài khoản tạo trước khi có trường isActive được coi là đang hoạt động.
  if (status === 'active') filter.isActive = { $ne: false };
  if (status === 'locked') filter.isActive = false;
  if (isVerified !== undefined) filter.isVerified = isVerified;
  if (groupId) filter.groupId = groupId;

  const sortSpec = { [sort]: order === 'asc' ? 1 : -1, _id: 1 };
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(filter).populate('groupId', 'name').sort(sortSpec).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return {
    items: users.map(toAdminUser),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/** GET /admin/user/:id — chi tiết một tài khoản. */
const getUser = async (userId) => {
  const user = await findUserOrFail(userId);
  return toAdminUser(user);
};

/**
 * PUT /admin/user/:id — admin cập nhật tài khoản.
 *
 * Chặn admin tự hạ quyền chính mình (00399) để tránh tự khoá quyền quản trị.
 * Đổi `role` sẽ thu hồi refresh token: token mới sau khi đăng nhập lại mang
 * đúng quyền, còn access token cũ chỉ sống tối đa 1 giờ (auth middleware đọc
 * role từ DB nên hiệu lực thay đổi quyền là tức thì).
 */
const updateUser = async (actorId, userId, payload) => {
  const user = await findUserOrFail(userId);
  const isSelf = String(user._id) === String(actorId);

  const roleChanged = payload.role !== undefined && payload.role !== user.role;
  if (roleChanged && isSelf) throw fail(RC.ADMIN_USER_CANNOT_CHANGE_OWN_ROLE); // 00399

  if (payload.email !== undefined && payload.email !== user.email) {
    const taken = await User.exists({ email: payload.email, _id: { $ne: user._id } });
    if (taken) throw fail(RC.ADMIN_USER_EMAIL_EXISTS); // 00397
    user.email = payload.email;
  }

  if (payload.username !== undefined && payload.username !== user.username) {
    const taken = await User.exists({ username: payload.username, _id: { $ne: user._id } });
    if (taken) throw fail(RC.ADMIN_USER_USERNAME_EXISTS); // 00398
    user.username = payload.username;
  }

  for (const field of [
    'name',
    'gender',
    'birthday',
    'language',
    'timezone',
    'role',
    'isVerified',
  ]) {
    if (payload[field] !== undefined) user[field] = payload[field];
  }

  if (payload.avatar !== undefined) {
    user.avatar = payload.avatar === '' ? null : payload.avatar;
  }

  if (roleChanged) user.refreshToken = null;

  try {
    await user.save();
  } catch (err) {
    // Hai request đổi email/username cùng lúc: unique index chặn ở DB.
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || err.keyValue || {})[0];
      throw fail(
        field === 'username' ? RC.ADMIN_USER_USERNAME_EXISTS : RC.ADMIN_USER_EMAIL_EXISTS
      );
    }
    throw err;
  }

  return toAdminUser(user);
};

/**
 * PATCH /admin/user/:id/status — khoá / mở khoá tài khoản.
 * Khoá sẽ thu hồi refresh token; auth middleware chặn ngay access token còn hạn.
 */
const updateUserStatus = async (actorId, userId, { isActive }) => {
  const user = await findUserOrFail(userId);

  if (!isActive && String(user._id) === String(actorId)) {
    throw fail(RC.ADMIN_USER_CANNOT_LOCK_SELF); // 00400
  }

  // Gọi lại với cùng trạng thái là thao tác idempotent, vẫn trả thành công.
  if ((user.isActive !== false) === isActive) return toAdminUser(user);

  user.isActive = isActive;
  user.lockedAt = isActive ? null : new Date();
  if (!isActive) user.refreshToken = null;

  await user.save();
  return toAdminUser(user);
};

/**
 * DELETE /admin/user/:id — xoá tài khoản người dùng.
 * Dùng chung detachUserFromGroup với DELETE /user: nếu là trưởng nhóm thì
 * chuyển quyền cho thành viên còn lại, người cuối cùng thì xoá cả nhóm.
 */
const deleteUser = async (actorId, userId) => {
  // Không populate groupId: detachUserFromGroup cần ObjectId thô để truy vấn Group.
  const user = await findUserOrFail(userId, { withGroup: false });

  if (String(user._id) === String(actorId)) {
    throw fail(RC.ADMIN_USER_CANNOT_DELETE_SELF); // 00401
  }

  await detachUserFromGroup(user);
  await User.findByIdAndDelete(user._id);

  return { id: user._id };
};

module.exports = {
  listUsers,
  getUser,
  updateUser,
  updateUserStatus,
  deleteUser,
};
