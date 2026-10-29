const Joi = require('joi');

const objectIdSchema = Joi.string()
  .trim()
  .pattern(/^[0-9a-fA-F]{24}$/);
const nameSchema = Joi.string().trim().min(1).max(100);
const usernameSchema = Joi.string().trim().min(1).max(50);
const noteSchema = Joi.string().trim().max(500).allow('', null);
const dateSchema = Joi.date().iso().allow(null);
const quantitySchema = Joi.number().positive().max(1_000_000);

/**
 * POST /shopping — trưởng nhóm tạo danh sách đi chợ và giao cho một thành viên.
 * Chỉ `name` và `assignToUsername` là bắt buộc (đặc tả chỉ có mã riêng cho
 * hai trường này); `note` / `date` được kiểm tra định dạng khi có gửi lên.
 */
const createShoppingListSchema = Joi.object({
  name: nameSchema.required(),
  assignToUsername: usernameSchema.required(),
  note: noteSchema,
  date: dateSchema,
});

/**
 * PUT /shopping — sửa danh sách theo `listId`.
 * Không bắt buộc trường mới nào ở đây vì service trả mã riêng (00252)
 * khi không có trường nào được cập nhật.
 */
const updateShoppingListSchema = Joi.object({
  listId: objectIdSchema.required(),
  newName: nameSchema,
  newAssignToUsername: usernameSchema,
  newNote: noteSchema,
  newDate: dateSchema,
});

/** DELETE /shopping — xoá danh sách theo `listId` (đặc tả dùng body). */
const deleteShoppingListSchema = Joi.object({
  listId: objectIdSchema.required(),
});

/** Một món trong mảng `tasks` của POST /shopping/task. */
const taskItemSchema = Joi.object({
  foodName: nameSchema.required(),
  quantity: quantitySchema.required(),
});

/** POST /shopping/task — thêm nhiều món vào một danh sách. */
const createTasksSchema = Joi.object({
  listId: objectIdSchema.required(),
  tasks: Joi.array().items(taskItemSchema).min(1).required(),
});

/** PUT /shopping/task — sửa tên món và/hoặc số lượng (docs/02 mục 1.4). */
const updateTaskSchema = Joi.object({
  taskId: objectIdSchema.required(),
  newFoodName: nameSchema,
  newQuantity: quantitySchema,
});

/** DELETE /shopping/task — xoá một món theo `taskId` (đặc tả dùng body). */
const deleteTaskSchema = Joi.object({
  taskId: objectIdSchema.required(),
});

/**
 * PATCH /shopping/task/:taskId/complete — đánh dấu đã mua xong
 * (API bổ sung, docs/02 mục 3.5).
 */
const completeTaskSchema = Joi.object({
  isCompleted: Joi.boolean().required(),
});

module.exports = {
  createShoppingListSchema,
  updateShoppingListSchema,
  deleteShoppingListSchema,
  createTasksSchema,
  updateTaskSchema,
  deleteTaskSchema,
  completeTaskSchema,
};
