const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/user.models');
const RC = require('../constants/responseCode');
const { fail } = require('../utils/response');
const { toPublicUser } = require('../utils/serializers');
const { sendVerificationCode: sendVerificationEmail, sendPasswordResetCode } = require('../utils/email');
const {
  generateTokenPair,
  signVerificationToken,
  signPasswordResetToken,
  verifyRefreshToken,
  verifyVerificationToken,
  verifyPasswordResetToken,
  hashToken,
  safeCompare,
} = require('../utils/jwt');

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;
const CODE_TTL_MINUTES = Number(process.env.VERIFICATION_CODE_TTL_MINUTES) || 10;
const CODE_TTL_MS = CODE_TTL_MINUTES * 60 * 1000;
const RESET_CODE_TTL_MINUTES = Number(process.env.PASSWORD_RESET_CODE_TTL_MINUTES) || 10;
const RESET_CODE_TTL_MS = RESET_CODE_TTL_MINUTES * 60 * 1000;

const generateVerificationCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

/**
 * Sinh mã 6 số mới, lưu hạn 10 phút rồi gửi qua email.
 * Trả về token xác minh để client gửi kèm ở bước verify-email.
 */
const issueVerification = async (user) => {
  const code = generateVerificationCode();
  user.verificationCode = code;
  user.verificationCodeExpiresAt = new Date(Date.now() + CODE_TTL_MS);
  await user.save();

  await sendVerificationEmail(user.email, code);

  return {
    verificationToken: signVerificationToken(user),
    codeExpiresIn: CODE_TTL_MINUTES * 60,
  };
};

const register = async ({ email, password, name, language, timezone, deviceId }) => {
  // Email đã được Joi chuẩn hoá (trim + lowercase) trước khi vào đây.
  if (await User.exists({ email })) throw fail(RC.REGISTER_EMAIL_EXISTS); // 00032

  const user = await User.create({
    email,
    password: await bcrypt.hash(password, BCRYPT_ROUNDS),
    name,
    language,
    timezone,
    deviceToken: deviceId || null,
    isVerified: false,
  });

  const verification = await issueVerification(user);

  return { user: toPublicUser(user), ...verification };
};

const sendVerificationCode = async ({ email }) => {
  const user = await User.findOne({ email });
  if (!user) throw fail(RC.EMAIL_ACCOUNT_NOT_FOUND); // 00036

  // Tài khoản đã xác minh rồi thì không gửi lại mã, tránh spam.
  // Controller trả mã 00058 (email đã xác minh) thay vì 00048 ("đã gửi mã").
  if (user.isVerified) return { alreadyVerified: true, user: toPublicUser(user) };

  const verification = await issueVerification(user);
  return { alreadyVerified: false, ...verification };
};

const verifyEmail = async ({ code, token }) => {
  const payload = verifyVerificationToken(token); // 00055 nếu token sai/hết hạn

  if (!mongoose.isValidObjectId(payload.sub)) throw fail(RC.VERIFY_TOKEN_INVALID);

  const user = await User.findById(payload.sub).select(
    '+verificationCode +verificationCodeExpiresAt'
  );
  if (!user) throw fail(RC.USER_NOT_FOUND); // 00052

  if (user.isVerified) return { user: toPublicUser(user), alreadyVerified: true };

  if (!user.verificationCode || !safeCompare(user.verificationCode, code)) {
    throw fail(RC.VERIFY_CODE_MISMATCH); // 00054
  }
  if (!user.verificationCodeExpiresAt || user.verificationCodeExpiresAt.getTime() < Date.now()) {
    throw fail(RC.VERIFY_CODE_MISMATCH); // 00054 — mã đã quá 10 phút
  }

  user.isVerified = true;
  user.verificationCode = undefined;
  user.verificationCodeExpiresAt = undefined;
  await user.save();

  return { user: toPublicUser(user) };
};

/**
 * Quên mật khẩu — bước 1: sinh mã 6 số mới (hạn 10 phút), gửi qua email và trả
 * token đặt lại mật khẩu để client gửi kèm ở bước 2.
 *
 * Mã đặt lại nằm ở trường riêng (`passwordResetCode`), không dùng chung mã xác
 * minh email, nên đang xác minh email dở dang cũng không bị ảnh hưởng.
 */
const issuePasswordReset = async (user) => {
  const code = generateVerificationCode();
  user.passwordResetCode = code;
  user.passwordResetCodeExpiresAt = new Date(Date.now() + RESET_CODE_TTL_MS);
  await user.save();

  await sendPasswordResetCode(user.email, code);

  return {
    resetToken: signPasswordResetToken(user),
    codeExpiresIn: RESET_CODE_TTL_MINUTES * 60,
  };
};

