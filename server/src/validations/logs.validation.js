const Joi = require('joi');

/**
 * Query của GET /admin/logs.
 * `from` / `to` là ngày YYYY-MM-DD theo giờ Việt Nam; service kiểm tra thêm
 * ngày có tồn tại thật (2026-02-31) và from <= to.
 */
const listLogsQuerySchema = Joi.object({
  action: Joi.string().valid('CREATE', 'UPDATE', 'DELETE'),
  entity: Joi.string().trim().max(50).allow(''),
  userId: Joi.string().hex().length(24),
  groupId: Joi.string().hex().length(24),
  from: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
  to: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = { listLogsQuerySchema };
