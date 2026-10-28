const Joi = require('joi');

const nameSchema = Joi.string().trim().min(1).max(50);

/** POST /admin/category — tạo danh mục. */
const createCategorySchema = Joi.object({
  name: nameSchema.required(),
});

/** PUT /admin/category — đổi tên danh mục (name cũ -> newName). */
const updateCategorySchema = Joi.object({
  name: nameSchema.required(),
  newName: nameSchema.required(),
});

/** DELETE /admin/category — xoá danh mục theo tên. */
const deleteCategorySchema = Joi.object({
  name: nameSchema.required(),
});

module.exports = {
  createCategorySchema,
  updateCategorySchema,
  deleteCategorySchema,
};
