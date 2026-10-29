const mealService = require('../services/meal.service');
const { sendSuccess } = require('../utils/response');
const RC = require('../constants/responseCode');

const getMealPlans = async (req, res, next) => {
  try {
    const data = await mealService.getMealPlans(req.user.id, req.query);
    sendSuccess(res, RC.MEAL_GET_SUCCESS, data); // 00348
  } catch (err) {
    next(err);
  }
};

const suggestMeals = async (req, res, next) => {
  try {
    const data = await mealService.suggestMeals(req.user.id, req.query);
    sendSuccess(res, RC.MEAL_GET_SUCCESS, data); // 00348 — dùng chung mã với GET /meal
  } catch (err) {
    next(err);
  }
};

const createMealPlan = async (req, res, next) => {
  try {
    const data = await mealService.createMealPlan(req.user.id, req.body);
    sendSuccess(res, RC.MEAL_CREATE_SUCCESS, data); // 00322
  } catch (err) {
    next(err);
  }
};

const updateMealPlan = async (req, res, next) => {
  try {
    const data = await mealService.updateMealPlan(req.user.id, req.body);
    sendSuccess(res, RC.MEAL_UPDATE_SUCCESS, data); // 00344
  } catch (err) {
    next(err);
  }
};

const deleteMealPlan = async (req, res, next) => {
  try {
    const data = await mealService.deleteMealPlan(req.user.id, req.body);
    sendSuccess(res, RC.MEAL_DELETE_SUCCESS, data); // 00330
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMealPlans,
  suggestMeals,
  createMealPlan,
  updateMealPlan,
  deleteMealPlan,
};
