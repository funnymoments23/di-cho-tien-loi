const express = require('express');
const auth = require('../middlewares/auth.middleware');
const admin = require('../middlewares/admin.middleware');
const validate = require('../middlewares/validate.middleware');
const categoryController = require('../controllers/category.controller');
const unitController = require('../controllers/unit.controller');
const adminUserController = require('../controllers/adminUser.controller');
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
const {
  updateUserByAdminSchema,
  updateUserStatusSchema,
} = require('../validations/adminUser.validation');
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

// ===== Nhóm Quản trị người dùng (admin/user) =====
// Đề yêu cầu admin "quản lý tài khoản người dùng" nhưng đặc tả API gốc không có
// endpoint nào; nhóm này là phần bổ sung (mã 00387–00403). Mọi endpoint yêu cầu
// role admin, người dùng thường nhận 00017.

// GET /admin/user — danh sách + lọc + phân trang.
router.get('/user', auth, admin(), adminUserController.listUsers); // 00387

// GET /admin/user/:id — chi tiết một tài khoản.
router.get('/user/:id', auth, admin(), adminUserController.getUser); // 00388

// PUT /admin/user/:id — sửa hồ sơ, quyền, trạng thái xác minh.
router.put(
  '/user/:id',
  auth,
  admin(), // 00017
  validate(updateUserByAdminSchema, {
    byField: {
      name: RC.EDIT_USER_INVALID_NAME,             // 00077
      email: RC.REGISTER_INVALID_EMAIL,            // 00026
      username: RC.EDIT_USER_INVALID_USERNAME,     // 00081
      gender: RC.EDIT_USER_INVALID_GENDER,         // 00078
      birthday: RC.EDIT_USER_INVALID_BIRTHDAY,     // 00080
      language: RC.EDIT_USER_INVALID_LANGUAGE,     // 00079
      role: RC.ADMIN_USER_UPDATE_INVALID_FIELDS,   // 00396
      isVerified: RC.ADMIN_USER_UPDATE_INVALID_FIELDS,
      avatar: RC.ADMIN_USER_UPDATE_INVALID_FIELDS,
      timezone: RC.ADMIN_USER_UPDATE_INVALID_FIELDS,
    },
    fallback: RC.ADMIN_USER_UPDATE_MISSING_FIELDS, // 00395
  }),
  adminUserController.updateUser
); // 00389

// PATCH /admin/user/:id/status — khoá / mở khoá tài khoản.
router.patch(
  '/user/:id/status',
  auth,
  admin(), // 00017
  validate(updateUserStatusSchema, { fallback: RC.ADMIN_USER_INVALID_STATUS }), // 00402
  adminUserController.updateUserStatus
); // 00390

// DELETE /admin/user/:id — xoá tài khoản (gỡ khỏi nhóm trước khi xoá).
router.delete('/user/:id', auth, admin(), adminUserController.deleteUser); // 00391

module.exports = router;
