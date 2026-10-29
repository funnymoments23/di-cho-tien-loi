const logService = require('../services/log.service');
const { sendSuccess } = require('../utils/response');
const RC = require('../constants/responseCode');

const getLogs = async (req, res, next) => {
  try {
    const data = await logService.listLogs(req.query);
    sendSuccess(res, RC.LOGS_GET_SUCCESS, data); // 00109
  } catch (err) {
    next(err);
  }
};

module.exports = { getLogs };
