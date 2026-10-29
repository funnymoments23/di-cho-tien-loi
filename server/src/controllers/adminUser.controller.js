const adminUserService = require('../services/adminUser.service');
const { sendSuccess } = require('../utils/response');
const RC = require('../constants/responseCode');

const listUsers = async (req, res, next) => {
  try {
    const data = await adminUserService.listUsers(req.query);
    sendSuccess(res, RC.ADMIN_USER_GET_LIST_SUCCESS, data); // 00387
  } catch (err) {
    next(err);
  }
};

const getUser = async (req, res, next) => {
  try {
    const data = await adminUserService.getUser(req.params.id);
    sendSuccess(res, RC.ADMIN_USER_GET_DETAIL_SUCCESS, data); // 00388
  } catch (err) {
    next(err);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const data = await adminUserService.updateUser(req.user.id, req.params.id, req.body);
    sendSuccess(res, RC.ADMIN_USER_UPDATE_SUCCESS, data); // 00389
  } catch (err) {
    next(err);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const data = await adminUserService.updateUserStatus(req.user.id, req.params.id, req.body);
    sendSuccess(res, RC.ADMIN_USER_STATUS_SUCCESS, data); // 00390
  } catch (err) {
    next(err);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const data = await adminUserService.deleteUser(req.user.id, req.params.id);
    sendSuccess(res, RC.ADMIN_USER_DELETE_SUCCESS, data); // 00391
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listUsers,
  getUser,
  updateUser,
  updateUserStatus,
  deleteUser,
};
