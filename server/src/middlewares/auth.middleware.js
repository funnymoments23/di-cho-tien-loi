const { extractBearerToken, verifyAccessToken } = require('../utils/jwt');
const { fail } = require('../utils/response');
const RC = require('../constants/responseCode');

/**
 * Xác thực Bearer token, gắn req.user = { id, role } cho các middleware/controller phía sau.
 * Token thiếu -> 00006, hết hạn -> 00011, không hợp lệ -> 00012.
 */
const auth = (req, res, next) => {
  const token = extractBearerToken(req);
  if (!token) return next(fail(RC.NO_TOKEN));

  const payload = verifyAccessToken(token); // ném AppError nếu hỏng

  req.user = {
    id: payload.sub,
    role: payload.role || 'user',
  };
  next();
};

module.exports = auth;
