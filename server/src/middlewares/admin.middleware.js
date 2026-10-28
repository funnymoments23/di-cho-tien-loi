const { fail } = require('../utils/response');
const RC = require('../constants/responseCode');

/**
 * Chỉ cho tài khoản có role `admin` đi tiếp (dùng sau auth.middleware).
 * Role lấy từ payload của access token đã được ký nên không thể tự sửa ở client.
 *
 * @param {object} [forbiddenCode] mã trả khi không phải admin
 *                                 (mặc định 00017 — truy cập bị từ chối).
 */
const admin = (forbiddenCode = RC.ACCESS_DENIED_17) => (req, res, next) => {
  if (req.user?.role !== 'admin') return next(fail(forbiddenCode));
  next();
};

module.exports = admin;
