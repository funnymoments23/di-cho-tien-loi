const authService = require('../services/auth.service');
const { sendSuccess } = require('../utils/response');
const RC = require('../constants/responseCode');

const register = async (req, res, next) => {
  try {
    const data = await authService.register(req.body);
    sendSuccess(res, RC.REGISTER_SUCCESS, data); // 00035
  } catch (err) {
    next(err);
  }
};

const sendVerificationCode = async (req, res, next) => {
  try {
    const data = await authService.sendVerificationCode(req.body);
    sendSuccess(res, RC.SEND_CODE_SUCCESS, data); // 00048
  } catch (err) {
    next(err);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const data = await authService.verifyEmail(req.body);
    sendSuccess(res, RC.VERIFY_EMAIL_SUCCESS, data); // 00058
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const data = await authService.login(req.body);
    sendSuccess(res, RC.LOGIN_SUCCESS, data);
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const data = await authService.refresh(req.body.refreshToken);
    sendSuccess(res, RC.REFRESH_TOKEN_SUCCESS, data);
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    await authService.logout(req.user.id);
    sendSuccess(res, RC.LOGOUT_SUCCESS);
  } catch (err) {
    next(err);
  }
};

module.exports = { register, sendVerificationCode, verifyEmail, login, refresh, logout };
