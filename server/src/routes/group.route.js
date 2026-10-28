const express = require('express');
const auth = require('../middlewares/auth.middleware');
const groupAdmin = require('../middlewares/groupAdmin.middleware');
const validate = require('../middlewares/validate.middleware');
const groupController = require('../controllers/group.controller');
const {
  createGroupSchema,
  addMemberSchema,
  removeMemberSchema,
} = require('../validations/group.validation');
const RC = require('../constants/responseCode');

const router = express.Router();

// POST /user/group — tạo nhóm, người tạo thành trưởng nhóm (00095)
router.post(
  '/',
  auth,
  validate(createGroupSchema, { fallback: RC.GROUP_CREATE_MISSING_NAME }), // 00094
  groupController.createGroup
);

// GET /user/group — xem nhóm và danh sách thành viên (00098)
router.get('/', auth, groupController.getGroupMembers);

// GET /user/group/info — tên nhóm, trưởng nhóm, số thành viên (API bổ sung)
router.get('/info', auth, groupController.getGroupInfo);

// POST /user/group/add — trưởng nhóm thêm thành viên bằng username (00102)
router.post(
  '/add',
  auth,
  groupAdmin(RC.GROUP_ADD_MEMBER_NOT_ADMIN), // 00101
  validate(addMemberSchema, { fallback: RC.GROUP_ADD_MEMBER_MISSING_USERNAME }), // 00100
  groupController.addMember
);

// DELETE /user/group — trưởng nhóm xoá thành viên bằng username (00106)
router.delete(
  '/',
  auth,
  groupAdmin(RC.GROUP_DELETE_MEMBER_NOT_ADMIN), // 00104
  validate(removeMemberSchema, { fallback: RC.GROUP_DELETE_MEMBER_MISSING_USERNAME }), // 00107
  groupController.removeMember
);

// POST /user/group/leave — thành viên tự rời nhóm (API bổ sung, 00108)
router.post('/leave', auth, groupController.leaveGroup);

module.exports = router;
