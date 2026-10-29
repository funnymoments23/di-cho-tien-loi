const express = require('express');
const auth = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const shoppingController = require('../controllers/shopping.controller');
const {
  createShoppingListSchema,
  updateShoppingListSchema,
  deleteShoppingListSchema,
  createTasksSchema,
  updateTaskSchema,
  deleteTaskSchema,
  completeTaskSchema,
} = require('../validations/shopping.validation');
const RC = require('../constants/responseCode');

const router = express.Router();

// ===== Món cần mua (shopping/task) =====

// PATCH /shopping/task/:taskId/complete — tick đã mua xong (API bổ sung, docs/02 mục 3.5).
router.patch(
  '/task/:taskId/complete',
  auth,
  validate(completeTaskSchema, {
    byField: { isCompleted: RC.TASK_UPDATE_MISSING_FIELDS },      // 00300
    missingByField: { isCompleted: RC.TASK_UPDATE_MISSING_FIELDS }, // 00300
    fallback: RC.TASK_UPDATE_MISSING_FIELDS,                       // 00300
  }),
  shoppingController.completeTask
); // 00312

// GET /shopping/task — danh sách đi chợ của nhóm kèm các món.
// Khai báo trước route '/' để không bị nuốt.
router.get('/task', auth, shoppingController.getShoppingLists); // 00292 (chưa vào nhóm: 00288)

// POST /shopping/task — thêm mảng món vào một danh sách.
router.post(
  '/task',
  auth,
  validate(createTasksSchema, {
    byField: {
      listId: RC.TASK_CREATE_MISSING_LIST_ID,   // 00277
      tasks: RC.TASK_CREATE_INVALID_TASKS,      // 00279
    },
    missingByField: {
      listId: RC.TASK_CREATE_MISSING_LIST_ID,   // 00277
      tasks: RC.TASK_CREATE_MISSING_TASKS,      // 00278
    },
    fallback: RC.TASK_CREATE_MISSING_FIELDS,    // 00276
  }),
  shoppingController.createTasks
); // 00287

// PUT /shopping/task — sửa tên món / số lượng.
router.put(
  '/task',
  auth,
  validate(updateTaskSchema, {
    byField: {
      taskId: RC.TASK_UPDATE_MISSING_TASK_ID,     // 00301
      newFoodName: RC.TASK_UPDATE_INVALID_FOOD_NAME, // 00303
      newQuantity: RC.TASK_UPDATE_INVALID_QUANTITY,  // 00304
    },
    missingByField: {
      taskId: RC.TASK_UPDATE_MISSING_TASK_ID,     // 00301
      newFoodName: RC.TASK_UPDATE_INVALID_FOOD_NAME, // 00303
    },
    fallback: RC.TASK_UPDATE_MISSING_FIELDS,      // 00300
  }),
  shoppingController.updateTask
); // 00312

// DELETE /shopping/task — xoá một món theo taskId (đặc tả dùng body).
router.delete(
  '/task',
  auth,
  validate(deleteTaskSchema, {
    missingByField: { taskId: RC.TASK_DELETE_MISSING_TASK_ID }, // 00294
    fallback: RC.TASK_DELETE_MISSING_FIELDS,                    // 00293
  }),
  shoppingController.deleteTask
); // 00299

// ===== Danh sách đi chợ (shopping) =====

// GET /shopping — API bổ sung cùng dữ liệu với GET /shopping/task,
// dùng cho màn hình danh sách đi chợ (docs/01 màn hình 7).
router.get('/', auth, shoppingController.getShoppingLists); // 00292 (chưa vào nhóm: 00288)

// POST /shopping — trưởng nhóm tạo danh sách và giao cho thành viên.
router.post(
  '/',
  auth,
  validate(createShoppingListSchema, {
    byField: {
      name: RC.SHOPPING_CREATE_MISSING_NAME,             // 00239
      assignToUsername: RC.SHOPPING_CREATE_MISSING_ASSIGNEE, // 00240
      note: RC.SHOPPING_CREATE_INVALID_NOTE,             // 00241
      date: RC.SHOPPING_CREATE_INVALID_DATE,             // 00242
    },
    missingByField: {
      name: RC.SHOPPING_CREATE_MISSING_NAME,             // 00239
      assignToUsername: RC.SHOPPING_CREATE_MISSING_ASSIGNEE, // 00240
    },
    fallback: RC.SHOPPING_CREATE_MISSING_FIELDS,         // 00238
  }),
  shoppingController.createShoppingList
); // 00249

// PUT /shopping — sửa danh sách theo listId.
router.put(
  '/',
  auth,
  validate(updateShoppingListSchema, {
    byField: {
      listId: RC.SHOPPING_UPDATE_MISSING_LIST_ID,            // 00251
      newName: RC.SHOPPING_UPDATE_INVALID_NAME,              // 00253
      newAssignToUsername: RC.SHOPPING_UPDATE_INVALID_ASSIGNEE, // 00254
      newNote: RC.SHOPPING_UPDATE_INVALID_NOTE,              // 00255
      newDate: RC.SHOPPING_UPDATE_INVALID_DATE,              // 00256
    },
    missingByField: {
      listId: RC.SHOPPING_UPDATE_MISSING_LIST_ID,            // 00251
      newName: RC.SHOPPING_UPDATE_INVALID_NAME,              // 00253
      newAssignToUsername: RC.SHOPPING_UPDATE_INVALID_ASSIGNEE, // 00254
    },
    fallback: RC.SHOPPING_UPDATE_MISSING_FIELDS,             // 00250
  }),
  shoppingController.updateShoppingList
); // 00266

// DELETE /shopping — xoá danh sách theo listId (đặc tả dùng body).
router.delete(
  '/',
  auth,
  validate(deleteShoppingListSchema, {
    missingByField: { listId: RC.SHOPPING_DELETE_MISSING_LIST_ID }, // 00268
    fallback: RC.SHOPPING_DELETE_MISSING_FIELDS,                    // 00267
  }),
  shoppingController.deleteShoppingList
); // 00275

module.exports = router;
