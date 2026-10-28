const Joi = require('joi');

const foodNameSchema = Joi.string().trim().min(1).max(100);
const objectIdSchema = Joi.string()
  .trim()
  .pattern(/^[0-9a-fA-F]{24}$/);
const quantitySchema = Joi.number().positive().max(1_000_000);
const useWithinSchema = Joi.date().iso();
const noteSchema = Joi.string().trim().max(500).allow('', null);
const locationSchema = Joi.string().trim().max(50).allow('', null);

/** POST /fridge — thêm một thực phẩm vào tủ lạnh của nhóm. */
const createFridgeItemSchema = Joi.object({
  foodName: foodNameSchema.required(),
  useWithin: useWithinSchema.required(),
  quantity: quantitySchema.required(),
  note: noteSchema,
  // Trường bổ sung của nhóm (đề mục B.3, docs/02 mục 3.6).
  location: locationSchema,
});

/**
 * PUT /fridge — sửa mục trong tủ theo `itemId`.
 * Không bắt buộc trường mới nào ở đây vì service trả mã riêng (00204)
 * khi không có trường nào được cập nhật, và mã riêng cho từng trường không hợp lệ.
 */
const updateFridgeItemSchema = Joi.object({
  itemId: objectIdSchema.required(),
  newFoodName: foodNameSchema.allow('', null),
  newUseWithin: useWithinSchema,
  newQuantity: quantitySchema,
  newNote: noteSchema,
  newLocation: locationSchema,
});

/** DELETE /fridge — xoá mục trong tủ theo tên thực phẩm (đặc tả dùng body). */
const deleteFridgeItemSchema = Joi.object({
  foodName: foodNameSchema.required(),
});

module.exports = {
  createFridgeItemSchema,
  updateFridgeItemSchema,
  deleteFridgeItemSchema,
};
