const Joi = require('joi');

/**
 * POST /user/group — tạo nhóm.
 * Đặc tả gốc ghi body "No Body" (docs/02 mục 1.3); nhóm bổ sung `groupName`.
 */
const createGroupSchema = Joi.object({
  groupName: Joi.string().trim().min(1).max(50).required(),
});

/** POST /user/group/add — thêm thành viên bằng username. */
const addMemberSchema = Joi.object({
  username: Joi.string().trim().min(3).max(15).required(),
});

/** DELETE /user/group — xoá thành viên bằng username. */
const removeMemberSchema = Joi.object({
  username: Joi.string().trim().min(3).max(15).required(),
});

module.exports = {
  createGroupSchema,
  addMemberSchema,
  removeMemberSchema,
};
