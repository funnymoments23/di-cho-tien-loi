const mongoose = require('mongoose');
const User = require('../models/user.models');
const { extractBearerToken, verifyAccessToken } = require('../utils/jwt');
const { fail } = require('../utils/response');
const RC = require('../constants/responseCode');

/**
 * Xác thực Bearer token, gắn req.user = { id, role } cho các middleware/controller phía sau.
 * Token thiếu -> 00006, hết hạn -> 00011, không hợp lệ -> 00012.
 *
 * Đọc lại user trong DB mỗi request để hai thao tác quản trị có hiệu lực ngay:
 * - admin khoá tài khoản -> mọi request sau đó nhận 00403 (kể cả access token còn hạn);
 * - admin đổi role -> quyền mới áp dụng ngay, không phải chờ token cũ hết hạn.
 * Token hợp lệ nhưng tài khoản đã bị xoá -> 00052.
 */
const auth = async (req, res, next) => {
  try {
    const token = extractBearerToken(req);
    if (!token) return next(fail(RC.NO_TOKEN));

    const payload = verifyAccessToken(token); // ném AppError nếu hỏng
    if (!mongoose.isValidObjectId(payload.sub)) return next(fail(RC.TOKEN_INVALID));

    const user = await User.findById(payload.sub).select('role isActive');
    if (!user) return next(fail(RC.USER_NOT_FOUND)); // 00052
    if (user.isActive === false) return next(fail(RC.ACCOUNT_LOCKED)); // 00403

    req.user = {
      id: payload.sub,
      role: user.role || 'user',
    };
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = auth;
