const Log = require('../models/log.models');

/**
 * Ghi một dòng nhật ký. Lỗi ghi log không được làm hỏng nghiệp vụ chính
 * (vd: request tạo thực phẩm vẫn phải thành công dù collection logs lỗi).
 *
 * @param {object} entry
 * @param {string|import('mongoose').Types.ObjectId|null} [entry.userId]
 * @param {string|import('mongoose').Types.ObjectId|null} [entry.groupId]
 * @param {'CREATE'|'UPDATE'|'DELETE'} entry.action
 * @param {string} entry.entity
 * @param {string|import('mongoose').Types.ObjectId|null} [entry.entityId]
 * @param {string|null} [entry.detail]
 * @returns {Promise<object|null>}
 */
const logAction = async (entry) => {
  try {
    return await Log.create({
      userId: entry.userId || null,
      groupId: entry.groupId || null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId || null,
      detail: entry.detail || null,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[logger] không ghi được nhật ký:', err.message);
    }
    return null;
  }
};

module.exports = { logAction };
