const unitService = require('../services/unit.service');
const { sendSuccess } = require('../utils/response');
const RC = require('../constants/responseCode');

const getUnits = async (req, res, next) => {
  try {
    const data = await unitService.getUnits();
    sendSuccess(res, RC.UNIT_GET_SUCCESS, data); // 00110
  } catch (err) {
    next(err);
  }
};

const createUnit = async (req, res, next) => {
  try {
    const data = await unitService.createUnit(req.body);
    sendSuccess(res, RC.UNIT_CREATE_SUCCESS, data); // 00116
  } catch (err) {
    next(err);
  }
};

const updateUnit = async (req, res, next) => {
  try {
    const data = await unitService.updateUnit(req.body);
    sendSuccess(res, RC.UNIT_UPDATE_SUCCESS, data); // 00122
  } catch (err) {
    next(err);
  }
};

const deleteUnit = async (req, res, next) => {
  try {
    const data = await unitService.deleteUnit(req.body);
    sendSuccess(res, RC.UNIT_DELETE_SUCCESS, data); // 00128
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUnits,
  createUnit,
  updateUnit,
  deleteUnit,
};
