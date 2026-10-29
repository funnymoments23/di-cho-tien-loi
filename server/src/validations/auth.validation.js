const Joi = require('joi');

const email = Joi.string()
  .trim()
  .lowercase()
  .max(255)
  .email({ tlds: { allow: false } });

const password = Joi.string().min(6).max(20);

const registerSchema = Joi.object({
  email: email.required(),
  password: password.required(),
  name: Joi.string().trim().min(3).max(30).required(),
  language: Joi.string().valid('vi', 'en').default('vi'),
  timezone: Joi.string().trim().max(64).default('Asia/Ho_Chi_Minh'),
  deviceId: Joi.string().trim().max(255).allow('', null),
});

const loginSchema = Joi.object({
  email: email.required(),
  password: password.required(),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().trim().required(),
});

const verifyEmailSchema = Joi.object({
  code: Joi.string().trim().length(6).pattern(/^\d+$/).required(),
  token: Joi.string().trim().required(),
});

const sendVerificationCodeSchema = Joi.object({
  email: email.required(),
});

const forgotPasswordSchema = Joi.object({
  email: email.required(),
});

const resetPasswordSchema = Joi.object({
  code: Joi.string().trim().length(6).pattern(/^\d+$/).required(),
  token: Joi.string().trim().required(),
  newPassword: password.required(),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  verifyEmailSchema,
  sendVerificationCodeSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
