const express = require('express');
const auth = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const fridgeController = require('../controllers/fridge.controller');
const {
  createFridgeItemSchema,
  updateFridgeItemSchema,
  deleteFridgeItemSchema,
} = require('../validations/fridge.validation');
const RC = require('../constants/responseCode');

const router = express.Router();

// GET /fridge/item — xem một mục theo tên thực phẩm.
// Phải khai báo trước route '/' để không bị nuốt.
router.get('/item', auth, fridgeController.getFridgeItem); // 00237 (chưa vào nhóm: 00225)

// GET /fridge — danh sách đồ trong tủ của nhóm.
router.get('/', auth, fridgeController.getFridgeItems); // 00228 (chưa vào nhóm: 00225)

// POST /fridge — thêm thực phẩm vào tủ.
router.post(
  '/',
  auth,
  validate(createFridgeItemSchema, {
    byField: {
      foodName: RC.FRIDGE_CREATE_INVALID_FOOD_NAME,    // 00190
      useWithin: RC.FRIDGE_CREATE_INVALID_USE_WITHIN,  // 00191
      quantity: RC.FRIDGE_CREATE_INVALID_QUANTITY,     // 00192
      note: RC.FRIDGE_CREATE_INVALID_NOTE,             // 00193
    },
    missingByField: {
      foodName: RC.FRIDGE_CREATE_INVALID_FOOD_NAME,    // 00190
      useWithin: RC.FRIDGE_CREATE_INVALID_USE_WITHIN,  // 00191
      quantity: RC.FRIDGE_CREATE_INVALID_QUANTITY,     // 00192
      note: RC.FRIDGE_CREATE_INVALID_NOTE,             // 00193
    },
    fallback: RC.FRIDGE_CREATE_INVALID_FOOD_NAME,      // 00190
  }),
  fridgeController.createFridgeItem
); // 00202

// PUT /fridge — sửa mục trong tủ theo itemId.
router.put(
  '/',
  auth,
  validate(updateFridgeItemSchema, {
    byField: {
      itemId: RC.FRIDGE_UPDATE_MISSING_ITEM_ID,            // 00204
      newFoodName: RC.FRIDGE_UPDATE_INVALID_FOOD_NAME,     // 00207
      newUseWithin: RC.FRIDGE_UPDATE_INVALID_USE_WITHIN,   // 00205
      newQuantity: RC.FRIDGE_UPDATE_INVALID_QUANTITY,      // 00206
      newNote: RC.FRIDGE_UPDATE_INVALID_NOTE,              // 00207
    },
    missingByField: {
      itemId: RC.FRIDGE_UPDATE_MISSING_ITEM_ID,            // 00204
    },
    fallback: RC.FRIDGE_UPDATE_MISSING_FIELDS,             // 00203
  }),
  fridgeController.updateFridgeItem
); // 00216

// DELETE /fridge — xoá mục theo tên thực phẩm (đặc tả dùng body; xem docs/02 mục 2.6).
router.delete(
  '/',
  auth,
  validate(deleteFridgeItemSchema, {
    fallback: RC.FRIDGE_DELETE_MISSING_FOOD_NAME, // 00217
  }),
  fridgeController.deleteFridgeItem
); // 00224

module.exports = router;
