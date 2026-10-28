const Joi = require('joi');

const nameSchema = Joi.string().trim().min(1).max(50);

/** POST /admin/unit — tạo đơn vị đo. */
const createUnitSchema = Joi.object({
  name: nameSchema.required(),
});

/** PUT /admin/unit — đổi tên đơn vị (name cũ -> newName). */
const updateUnitSchema = Joi.object({
  name: nameSchema.required(),
  newName: nameSchema.required(),
});

/** DELETE /admin/unit — xoá đơn vị theo tên. */
const deleteUnitSchema = Joi.object({
  name: nameSchema.required(),
});

module.exports = {
  createUnitSchema,
  updateUnitSchema,
  deleteUnitSchema,
};
