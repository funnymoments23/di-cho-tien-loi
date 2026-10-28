const foodService = require('../services/food.service');
const { sendSuccess } = require('../utils/response');
const RC = require('../constants/responseCode');

const getFoods = async (req, res, next) => {
  try {
    const data = await foodService.getFoods(req.user.id, req.query);
    sendSuccess(res, RC.FOOD_GET_SUCCESS, data); // 00188
  } catch (err) {
    next(err);
  }
};

const searchFoods = async (req, res, next) => {
  try {
    const data = await foodService.searchFoods(req.user.id, req.query);
    sendSuccess(res, RC.FOOD_GET_SUCCESS, data); // 00188 — dùng chung mã với GET /food
  } catch (err) {
    next(err);
  }
};

const createFood = async (req, res, next) => {
  try {
    // uploadFoodImage (nếu có file) đã ghi đường dẫn vào req.body.image.
    const data = await foodService.createFood(req.user.id, req.body);
    sendSuccess(res, RC.FOOD_CREATE_SUCCESS, data); // 00160
  } catch (err) {
    next(err);
  }
};

const updateFood = async (req, res, next) => {
  try {
    const data = await foodService.updateFood(req.user.id, req.body);
    sendSuccess(res, RC.FOOD_UPDATE_SUCCESS, data); // 00178
  } catch (err) {
    next(err);
  }
};

const deleteFood = async (req, res, next) => {
  try {
    const data = await foodService.deleteFood(req.user.id, req.body);
    sendSuccess(res, RC.FOOD_DELETE_SUCCESS, data); // 00184
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getFoods,
  searchFoods,
  createFood,
  updateFood,
  deleteFood,
};
