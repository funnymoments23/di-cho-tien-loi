const Log = require('../models/log.models');
const RC = require('../constants/responseCode');
const { fail } = require('../utils/response');
const { listLogsQuerySchema } = require('../validations/logs.validation');

const DAY_MS = 24 * 60 * 60 * 1000;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Khoá ngày YYYY-MM-DD theo giờ Việt Nam của một thời điểm. */
const toDateKey = (date) =>
  new Date(new Date(date).getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);

/**
 * Phân tích YYYY-MM-DD thành mốc 00:00 giờ Việt Nam (hoặc cuối ngày nếu endOfDay).
 * Trả null nếu sai định dạng / ngày không tồn tại (2026-02-31).
 */
const parseDay = (value, endOfDay = false) => {
  if (!value || !DATE_ONLY.test(value)) return null;

  const start = new Date(`${value}T00:00:00.000+07:00`);
  if (Number.isNaN(start.getTime()) || toDateKey(start) !== value) return null;
  return endOfDay ? new Date(start.getTime() + DAY_MS - 1) : start;
};

const parseQuery = (query = {}) => {
  const { value, error } = listLogsQuerySchema.validate(query, {
    abortEarly: true,
    stripUnknown: true,
  });
  if (error) throw fail(RC.LOGS_INVALID_QUERY); // 00405
  return value;
};

const buildDateFilter = ({ from, to }) => {
  const fromDay = from ? parseDay(from, false) : null;
  const toDay = to ? parseDay(to, true) : null;

  if ((from && !fromDay) || (to && !toDay)) throw fail(RC.LOGS_INVALID_DATE_RANGE); // 00406
  if (fromDay && toDay && fromDay.getTime() > toDay.getTime()) {
    throw fail(RC.LOGS_INVALID_DATE_RANGE); // 00406
  }

  if (!fromDay && !toDay) return null;
  const range = {};
  if (fromDay) range.$gte = fromDay;
  if (toDay) range.$lte = toDay;
  return range;
};

const toPublicLog = (log) => {
  const user = log.userId;
  const group = log.groupId;

  return {
    id: log._id,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId ?? null,
    detail: log.detail ?? null,
    user: user
      ? {
          id: user._id,
          name: user.name ?? null,
          email: user.email ?? null,
          username: user.username ?? null,
        }
      : null,
    group: group ? { id: group._id, name: group.name ?? null } : null,
    createdAt: log.createdAt,
  };
};

/**
 * GET /admin/logs — danh sách nhật ký, mới nhất trước.
 * Hỗ trợ lọc action / entity / userId / groupId / khoảng ngày và phân trang.
 */
const listLogs = async (query = {}) => {
  const { action, entity, userId, groupId, page, limit, from, to } = parseQuery(query);

  const filter = {};
  if (action) filter.action = action;
  if (entity) filter.entity = entity;
  if (userId) filter.userId = userId;
  if (groupId) filter.groupId = groupId;

  const dateFilter = buildDateFilter({ from, to });
  if (dateFilter) filter.createdAt = dateFilter;

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    Log.find(filter)
      .populate({ path: 'userId', select: 'name email username' })
      .populate({ path: 'groupId', select: 'name' })
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit),
    Log.countDocuments(filter),
  ]);

  return {
    items: logs.map(toPublicLog),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

module.exports = {
  listLogs,
  parseDay,
  buildDateFilter,
  toPublicLog,
};
