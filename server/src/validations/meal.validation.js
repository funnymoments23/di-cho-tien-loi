const Joi = require('joi');

const foodNameSchema = Joi.string().trim().min(1).max(100);
const objectIdSchema = Joi.string()
  .trim()
  .pattern(/^[0-9a-fA-F]{24}$/);
// Tên bữa được service chuẩn hoá thành sáng / trưa / tối (mã 00316).
// Ở đây chỉ kiểm tra kiểu và độ dài để service trả đúng mã riêng.
const mealNameSchema = Joi.string().trim().min(1).max(20);

/** POST /meal — xếp một món vào bữa sáng / trưa / tối của một ngày. */
const createMealPlanSchema = Joi.object({
  foodName: foodNameSchema.required(),
  timestamp: Joi.date().iso().required(),
  name: mealNameSchema.required(),
});

/**
 * PUT /meal — sửa món / ngày / tên bữa.
 * Không bắt buộc trường mới nào vì service trả mã riêng (00333) khi không có
 * trường nào được cập nhật, và mã riêng cho từng trường không hợp lệ.
 */
const updateMealPlanSchema = Joi.object({
  planId: objectIdSchema.required(),
  newFoodName: foodNameSchema.allow('', null),
  newTimestamp: Joi.date().iso(),
  newName: mealNameSchema.allow('', null),
});

/** DELETE /meal — xoá kế hoạch theo planId (đặc tả dùng body). */
const deleteMealPlanSchema = Joi.object({
  planId: objectIdSchema.required(),
});

module.exports = {
  createMealPlanSchema,
  updateMealPlanSchema,
  deleteMealPlanSchema,
};
