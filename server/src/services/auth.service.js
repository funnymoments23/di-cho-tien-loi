const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/user.models');
const RC = require('../constants/responseCode');
const { fail } = require('../utils/response');
const { sendVerificationCode: sendVerificationEmail } = require('../utils/email');
const {
  generateTokenPair,
  signVerificationToken,
  verifyRefreshToken,
  verifyVerificationToken,
  hashToken,
  safeCompare,
} = require('../utils/jwt');

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;
const CODE_TTL_MINUTES = Number(process.env.VERIFICATION_CODE_TTL_MINUTES) || 10;
const CODE_TTL_MS = CODE_TTL_MINUTES * 60 * 1000;

/** Bỏ các trường nội bộ (password, refreshToken, mã xác minh) trước khi trả client. */
const toPublicUser = (user) => ({
  id: user._id,
  email: user.email,
  name: user.name,
  username: user.username ?? null,
  avatar: user.avatar ?? null,
  language: user.language,
  timezone: user.timezone,
  role: user.role,
  groupId: user.groupId,
  isVerified: user.isVerified,
});

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
  if (user.isVerified) return { alreadyVerified: true };

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

  // Không khớp hash đang lưu => token đã bị thu hồi (logout) hoặc đã rotate.
  const stored = user.refreshToken;
  if (!stored || !safeCompare(hashToken(refreshToken), stored)) {
    throw fail(RC.REFRESH_TOKEN_UNVERIFIABLE); // 00063
  }

  return issueTokens(user);
};

const logout = async (userId) => {
  await User.updateOne({ _id: userId }, { $set: { refreshToken: null } });
};

module.exports = { register, sendVerificationCode, verifyEmail, login, refresh, logout };
