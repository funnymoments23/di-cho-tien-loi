const express = require('express');
const auth = require('../middlewares/auth.middleware');
const admin = require('../middlewares/admin.middleware');
const validate = require('../middlewares/validate.middleware');
const categoryController = require('../controllers/category.controller');
const unitController = require('../controllers/unit.controller');
const {
  createCategorySchema,
  updateCategorySchema,
  deleteCategorySchema,
} = require('../validations/category.validation');
const {
  createUnitSchema,
  updateUnitSchema,
  deleteUnitSchema,
} = require('../validations/unit.validation');
const RC = require('../constants/responseCode');

const router = express.Router();

// ===== Nhóm Danh mục (category) =====
// GET mở cho mọi tài khoản đã đăng nhập vì app cần danh mục để tạo thực phẩm.
router.get('/category', auth, categoryController.getCategories); // 00129

// Thêm/sửa/xoá chỉ dành cho quản trị viên hệ thống (role = admin).
router.post(
  '/category',
  auth,
  admin(), // 00017
  validate(createCategorySchema, { fallback: RC.CATEGORY_CREATE_MISSING_NAME }), // 00131
  categoryController.createCategory
); // 00135

router.put(
  '/category',
  auth,
  admin(), // 00017
  validate(updateCategorySchema, { fallback: RC.CATEGORY_UPDATE_MISSING_FIELDS }), // 00136
  categoryController.updateCategory
); // 00141

router.delete(
  '/category',
  auth,
  admin(), // 00017
  validate(deleteCategorySchema, { fallback: RC.CATEGORY_DELETE_MISSING_NAME }), // 00142
  categoryController.deleteCategory
); // 00146

// ===== Nhóm Đơn vị đo (unit) =====
router.get('/unit', auth, unitController.getUnits); // 00110

router.post(
  '/unit',
  auth,
  admin(), // 00017
  validate(createUnitSchema, { fallback: RC.UNIT_CREATE_MISSING_NAME }), // 00112
  unitController.createUnit
); // 00116

router.put(
  '/unit',
  auth,
  admin(), // 00017
  validate(updateUnitSchema, { fallback: RC.UNIT_UPDATE_MISSING_FIELDS }), // 00117
  unitController.updateUnit
); // 00122

router.delete(
  '/unit',
  auth,
  admin(), // 00017
  validate(deleteUnitSchema, { fallback: RC.UNIT_DELETE_MISSING_NAME }), // 00123
  unitController.deleteUnit
); // 00128

module.exports = router;
