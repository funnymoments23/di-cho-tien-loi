const express = require('express');
const auth = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const mealController = require('../controllers/meal.controller');
const {
  createMealPlanSchema,
  updateMealPlanSchema,
  deleteMealPlanSchema,
} = require('../validations/meal.validation');
const RC = require('../constants/responseCode');

const router = express.Router();

// GET /meal/suggestion — gợi ý món từ thực phẩm đang có trong tủ lạnh
// (API bổ sung, docs/02 mục 3.2). Phải khai báo trước route '/' để không bị nuốt.
router.get('/suggestion', auth, mealController.suggestMeals); // 00348 (chưa vào nhóm: 00345)

// GET /meal — lịch bữa ăn của nhóm (?date=YYYY-MM-DD hoặc ?from=&to=).
router.get('/', auth, mealController.getMealPlans); // 00348 (chưa vào nhóm: 00345)

// POST /meal — trưởng nhóm xếp một món vào bữa sáng / trưa / tối.
router.post(
  '/',
  auth,
  validate(createMealPlanSchema, {
    byField: {
      foodName: RC.MEAL_CREATE_INVALID_FOOD_NAME,      // 00314
      timestamp: RC.MEAL_CREATE_INVALID_TIMESTAMP,     // 00315
      name: RC.MEAL_CREATE_INVALID_NAME,               // 00316
    },
    missingByField: {
      foodName: RC.MEAL_CREATE_MISSING_FIELDS,         // 00313
      timestamp: RC.MEAL_CREATE_MISSING_FIELDS,        // 00313
      name: RC.MEAL_CREATE_MISSING_FIELDS,             // 00313
    },
    fallback: RC.MEAL_CREATE_MISSING_FIELDS,           // 00313
  }),
  mealController.createMealPlan
); // 00322

// PUT /meal — sửa món / ngày / tên bữa theo planId.
router.put(
  '/',
  auth,
  validate(updateMealPlanSchema, {
    byField: {
      planId: RC.MEAL_UPDATE_MISSING_PLAN_ID,          // 00332
      newFoodName: RC.MEAL_UPDATE_INVALID_FOOD_NAME,   // 00334
      newTimestamp: RC.MEAL_UPDATE_INVALID_TIMESTAMP,  // 00335
      newName: RC.MEAL_UPDATE_INVALID_NAME,            // 00336
    },
    missingByField: {
      planId: RC.MEAL_UPDATE_MISSING_PLAN_ID,          // 00332
    },
    fallback: RC.MEAL_UPDATE_MISSING_FIELDS,           // 00331
  }),
  mealController.updateMealPlan
); // 00344

// DELETE /meal — xoá kế hoạch theo planId (đặc tả dùng body; xem docs/02 mục 2.6).
router.delete(
  '/',
  auth,
  validate(deleteMealPlanSchema, {
    byField: {
      planId: RC.MEAL_DELETE_INVALID_PLAN_ID,          // 00324
    },
    missingByField: {
      planId: RC.MEAL_DELETE_MISSING_FIELDS,           // 00323
    },
    fallback: RC.MEAL_DELETE_MISSING_FIELDS,           // 00323
  }),
  mealController.deleteMealPlan
); // 00330

module.exports = router;
