const groupService = require('../services/group.service');
const { sendSuccess } = require('../utils/response');
const RC = require('../constants/responseCode');

const createGroup = async (req, res, next) => {
  try {
    const data = await groupService.createGroup(req.user.id, req.body);
    sendSuccess(res, RC.GROUP_CREATE_SUCCESS, data); // 00095
  } catch (err) {
    next(err);
  }
};

const getGroupMembers = async (req, res, next) => {
  try {
    const data = await groupService.getGroupMembers(req.user.id);
    sendSuccess(res, RC.GROUP_GET_MEMBERS_SUCCESS, data); // 00098
  } catch (err) {
    next(err);
  }
};

const getGroupInfo = async (req, res, next) => {
  try {
    const data = await groupService.getGroupInfo(req.user.id);
    sendSuccess(res, RC.GROUP_GET_INFO_SUCCESS, data); // 00098
  } catch (err) {
    next(err);
  }
};

const addMember = async (req, res, next) => {
  try {
    // req.group do groupAdmin.middleware nạp sẵn.
    const data = await groupService.addMember(req.group, req.body.username);
    sendSuccess(res, RC.GROUP_ADD_MEMBER_SUCCESS, data); // 00102
  } catch (err) {
    next(err);
  }
};

const removeMember = async (req, res, next) => {
  try {
    const data = await groupService.removeMember(req.group, req.body.username);
    sendSuccess(res, RC.GROUP_DELETE_MEMBER_SUCCESS, data); // 00106
  } catch (err) {
    next(err);
  }
};

const leaveGroup = async (req, res, next) => {
  try {
    const data = await groupService.leaveGroup(req.user.id);
    sendSuccess(res, RC.GROUP_LEAVE_SUCCESS, data); // 00108
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createGroup,
  getGroupMembers,
  getGroupInfo,
  addMember,
  removeMember,
  leaveGroup,
};
