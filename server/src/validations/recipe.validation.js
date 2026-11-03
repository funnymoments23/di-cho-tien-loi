const Joi = require('joi');

const foodNameSchema = Joi.string().trim().min(1).max(100);
const objectIdSchema = Joi.string()
  .trim()
  .pattern(/^[0-9a-fA-F]{24}$/);
const recipeNameSchema = Joi.string().trim().min(1).max(200);
const descriptionSchema = Joi.string().trim().min(1).max(2000);
const htmlContentSchema = Joi.string().min(1).max(200_000);
const ingredientSchema = Joi.object({
  foodName: foodNameSchema.required(),
  quantity: Joi.number().positive().max(1_000_000).required(),
});
const ingredientsSchema = Joi.array().items(ingredientSchema).max(50);

/** POST /recipe — thêm công thức cho một món ăn của nhóm. */
const createRecipeSchema = Joi.object({
  // Không bắt buộc: app hiện cho phép tạo công thức chỉ với nguyên liệu.
  foodName: foodNameSchema.allow('', null),
  name: recipeNameSchema.required(),
  description: descriptionSchema.required(),
  htmlContent: htmlContentSchema.required(),
  // Một công thức có thể dùng nhiều nguyên liệu; không bắt buộc để tương thích
  // với dữ liệu cũ và các client chỉ gửi món ăn chính.
  ingredients: ingredientsSchema,
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
  newIngredients: ingredientsSchema,
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
