const express = require('express');
const auth = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const recipeController = require('../controllers/recipe.controller');
const {
  createRecipeSchema,
  updateRecipeSchema,
  deleteRecipeSchema,
} = require('../validations/recipe.validation');
const RC = require('../constants/responseCode');

const router = express.Router();

// GET /recipe — công thức của nhóm (?foodId= hoặc ?foodName=).
router.get('/', auth, recipeController.getRecipes); // 00378 (chưa vào nhóm: 00096)

// POST /recipe — thêm công thức cho một món ăn của nhóm.
router.post(
  '/',
  auth,
  validate(createRecipeSchema, {
    byField: {
      foodName: RC.RECIPE_CREATE_INVALID_FOOD_NAME,    // 00350
      name: RC.RECIPE_CREATE_INVALID_NAME,             // 00351
      description: RC.RECIPE_CREATE_INVALID_DESCRIPTION, // 00352
      htmlContent: RC.RECIPE_CREATE_INVALID_HTML,      // 00353
    },
    missingByField: {
      foodName: RC.RECIPE_CREATE_MISSING_FIELDS,       // 00349
      name: RC.RECIPE_CREATE_MISSING_FIELDS,           // 00349
      description: RC.RECIPE_CREATE_MISSING_FIELDS,    // 00349
      htmlContent: RC.RECIPE_CREATE_MISSING_FIELDS,    // 00349
    },
    fallback: RC.RECIPE_CREATE_MISSING_FIELDS,         // 00349
  }),
  recipeController.createRecipe
); // 00357

// PUT /recipe — sửa món / tên / mô tả / nội dung HTML theo recipeId.
router.put(
  '/',
  auth,
  validate(updateRecipeSchema, {
    byField: {
      recipeId: RC.RECIPE_UPDATE_MISSING_RECIPE_ID,     // 00359
      newFoodName: RC.RECIPE_UPDATE_INVALID_FOOD_NAME,  // 00361
      newDescription: RC.RECIPE_UPDATE_INVALID_DESCRIPTION, // 00362
      newHtmlContent: RC.RECIPE_UPDATE_INVALID_HTML,    // 00363
      newName: RC.RECIPE_UPDATE_INVALID_NAME,           // 00364
    },
    missingByField: {
      recipeId: RC.RECIPE_UPDATE_MISSING_RECIPE_ID,     // 00359
    },
    fallback: RC.RECIPE_UPDATE_MISSING_FIELDS,          // 00358
  }),
  recipeController.updateRecipe
); // 00370

// DELETE /recipe — xoá công thức theo recipeId (đặc tả dùng body; xem docs/02 mục 2.6).
router.delete(
  '/',
  auth,
  validate(deleteRecipeSchema, {
    byField: {
      recipeId: RC.RECIPE_DELETE_INVALID_RECIPE_ID,     // 00372
    },
    missingByField: {
      recipeId: RC.RECIPE_DELETE_MISSING_FIELDS,        // 00371
    },
    fallback: RC.RECIPE_DELETE_MISSING_FIELDS,          // 00371
  }),
  recipeController.deleteRecipe
); // 00376

module.exports = router;
