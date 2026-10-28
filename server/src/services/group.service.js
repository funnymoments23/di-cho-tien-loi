const mongoose = require('mongoose');
const Group = require('../models/group.models');
const User = require('../models/user.models');
const RC = require('../constants/responseCode');
const { fail } = require('../utils/response');
const { toPublicUser, toPublicGroup } = require('../utils/serializers');

/** id lấy từ token luôn là ObjectId, vẫn kiểm tra để trả đúng mã thay vì CastError. */
const assertValidId = (userId) => {
  if (!mongoose.isValidObjectId(userId)) throw fail(RC.INVALID_USER_ID); // 00007
};

const findUserOrFail = async (userId, select) => {
  assertValidId(userId);
  const query = User.findById(userId);
  if (select) query.select(select);
  const user = await query;
  if (!user) throw fail(RC.USER_NOT_FOUND); // 00052
  return user;
};

/** Lấy user hiện tại + nhóm của họ; chưa vào nhóm thì trả 00096. */
const loadGroupOfUser = async (userId) => {
  const user = await findUserOrFail(userId, 'groupId');
  if (!user.groupId) throw fail(RC.GROUP_NOT_IN_GROUP); // 00096

  const group = await Group.findById(user.groupId);
  if (!group) {
    // groupId trỏ tới nhóm đã bị xoá (dữ liệu không nhất quán): dọn tham chiếu.
    await User.updateOne({ _id: user._id }, { $set: { groupId: null } });
    throw fail(RC.GROUP_NOT_IN_GROUP); // 00096
  }

  return { user, group };
};

/**
 * Tạo nhóm và gán người tạo làm trưởng nhóm/thành viên đầu tiên.
 * Một người chỉ thuộc tối đa một nhóm (00093).
 */
const createGroup = async (userId, { groupName }) => {
  const user = await findUserOrFail(userId, 'groupId');
  if (user.groupId) throw fail(RC.GROUP_CREATE_ALREADY_IN_GROUP); // 00093

  const group = await Group.create({
    name: groupName,
    adminId: user._id,
    members: [user._id],
  });

  // Cập nhật có điều kiện groupId = null để chặn 2 request tạo nhóm đồng thời.
  const claimed = await User.updateOne(
    { _id: user._id, groupId: null },
    { $set: { groupId: group._id } }
  );

  if (claimed.modifiedCount === 0) {
    await Group.deleteOne({ _id: group._id });
    throw fail(RC.GROUP_CREATE_ALREADY_IN_GROUP); // 00093
  }

  return toPublicGroup(group);
};

/** GET /user/group — thông tin nhóm kèm danh sách thành viên. */
const getGroupMembers = async (userId) => {
  const { group } = await loadGroupOfUser(userId);

  const members = await User.find({ _id: { $in: group.members } }).sort({ createdAt: 1, _id: 1 });
  const data = toPublicGroup(group);
  // group.members có thể còn id của tài khoản đã bị xoá; đếm theo user thật.
  data.memberCount = members.length;
  data.members = members.map(toPublicUser);
  return data;
};

/** GET /user/group/info — tên nhóm, trưởng nhóm, số thành viên (API bổ sung, docs/02 mục 4.4). */
const getGroupInfo = async (userId) => {
  const { user, group } = await loadGroupOfUser(userId);

  const admin = await User.findById(group.adminId).select('name username');
  const memberCount = await User.countDocuments({ _id: { $in: group.members } });

  return {
    ...toPublicGroup(group),
    memberCount,
    isAdmin: group.adminId.equals(user._id),
    admin: admin
      ? { id: admin._id, name: admin.name, username: admin.username ?? null }
      : null,
  };
};

/**
 * POST /user/group/add — trưởng nhóm thêm thành viên bằng username.
 * `group` do middleware groupAdmin nạp sẵn và đã xác nhận quyền.
 */
