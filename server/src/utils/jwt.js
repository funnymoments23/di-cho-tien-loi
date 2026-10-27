const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const RC = require('../constants/responseCode');
const { fail } = require('./response');

// ===== Cấu hình =====
const ISSUER = 'di-cho-tien-loi';
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '1h';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const VERIFY_EXPIRES_IN = process.env.JWT_VERIFY_EXPIRES_IN || '10m';

const TOKEN_TYPE = Object.freeze({ ACCESS: 'access', REFRESH: 'refresh', VERIFY: 'verify' });

const SECRET_ENV_NAME = {
  [TOKEN_TYPE.ACCESS]: 'JWT_ACCESS_SECRET',
  [TOKEN_TYPE.REFRESH]: 'JWT_REFRESH_SECRET',
  [TOKEN_TYPE.VERIFY]: 'JWT_VERIFY_SECRET',
};

// Đọc secret lần đầu dùng, thiếu thì báo lỗi rõ ràng thay vì ký bằng "undefined".
const secretCache = {};
const secretFor = (type) => {
  if (!secretCache[type]) {
    const envName = SECRET_ENV_NAME[type];
    // Token xác minh email chỉ sống 10 phút; nếu không cấu hình riêng thì dùng
    // chung secret với access token (payload có `typ` nên không thể dùng lẫn).
    const value =
      process.env[envName] ||
      (type === TOKEN_TYPE.VERIFY ? process.env.JWT_ACCESS_SECRET : undefined);
    if (!value) {
      throw new Error(`Thiếu biến môi trường ${envName} trong file .env`);
    }
    secretCache[type] = value;
  }
  return secretCache[type];
};

const userIdOf = (user) => String(user._id || user.id);

// ===== Ký token =====
// jwtid ngẫu nhiên: nếu thiếu, 2 token ký trong cùng 1 giây sẽ giống hệt nhau
// (cùng payload + cùng iat) và việc rotate refresh token mất tác dụng.
const signToken = (payload, type, expiresIn) =>
  jwt.sign({ ...payload, typ: type }, secretFor(type), {
    expiresIn,
    issuer: ISSUER,
    jwtid: crypto.randomUUID(),
  });

/**
 * Access token: gửi kèm mọi request (Authorization: Bearer <token>).
 * Chỉ chứa thông tin tối thiểu, KHÔNG chứa dữ liệu nhạy cảm.
 */
const signAccessToken = (user) =>
  signToken({ sub: userIdOf(user), role: user.role || 'user' }, TOKEN_TYPE.ACCESS, ACCESS_EXPIRES_IN);

/**
 * Refresh token: chỉ dùng cho POST /user/refresh-token.
 * Không mang role để nếu lộ cũng không dùng được như access token.
 */
const signRefreshToken = (user) =>
  signToken({ sub: userIdOf(user) }, TOKEN_TYPE.REFRESH, REFRESH_EXPIRES_IN);

/**
 * Token xác minh email: trả về lúc đăng ký / gửi lại mã, sống 10 phút.
 * Chỉ dùng cho POST /user/verify-email, không thay được access token.
 */
const signVerificationToken = (user) =>
  signToken({ sub: userIdOf(user) }, TOKEN_TYPE.VERIFY, VERIFY_EXPIRES_IN);

const generateTokenPair = (user) => ({
  accessToken: signAccessToken(user),
  refreshToken: signRefreshToken(user),
});

// ===== Xác minh token =====
const invalidCodeFor = (type) => {
  if (type === TOKEN_TYPE.REFRESH) return RC.REFRESH_TOKEN_UNVERIFIABLE;
  if (type === TOKEN_TYPE.VERIFY) return RC.VERIFY_TOKEN_INVALID;
  return RC.TOKEN_INVALID;
};

const verifyToken = (token, type) => {
  let payload;
  try {
    payload = jwt.verify(token, secretFor(type), { issuer: ISSUER });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      if (type === TOKEN_TYPE.REFRESH) {
        throw fail(RC.REFRESH_TOKEN_EXPIRED);
      }
      if (type === TOKEN_TYPE.VERIFY) {
        throw fail(RC.VERIFY_TOKEN_INVALID);
      }
      throw fail(RC.SESSION_EXPIRED);
    }
    throw fail(invalidCodeFor(type));
  }

  // Chặn dùng refresh token như access token (và ngược lại).
  if (payload.typ !== type) {
    throw fail(invalidCodeFor(type));
  }

  return payload; // { sub, role?, typ, iat, exp, iss }
};

const verifyAccessToken = (token) => verifyToken(token, TOKEN_TYPE.ACCESS);
const verifyRefreshToken = (token) => verifyToken(token, TOKEN_TYPE.REFRESH);
const verifyVerificationToken = (token) => verifyToken(token, TOKEN_TYPE.VERIFY);

// ===== Tiện ích =====
/** Lấy token từ header "Authorization: Bearer xxx". Trả null nếu không có/ sai định dạng. */
const extractBearerToken = (req) => {
  const header = req.headers?.authorization || '';
  const [scheme, token] = header.split(' ');
  if (!/^Bearer$/i.test(scheme) || !token) return null;
  return token;
};

/**
 * Refresh token lưu trong DB dưới dạng băm (model User.refreshToken).
 * DB bị lộ cũng không dùng lại được token gốc.
 */
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const safeCompare = (a, b) => {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

module.exports = {
  TOKEN_TYPE,
  signAccessToken,
  signRefreshToken,
  signVerificationToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  verifyVerificationToken,
  extractBearerToken,
  hashToken,
  safeCompare,
};
