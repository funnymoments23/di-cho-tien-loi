const fridgeService = require('../services/fridge.service');
const { sendSuccess } = require('../utils/response');
const RC = require('../constants/responseCode');

const getFridgeItems = async (req, res, next) => {
  try {
    const data = await fridgeService.getFridgeItems(req.user.id);
    sendSuccess(res, RC.FRIDGE_GET_SUCCESS, data); // 00228
  } catch (err) {
    next(err);
  }
};

const getFridgeItem = async (req, res, next) => {
  try {
    const data = await fridgeService.getFridgeItem(req.user.id, req.query);
    sendSuccess(res, RC.FRIDGE_ITEM_GET_SUCCESS, data); // 00237
  } catch (err) {
    next(err);
  }
};

const createFridgeItem = async (req, res, next) => {
  try {
    const data = await fridgeService.createFridgeItem(req.user.id, req.body);
    sendSuccess(res, RC.FRIDGE_CREATE_SUCCESS, data); // 00202
  } catch (err) {
    next(err);
  }
};

const updateFridgeItem = async (req, res, next) => {
  try {
    const data = await fridgeService.updateFridgeItem(req.user.id, req.body);
    sendSuccess(res, RC.FRIDGE_UPDATE_SUCCESS, data); // 00216
  } catch (err) {
    next(err);
  }
};

const deleteFridgeItem = async (req, res, next) => {
  try {
    const data = await fridgeService.deleteFridgeItem(req.user.id, req.body);
    sendSuccess(res, RC.FRIDGE_DELETE_SUCCESS, data); // 00224
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getFridgeItems,
  getFridgeItem,
  createFridgeItem,
  updateFridgeItem,
  deleteFridgeItem,
};
