const express = require('express');
const auth = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { authRateLimiter } = require('../middlewares/rateLimit.middleware');
const { uploadAvatar } = require('../middlewares/upload.middleware');
const authController = require('../controllers/auth.controller');
const userController = require('../controllers/user.controller');
const {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  verifyEmailSchema,
  sendVerificationCodeSchema,
} = require('../validations/auth.validation');
const {
  updateUserSchema,
  changePasswordSchema,
  deviceTokenSchema,
} = require('../validations/user.validation');
const RC = require('../constants/responseCode');

const router = express.Router();

// POST /user — đăng ký, gửi mã xác minh qua email (00035)
router.post(
  '/',
  authRateLimiter,
  validate(registerSchema, {
    byField: {
      email: RC.REGISTER_INVALID_EMAIL,       // 00026
      password: RC.REGISTER_INVALID_PASSWORD, // 00027
      name: RC.REGISTER_INVALID_NAME,         // 00028
    },
    fallback: RC.REGISTER_MISSING_FIELDS,     // 00025
  }),
  authController.register
);

// POST /user/send-verification-code — gửi lại mã xác minh (00048)
router.post(
  '/send-verification-code',
  authRateLimiter,
  validate(sendVerificationCodeSchema, {
    byField: { email: RC.REGISTER_INVALID_EMAIL }, // 00026
    fallback: RC.SEND_CODE_MISSING_FIELDS,         // 00005
  }),
  authController.sendVerificationCode
);

// POST /user/verify-email — nhập mã 6 số + token xác minh (00058)
router.post(
  '/verify-email',
  authRateLimiter,
  validate(verifyEmailSchema, {
    byField: {
      code: RC.VERIFY_CODE_MISMATCH,     // 00054
      token: RC.VERIFY_TOKEN_INVALID,    // 00055
    },
    missingByField: {
      // Thiếu token là lỗi token, không phải "thiếu mã xác nhận" (00053).
      token: RC.VERIFY_TOKEN_INVALID,    // 00055
    },
    fallback: RC.VERIFY_CODE_MISSING,    // 00053
  }),
  authController.verifyEmail
);

router.post(
  '/login',
  authRateLimiter,
  validate(loginSchema, {
    byField: {
      email: RC.LOGIN_INVALID_EMAIL,     // 00039
      password: RC.LOGIN_INVALID_PASSWORD, // 00040
    },
    fallback: RC.LOGIN_MISSING_FIELDS,   // 00038
  }),
  authController.login
);

router.post(
  '/refresh-token',
  validate(refreshTokenSchema, { fallback: RC.REFRESH_TOKEN_MISSING }), // 00059
  authController.refresh
);

router.post('/logout', auth, authController.logout); // 00006 nếu thiếu token

// ===== Nhóm Tài khoản (hồ sơ cá nhân) =====

// GET /user — xem hồ sơ của chính mình (00089)
router.get('/', auth, userController.getProfile);

// PUT /user — sửa hồ sơ, nhận JSON hoặc multipart/form-data (ảnh ở field `image`)
router.put(
  '/',
  auth,
  uploadAvatar,
  validate(updateUserSchema, {
    byField: {
      name: RC.EDIT_USER_INVALID_NAME,           // 00077
      username: RC.EDIT_USER_INVALID_USERNAME,   // 00081
      gender: RC.EDIT_USER_INVALID_GENDER,       // 00078
      birthday: RC.EDIT_USER_INVALID_BIRTHDAY,   // 00080
      language: RC.EDIT_USER_INVALID_LANGUAGE,   // 00079
    },
    fallback: RC.EDIT_USER_INVALID_NAME,
  }),
  userController.updateProfile
);

// DELETE /user — xoá tài khoản của chính mình (00092)
router.delete('/', auth, userController.deleteAccount);

// POST /user/change-password — đổi mật khẩu khi đang đăng nhập (00076)
router.post(
  '/change-password',
  auth,
  authRateLimiter,
  validate(changePasswordSchema, {
    byField: {
      oldPassword: RC.CHANGE_PASSWORD_INVALID_FORMAT, // 00069
      newPassword: RC.CHANGE_PASSWORD_INVALID_FORMAT, // 00069
    },
    fallback: RC.CHANGE_PASSWORD_INVALID_FORMAT,
  }),
  userController.changePassword
);

// PUT /user/device-token — cập nhật Expo push token (đặc tả thiếu, xem docs/02 mục 3.4)
router.put(
  '/device-token',
  auth,
  validate(deviceTokenSchema, { fallback: RC.REGISTER_MISSING_FIELDS }), // 00025
  userController.updateDeviceToken
);

module.exports = router;
