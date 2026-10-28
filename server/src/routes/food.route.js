const express = require('express');
const auth = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { uploadFoodImage } = require('../middlewares/upload.middleware');
const foodController = require('../controllers/food.controller');
const {
  createFoodSchema,
  updateFoodSchema,
  deleteFoodSchema,
} = require('../validations/food.validation');
const RC = require('../constants/responseCode');

const router = express.Router();

// GET /food/search — tìm thực phẩm theo từ khoá / danh mục.
// Phải khai báo trước các route có path cụ thể khác để không bị nuốt.
router.get('/search', auth, foodController.searchFoods); // 00188

// GET /food — danh sách thực phẩm của nhóm.
router.get('/', auth, foodController.getFoods); // 00188 (chưa vào nhóm: 00185)

// POST /food — tạo thực phẩm, nhận JSON hoặc multipart/form-data (ảnh ở field `image`).
router.post(
  '/',
  auth,
  uploadFoodImage,
  validate(createFoodSchema, {
    byField: {
      foodName: RC.FOOD_CREATE_INVALID_NAME,          // 00148
      categoryName: RC.FOOD_CREATE_MISSING_CATEGORY,  // 00149
      unitName: RC.FOOD_CREATE_MISSING_UNIT,          // 00150
    },
    missingByField: {
      foodName: RC.FOOD_CREATE_MISSING_FIELDS,        // 00147
      categoryName: RC.FOOD_CREATE_MISSING_CATEGORY,  // 00149
      unitName: RC.FOOD_CREATE_MISSING_UNIT,          // 00150
    },
    fallback: RC.FOOD_CREATE_MISSING_FIELDS,          // 00147
  }),
  foodController.createFood
); // 00160

// PUT /food — sửa tên / danh mục / đơn vị / ảnh.
router.put(
  '/',
  auth,
  uploadFoodImage,
  validate(updateFoodSchema, {
    byField: {
      foodName: RC.FOOD_UPDATE_INVALID_NAME,           // 00162
      newName: RC.FOOD_UPDATE_INVALID_NEW_NAME,        // 00166
      newCategory: RC.FOOD_UPDATE_INVALID_CATEGORY,    // 00164
      newUnit: RC.FOOD_UPDATE_INVALID_UNIT,            // 00165
    },
    missingByField: {
      foodName: RC.FOOD_UPDATE_MISSING_FIELDS,         // 00161
    },
    fallback: RC.FOOD_UPDATE_MISSING_FIELDS,           // 00161
  }),
  foodController.updateFood
); // 00178

// DELETE /food — xoá thực phẩm theo tên (đặc tả dùng body; xem docs/02 mục 2.6).
router.delete(
  '/',
  auth,
  validate(deleteFoodSchema, { fallback: RC.FOOD_DELETE_MISSING_NAME }), // 00179
  foodController.deleteFood
); // 00184

module.exports = router;
