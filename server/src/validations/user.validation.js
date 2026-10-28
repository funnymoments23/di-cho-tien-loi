const Joi = require('joi');

/**
 * PUT /user — sửa hồ sơ.
 * Không khai báo email, role, isVerified... nên validate (stripUnknown) sẽ loại bỏ,
 * client không thể tự đổi quyền hay đổi email qua endpoint này.
 */
const updateUserSchema = Joi.object({
  name: Joi.string().trim().min(3).max(30),
  username: Joi.string().trim().min(3).max(15),
  gender: Joi.string().valid('female', 'male', 'other'),
  birthday: Joi.date().iso().max('now').allow(null),
  language: Joi.string().valid('vi', 'en'),
  timezone: Joi.string().trim().max(64),
  // Cho phép gửi URL ảnh có sẵn; nếu upload file thì controller ghi đè bằng đường dẫn file.
  avatar: Joi.string().trim().max(500).allow('', null),
});

const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().min(6).max(20).required(),
  newPassword: Joi.string().min(6).max(20).required(),
});

const deviceTokenSchema = Joi.object({
  deviceToken: Joi.string().trim().max(512).required(),
});

module.exports = {
  updateUserSchema,
  changePasswordSchema,
  deviceTokenSchema,
};