const forgotPassword = async ({ email }) => {
  const user = await User.findOne({ email });
  if (!user) throw fail(RC.EMAIL_ACCOUNT_NOT_FOUND); // 00036

  return issuePasswordReset(user);
};

/**
 * Quên mật khẩu — bước 2: kiểm tra mã + token rồi đặt mật khẩu mới.
 *
 * Thu hồi refresh token đang lưu (giống change-password) để mọi phiên cũ phải
 * đăng nhập lại bằng mật khẩu mới. Mã đặt lại bị xoá sau khi dùng, nên token cũ
 * không thể phát lại lần hai.
 */
const resetPassword = async ({ code, token, newPassword }) => {
  const payload = verifyPasswordResetToken(token); // 00055 nếu token sai/hết hạn

  if (!mongoose.isValidObjectId(payload.sub)) throw fail(RC.RESET_PASSWORD_TOKEN_INVALID); // 00055

  const user = await User.findById(payload.sub).select(
    '+password +passwordResetCode +passwordResetCodeExpiresAt'
  );
  if (!user) throw fail(RC.USER_NOT_FOUND); // 00052

  if (!user.passwordResetCode || !safeCompare(user.passwordResetCode, code)) {
    throw fail(RC.RESET_PASSWORD_CODE_INVALID); // 00067
  }
  if (
    !user.passwordResetCodeExpiresAt ||
    user.passwordResetCodeExpiresAt.getTime() < Date.now()
  ) {
    throw fail(RC.RESET_PASSWORD_CODE_INVALID); // 00067 — mã đã quá 10 phút
  }

  // Mật khẩu mới không được trùng mật khẩu hiện tại (00073).
  if (user.password && (await bcrypt.compare(newPassword, user.password))) {
    throw fail(RC.NEW_PASSWORD_SAME_AS_OLD);
  }

  user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  user.passwordResetCode = undefined;
  user.passwordResetCodeExpiresAt = undefined;
  user.refreshToken = null;
  await user.save();
};

/**
 * Cấp cặp token mới và lưu bản băm của refresh token vào user.
 * Rotate: mỗi lần refresh, hash cũ bị ghi đè -> token cũ không dùng lại được.
 */
const issueTokens = async (user) => {
  const tokens = generateTokenPair(user);
  await User.updateOne({ _id: user._id }, { $set: { refreshToken: hashToken(tokens.refreshToken) } });
  return tokens;
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password');

  if (!user) throw fail(RC.LOGIN_ACCOUNT_NOT_FOUND); // 00042
  // Tài khoản bị admin khoá thì không được đăng nhập dù mật khẩu đúng.
  if (user.isActive === false) throw fail(RC.ACCOUNT_LOCKED); // 00403
  // Model chỉ có isVerified (00043 dành cho trường hợp chưa kích hoạt tài khoản).
  if (!user.isVerified) throw fail(RC.LOGIN_EMAIL_NOT_VERIFIED); // 00044

  const matched = user.password ? await bcrypt.compare(password, user.password) : false;
  if (!matched) throw fail(RC.LOGIN_WRONG_CREDENTIALS); // 00045

  const tokens = await issueTokens(user);
  return { user: toPublicUser(user), ...tokens };
};

const refresh = async (refreshToken) => {
  const payload = verifyRefreshToken(refreshToken); // 00062 / 00063

  if (!mongoose.isValidObjectId(payload.sub)) throw fail(RC.REFRESH_TOKEN_UNVERIFIABLE);

  const user = await User.findById(payload.sub).select('+refreshToken');
  if (!user) throw fail(RC.REFRESH_TOKEN_USER_MISMATCH); // 00061
  // Tài khoản bị khoá thì không được cấp lại token.
  if (user.isActive === false) throw fail(RC.ACCOUNT_LOCKED); // 00403

  // Không khớp hash đang lưu => token đã bị thu hồi (logout) hoặc đã rotate.
  const stored = user.refreshToken;
  if (!stored || !safeCompare(hashToken(refreshToken), stored)) {
    throw fail(RC.REFRESH_TOKEN_UNVERIFIABLE); // 00063
  }

  return issueTokens(user);
};

const logout = async (userId) => {
  // Token hợp lệ nhưng user đã bị xoá -> không được báo đăng xuất thành công.
  if (!mongoose.isValidObjectId(userId)) throw fail(RC.USER_NOT_FOUND); // 00052

  const result = await User.updateOne({ _id: userId }, { $set: { refreshToken: null } });
  if (result.matchedCount === 0) throw fail(RC.USER_NOT_FOUND); // 00052
};

module.exports = {
  register,
  sendVerificationCode,
  verifyEmail,
  forgotPassword,
  resetPassword,
  login,
  refresh,
  logout,
};
