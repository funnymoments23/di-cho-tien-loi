const Joi = require('joi');

const foodNameSchema = Joi.string().trim().min(1).max(100);
const lookupNameSchema = Joi.string().trim().min(1).max(50);
const imageSchema = Joi.string().trim().max(500).allow('', null);

/** POST /food — tạo thực phẩm cho nhóm. */
const createFoodSchema = Joi.object({
  foodName: foodNameSchema.required(),
  categoryName: lookupNameSchema.required(),
  unitName: lookupNameSchema.required(),
  image: imageSchema,
});

/**
 * PUT /food — sửa thực phẩm.
 * `foodName` là tên hiện tại (định danh), các trường `new*` là giá trị mới.
 * Không bắt buộc trường mới nào ở đây vì service trả mã riêng (00163)
 * khi không có trường nào được cập nhật, và mã riêng cho từng trường rỗng.
 */
const updateFoodSchema = Joi.object({
  foodName: foodNameSchema.required(),
  newName: foodNameSchema.allow('', null),
  newCategory: lookupNameSchema.allow('', null),
  newUnit: lookupNameSchema.allow('', null),
  image: imageSchema,
});

/** DELETE /food — xoá thực phẩm theo tên. */
const deleteFoodSchema = Joi.object({
  foodName: foodNameSchema.required(),
});

module.exports = {
  createFoodSchema,
  updateFoodSchema,
  deleteFoodSchema,
};
