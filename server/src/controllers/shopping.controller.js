const shoppingService = require('../services/shopping.service');
const { sendSuccess } = require('../utils/response');
const RC = require('../constants/responseCode');

const getShoppingLists = async (req, res, next) => {
  try {
    const data = await shoppingService.getShoppingLists(req.user.id);
    sendSuccess(res, RC.TASK_GET_SUCCESS, data); // 00292
  } catch (err) {
    next(err);
  }
};

const createShoppingList = async (req, res, next) => {
  try {
    const data = await shoppingService.createShoppingList(req.user.id, req.body);
    sendSuccess(res, RC.SHOPPING_CREATE_SUCCESS, data); // 00249
  } catch (err) {
    next(err);
  }
};

const updateShoppingList = async (req, res, next) => {
  try {
    const data = await shoppingService.updateShoppingList(req.user.id, req.body);
    sendSuccess(res, RC.SHOPPING_UPDATE_SUCCESS, data); // 00266
  } catch (err) {
    next(err);
  }
};

const deleteShoppingList = async (req, res, next) => {
  try {
    const data = await shoppingService.deleteShoppingList(req.user.id, req.body);
    sendSuccess(res, RC.SHOPPING_DELETE_SUCCESS, data); // 00275
  } catch (err) {
    next(err);
  }
};

const createTasks = async (req, res, next) => {
  try {
    const data = await shoppingService.createTasks(req.user.id, req.body);
    sendSuccess(res, RC.TASK_CREATE_SUCCESS, data); // 00287
  } catch (err) {
    next(err);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const data = await shoppingService.updateTask(req.user.id, req.body);
    sendSuccess(res, RC.TASK_UPDATE_SUCCESS, data); // 00312
  } catch (err) {
    next(err);
  }
};

const deleteTask = async (req, res, next) => {
  try {
    const data = await shoppingService.deleteTask(req.user.id, req.body);
    sendSuccess(res, RC.TASK_DELETE_SUCCESS, data); // 00299
  } catch (err) {
    next(err);
  }
};

const completeTask = async (req, res, next) => {
  try {
    const data = await shoppingService.completeTask(req.user.id, req.params.taskId, req.body);
    sendSuccess(res, RC.TASK_UPDATE_SUCCESS, data); // 00312
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getShoppingLists,
  createShoppingList,
  updateShoppingList,
  deleteShoppingList,
  createTasks,
  updateTask,
  deleteTask,
  completeTask,
};
