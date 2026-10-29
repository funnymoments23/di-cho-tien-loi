const recipeService = require('../services/recipe.service');
const { sendSuccess } = require('../utils/response');
const RC = require('../constants/responseCode');

const getRecipes = async (req, res, next) => {
  try {
    const data = await recipeService.getRecipes(req.user.id, req.query);
    sendSuccess(res, RC.RECIPE_GET_SUCCESS, data); // 00378
  } catch (err) {
    next(err);
  }
};

const createRecipe = async (req, res, next) => {
  try {
    const data = await recipeService.createRecipe(req.user.id, req.body);
    sendSuccess(res, RC.RECIPE_CREATE_SUCCESS, data); // 00357
  } catch (err) {
    next(err);
  }
};

const updateRecipe = async (req, res, next) => {
  try {
    const data = await recipeService.updateRecipe(req.user.id, req.body);
    sendSuccess(res, RC.RECIPE_UPDATE_SUCCESS, data); // 00370
  } catch (err) {
    next(err);
  }
};

const deleteRecipe = async (req, res, next) => {
  try {
    const data = await recipeService.deleteRecipe(req.user.id, req.body);
    sendSuccess(res, RC.RECIPE_DELETE_SUCCESS, data); // 00376
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
};
