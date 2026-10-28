const categoryService = require('../services/category.service');
const { sendSuccess } = require('../utils/response');
const RC = require('../constants/responseCode');

const getCategories = async (req, res, next) => {
  try {
    const data = await categoryService.getCategories();
    sendSuccess(res, RC.CATEGORY_GET_SUCCESS, data); // 00129
  } catch (err) {
    next(err);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const data = await categoryService.createCategory(req.body);
    sendSuccess(res, RC.CATEGORY_CREATE_SUCCESS, data); // 00135
  } catch (err) {
    next(err);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const data = await categoryService.updateCategory(req.body);
    sendSuccess(res, RC.CATEGORY_UPDATE_SUCCESS, data); // 00141
  } catch (err) {
    next(err);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const data = await categoryService.deleteCategory(req.body);
    sendSuccess(res, RC.CATEGORY_DELETE_SUCCESS, data); // 00146
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
