const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/user.models');
const RC = require('../constants/responseCode');
const { fail } = require('../utils/response');
const { toPublicUser } = require('../utils/serializers');
const { detachUserFromGroup } = require('./group.service');

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;

/** id lấy từ token luôn là ObjectId, nhưng vẫn kiểm tra để trả đúng mã thay vì CastError. */
const assertValidId = (userId) => {
  if (!mongoose.isValidObjectId(userId)) throw fail(RC.INVALID_USER_ID); // 00007
};

const findUserOrFail = async (userId, select) => {
  assertValidId(userId);
  const query = User.findById(userId);
  if (select) query.select(select);
  const user = await query;
  if (!user) throw fail(RC.USER_NOT_FOUND); // 00052
  return user;
};

const getProfile = async (userId) => {
  const user = await findUserOrFail(userId);
  return toPublicUser(user);
};

/**
 * Cập nhật hồ sơ. Chỉ nhận các trường đã khai báo trong updateUserSchema
 * (validate đã loại bỏ field lạ trước khi vào đây).
 */
const updateProfile = async (userId, payload) => {
  const user = await findUserOrFail(userId);

  if (payload.username && payload.username !== user.username) {
    const taken = await User.exists({ username: payload.username, _id: { $ne: user._id } });
    if (taken) throw fail(RC.EDIT_USER_USERNAME_EXISTS); // 00084
    user.username = payload.username;
  }

  for (const field of ['name', 'gender', 'birthday', 'language', 'timezone']) {
    if (payload[field] !== undefined) user[field] = payload[field];
  }

  if (payload.avatar !== undefined) {
    user.avatar = payload.avatar === '' ? null : payload.avatar;
  }

  await user.save();
  return toPublicUser(user);
};

const deleteAccount = async (userId) => {
  const user = await findUserOrFail(userId, 'groupId');

  // Xoá tài khoản phải gỡ khỏi nhóm trước, nếu không nhóm sẽ còn id "ma"
  // và có thể mất trưởng nhóm (xem group.service.detachUserFromGroup).
  await detachUserFromGroup(user);
  await User.findByIdAndDelete(user._id);
};

const changePassword = async (userId, { oldPassword, newPassword }) => {
  const user = await findUserOrFail(userId, '+password');

  const matched = user.password ? await bcrypt.compare(oldPassword, user.password) : false;
  if (!matched) throw fail(RC.OLD_PASSWORD_MISMATCH); // 00072

  if (await bcrypt.compare(newPassword, user.password)) {
    throw fail(RC.NEW_PASSWORD_SAME_AS_OLD); // 00073
  }

  user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  // Đổi mật khẩu phải huỷ các phiên cũ: refresh token đang lưu không dùng lại được.
  user.refreshToken = null;
  await user.save();
};

/** Expo push token thay đổi khi cài lại app / đổi máy nên cần API cập nhật riêng. */
const updateDeviceToken = async (userId, deviceToken) => {
  assertValidId(userId);
  const result = await User.updateOne({ _id: userId }, { $set: { deviceToken } });
  if (result.matchedCount === 0) throw fail(RC.USER_NOT_FOUND); // 00052
};

module.exports = {
  getProfile,
  updateProfile,
  deleteAccount,
  changePassword,
  updateDeviceToken,
};
