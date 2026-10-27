const { fail } = require('../utils/response');

/**
 * Middleware kiểm tra body bằng Joi.
 *
 * @param {import('joi').Schema} schema  schema Joi cho req.body
 * @param {object} options
 * @param {object} [options.byField]     map tên trường -> response code khi sai định dạng
 * @param {object} options.fallback       response code khi thiếu trường/không khớp map nào
 *
 * Ví dụ: validate(loginSchema, {
 *   byField: { email: RC.LOGIN_INVALID_EMAIL, password: RC.LOGIN_INVALID_PASSWORD },
 *   fallback: RC.LOGIN_MISSING_FIELDS,
 * })
 */
const validate = (schema, { byField = {}, fallback } = {}) => {
  if (!fallback) {
    throw new Error('validate() cần tham số fallback (mã lỗi mặc định).');
  }

  return (req, res, next) => {
    const { value, error } = schema.validate(req.body ?? {}, {
      abortEarly: true,
      stripUnknown: true,
    });

    if (!error) {
      req.body = value;
      return next();
    }

    const detail = error.details[0];
    const field = detail.path?.[0];
    // Thiếu hẳn trường -> "thiếu thông tin"; sai định dạng -> mã riêng của trường đó.
    const isMissing = detail.type === 'any.required' || detail.type === 'string.empty';
    const rc = (!isMissing && byField[field]) || fallback;

    next(fail(rc));
  };
};

module.exports = validate;
