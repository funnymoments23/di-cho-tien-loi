const User = require('../models/user.models');
const Group = require('../models/group.models');
const RC = require('../constants/responseCode');
const { fail } = require('../utils/response');

/**
 * Chỉ cho trưởng nhóm đi tiếp. Gắn sẵn `req.group` để controller/service
 * không phải truy vấn lại nhóm.
 *
 * @param {object} forbiddenCode mã trả khi người dùng không phải trưởng nhóm
 *                              (mỗi endpoint có thông báo riêng).
 */
const groupAdmin = (forbiddenCode = RC.GROUP_DELETE_MEMBER_NOT_ADMIN) => async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('groupId');
    if (!user) return next(fail(RC.USER_NOT_FOUND));       // 00052
    if (!user.groupId) return next(fail(RC.GROUP_NOT_IN_GROUP)); // 00096

    const group = await Group.findById(user.groupId);
    // groupId trỏ tới nhóm không còn tồn tại (dữ liệu không nhất quán):
    // coi như người dùng chưa thuộc nhóm nào.
    if (!group) return next(fail(RC.GROUP_NOT_IN_GROUP));  // 00096

    if (!group.adminId.equals(user._id)) return next(fail(forbiddenCode));

    req.group = group;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = groupAdmin;
