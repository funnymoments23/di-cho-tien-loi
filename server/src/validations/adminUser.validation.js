const Joi = require('joi');

/**
 * GET /admin/user — lọc + phân trang danh sách người dùng.
 * Query được service validate trực tiếp (không dùng validate.middleware vì
 * middleware đó chỉ kiểm tra body).
 */
const listUsersQuerySchema = Joi.object({
  keyword: Joi.string().trim().max(100).allow(''),
  role: Joi.string().valid('user', 'admin'),
  status: Joi.string().valid('active', 'locked'),
  isVerified: Joi.boolean(),
  groupId: Joi.string().hex().length(24),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().valid('createdAt', 'updatedAt', 'name', 'email', 'role').default('createdAt'),
  order: Joi.string().valid('asc', 'desc').default('desc'),
});

/**
 * PUT /admin/user/:id — admin sửa tài khoản người dùng.
 * Chỉ nhận các trường dưới đây; `isActive` có endpoint riêng (PATCH .../status)
 * để thao tác khoá/mở khoá có mã response và kiểm tra riêng.
 */
const updateUserByAdminSchema = Joi.object({
  name: Joi.string().trim().min(3).max(30),
  email: Joi.string().trim().lowercase().email(),
  username: Joi.string().trim().min(3).max(15),
  avatar: Joi.string().trim().max(500).allow('', null),
  gender: Joi.string().valid('female', 'male', 'other').allow(null),
  birthday: Joi.date().iso().max('now').allow(null),
  language: Joi.string().valid('vi', 'en'),
  timezone: Joi.string().trim().max(64),
  role: Joi.string().valid('user', 'admin'),
  isVerified: Joi.boolean(),
}).min(1);

/** PATCH /admin/user/:id/status — khoá / mở khoá tài khoản. */
const updateUserStatusSchema = Joi.object({
  isActive: Joi.boolean().required(),
});

module.exports = {
  listUsersQuerySchema,
  updateUserByAdminSchema,
  updateUserStatusSchema,
};
