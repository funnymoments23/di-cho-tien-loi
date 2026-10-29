const Joi = require('joi');

const foodNameSchema = Joi.string().trim().min(1).max(100);
const objectIdSchema = Joi.string()
  .trim()
  .pattern(/^[0-9a-fA-F]{24}$/);
const recipeNameSchema = Joi.string().trim().min(1).max(200);
const descriptionSchema = Joi.string().trim().min(1).max(2000);
const htmlContentSchema = Joi.string().min(1).max(200_000);

/** POST /recipe — thêm công thức cho một món ăn của nhóm. */
const createRecipeSchema = Joi.object({
  foodName: foodNameSchema.required(),
  name: recipeNameSchema.required(),
  description: descriptionSchema.required(),
  htmlContent: htmlContentSchema.required(),
});

/**
 * PUT /recipe — sửa món / tên / mô tả / nội dung HTML.
 * Không bắt buộc trường mới nào để service trả đúng mã 00360 và mã riêng
 * cho từng trường không hợp lệ (00361–00364).
 */
const updateRecipeSchema = Joi.object({
  recipeId: objectIdSchema.required(),
  newFoodName: foodNameSchema.allow('', null),
  newName: recipeNameSchema.allow('', null),
  newDescription: descriptionSchema.allow('', null),
  newHtmlContent: htmlContentSchema.allow('', null),
});

/** DELETE /recipe — xoá công thức theo recipeId (đặc tả dùng body). */
const deleteRecipeSchema = Joi.object({
  recipeId: objectIdSchema.required(),
});

module.exports = {
  createRecipeSchema,
  updateRecipeSchema,
  deleteRecipeSchema,
};
