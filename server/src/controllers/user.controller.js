const userService = require('../services/user.service');
const { sendSuccess } = require('../utils/response');
const RC = require('../constants/responseCode');

const getProfile = async (req, res, next) => {
  try {
    const data = await userService.getProfile(req.user.id);
    sendSuccess(res, RC.GET_USER_SUCCESS, data); // 00089
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    // uploadAvatar (nếu có file) chạy trước validate và đã gán URL Cloudinary vào
    // req.body.avatar; file nằm ở field `image` theo đặc tả API.
    const data = await userService.updateProfile(req.user.id, req.body);
    sendSuccess(res, RC.EDIT_USER_SUCCESS, data); // 00086
  } catch (err) {
    next(err);
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    await userService.deleteAccount(req.user.id);
    sendSuccess(res, RC.DELETE_USER_SUCCESS); // 00092
  } catch (err) {
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    await userService.changePassword(req.user.id, req.body);
    sendSuccess(res, RC.CHANGE_PASSWORD_SUCCESS); // 00076
  } catch (err) {
    next(err);
  }
};

const updateDeviceToken = async (req, res, next) => {
  try {
    await userService.updateDeviceToken(req.user.id, req.body.deviceToken);
    sendSuccess(res, RC.EDIT_USER_SUCCESS); // 00086 — chưa có mã riêng cho device token
  } catch (err) {
    next(err);
  }
};

module.exports = { getProfile, updateProfile, deleteAccount, changePassword, updateDeviceToken };
