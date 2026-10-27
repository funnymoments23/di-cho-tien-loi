const express = require('express');
const auth = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const authController = require('../controllers/auth.controller');
const {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  verifyEmailSchema,
  sendVerificationCodeSchema,
} = require('../validations/auth.validation');
const RC = require('../constants/responseCode');

const router = express.Router();

// POST /user — đăng ký, gửi mã xác minh qua email (00035)
router.post(
  '/',
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
  validate(sendVerificationCodeSchema, {
    byField: { email: RC.REGISTER_INVALID_EMAIL }, // 00026
    fallback: RC.SEND_CODE_MISSING_FIELDS,         // 00005
  }),
  authController.sendVerificationCode
);

// POST /user/verify-email — nhập mã 6 số + token xác minh (00058)
router.post(
  '/verify-email',
  validate(verifyEmailSchema, {
    byField: {
      code: RC.VERIFY_CODE_MISMATCH,     // 00054
      token: RC.VERIFY_TOKEN_INVALID,    // 00055
    },
    fallback: RC.VERIFY_CODE_MISSING,    // 00053
  }),
  authController.verifyEmail
);

router.post(
  '/login',
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

module.exports = router;