const addMember = async (group, username) => {
  const target = await User.findOne({ username });
  if (!target) throw fail(RC.GROUP_ADD_MEMBER_USER_NOT_FOUND); // 00099 (404)
  if (target.groupId) throw fail(RC.GROUP_ADD_MEMBER_ALREADY_IN_GROUP); // 00099 (409)

  // Cập nhật có điều kiện để chặn 2 nhóm thêm cùng một người đồng thời.
  const claimed = await User.updateOne(
    { _id: target._id, groupId: null },
    { $set: { groupId: group._id } }
  );
  if (claimed.modifiedCount === 0) {
    throw fail(RC.GROUP_ADD_MEMBER_ALREADY_IN_GROUP); // 00099 (409)
  }

  await Group.updateOne({ _id: group._id }, { $addToSet: { members: target._id } });

  target.groupId = group._id;
  return toPublicUser(target);
};

/**
 * DELETE /user/group — trưởng nhóm xoá thành viên bằng username.
 * Không cho xoá chính trưởng nhóm; trưởng nhóm dùng POST /user/group/leave.
 */
const removeMember = async (group, username) => {
  const target = await User.findOne({ username });
  if (!target || !target.groupId || !target.groupId.equals(group._id)) {
    throw fail(RC.GROUP_DELETE_MEMBER_NOT_IN_GROUP); // 00103
  }
  if (group.adminId.equals(target._id)) {
    throw fail(RC.GROUP_DELETE_MEMBER_IS_ADMIN); // 00105
  }

  await User.updateOne(
    { _id: target._id, groupId: group._id },
    { $set: { groupId: null } }
  );
  await Group.updateOne({ _id: group._id }, { $pull: { members: target._id } });

  target.groupId = null;
  return toPublicUser(target);
};

/**
 * Gỡ một user khỏi nhóm của họ khi tài khoản bị xoá.
 * - Trưởng nhóm: chuyển quyền cho thành viên còn lại hoặc xoá nhóm nếu không còn ai.
 * - Thành viên: chỉ xoá khỏi danh sách members.
 * Dùng chung cho POST /user/group/leave và DELETE /user.
 *
 * @param {object} user  document User (cần `_id`, `groupId`)
 * @param {object} [preloadedGroup] document Group nếu đã tải sẵn
 */
const detachUserFromGroup = async (user, preloadedGroup) => {
  if (!user.groupId) return { groupDeleted: false, newAdminId: null };

  const group = preloadedGroup || (await Group.findById(user.groupId));
  if (!group) return { groupDeleted: false, newAdminId: null };

  let newAdminId = null;
  let groupDeleted = false;

  if (group.adminId.equals(user._id)) {
    const remainingIds = group.members.filter((id) => !id.equals(user._id));
    const remaining = await User.find({ _id: { $in: remainingIds } }).sort({
      createdAt: 1,
      _id: 1,
    });

    if (remaining.length === 0) {
      await Group.deleteOne({ _id: group._id });
      groupDeleted = true;
    } else {
      newAdminId = remaining[0]._id;
      group.adminId = newAdminId;
      group.members = remaining.map((member) => member._id);
      await group.save();
    }
  } else {
    await Group.updateOne({ _id: group._id }, { $pull: { members: user._id } });
  }

  return { groupDeleted, newAdminId };
};

/**
 * POST /user/group/leave — thành viên tự rời nhóm (API bổ sung, docs/02 mục 4.4).
 * Nếu trưởng nhóm rời nhóm còn thành viên khác, chuyển quyền cho thành viên
 * lâu năm nhất; nếu là người cuối cùng thì xoá nhóm.
 */
const leaveGroup = async (userId) => {
  const { user, group } = await loadGroupOfUser(userId);

  const result = await detachUserFromGroup(user, group);
  await User.updateOne({ _id: user._id }, { $set: { groupId: null } });

  return { left: true, ...result };
};

module.exports = {
  createGroup,
  getGroupMembers,
  getGroupInfo,
  addMember,
  removeMember,
  leaveGroup,
  detachUserFromGroup,
};
