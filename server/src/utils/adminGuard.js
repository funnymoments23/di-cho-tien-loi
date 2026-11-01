const User = require('../models/user.models');
const RC = require('../constants/responseCode');
const { fail } = require('./response');

/**
 * Đảm bảo thao tác không làm hệ thống mất quản trị viên đang hoạt động cuối cùng.
 *
 * Chỉ kiểm tra khi đối tượng thực sự là admin đang hoạt động; user thường,
 * admin đã bị khoá hoặc admin đã là user đều không làm giảm số admin active.
 *
 * @param {object|null} user document User có `role` và `isActive`
 */
const assertNotLastActiveAdmin = async (user) => {
  if (!user || user.role !== 'admin' || user.isActive === false) return;

  const activeAdmins = await User.countDocuments({
    role: 'admin',
    isActive: { $ne: false },
  });

  if (activeAdmins <= 1) {
    throw fail(RC.ADMIN_USER_LAST_ADMIN); // 00411
  }
};

module.exports = { assertNotLastActiveAdmin };
