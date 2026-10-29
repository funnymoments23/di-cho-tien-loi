const reportService = require('../services/report.service');
const { sendSuccess } = require('../utils/response');
const RC = require('../constants/responseCode');

const getOverview = async (req, res, next) => {
  try {
    const data = await reportService.getOverview(req.user.id, req.query);
    sendSuccess(res, RC.REPORT_OVERVIEW_SUCCESS, data); // 00380
  } catch (err) {
    next(err);
  }
};

const getShoppingReport = async (req, res, next) => {
  try {
    const data = await reportService.getShoppingReport(req.user.id, req.query);
    sendSuccess(res, RC.REPORT_SHOPPING_SUCCESS, data); // 00381
  } catch (err) {
    next(err);
  }
};

const getConsumptionReport = async (req, res, next) => {
  try {
    const data = await reportService.getConsumptionReport(req.user.id, req.query);
    sendSuccess(res, RC.REPORT_CONSUMPTION_SUCCESS, data); // 00382
  } catch (err) {
    next(err);
  }
};

const getWasteReport = async (req, res, next) => {
  try {
    const data = await reportService.getWasteReport(req.user.id, req.query);
    sendSuccess(res, RC.REPORT_WASTE_SUCCESS, data); // 00383
  } catch (err) {
    next(err);
  }
};

const getFridgeReport = async (req, res, next) => {
  try {
    const data = await reportService.getFridgeReport(req.user.id);
    sendSuccess(res, RC.REPORT_FRIDGE_SUCCESS, data); // 00384
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getOverview,
  getShoppingReport,
  getConsumptionReport,
  getWasteReport,
  getFridgeReport,
};
