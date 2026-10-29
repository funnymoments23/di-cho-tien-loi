const cron = require('node-cron');
const FridgeItem = require('../models/fridgeItem.models');
const User = require('../models/user.models');
const {
  DAY_MS,
  buildExpiryMessages,
  sendExpoPush,
} = require('../utils/pushNotification');

const DEFAULT_SCHEDULE = '0 8 * * *';
const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';
const DEFAULT_NOTIFY_DAYS = 3;

// Chỉ log khi chạy thật, tránh làm nhiễu output của Jest.
const log = (...args) => {
  if (process.env.NODE_ENV !== 'test') console.log(...args);
};

const notifyDays = () => {
  const raw = process.env.EXPIRY_NOTIFY_DAYS;
  if (raw === undefined || raw.trim() === '') return DEFAULT_NOTIFY_DAYS;

  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_NOTIFY_DAYS;
};

/**
 * Khoảng thời gian quét: từ đầu ngày hôm nay tới hết ngày thứ N.
 *
 * Dùng mốc UTC vì `expiryDate` được tạo từ chuỗi ngày `YYYY-MM-DD`
 * (JavaScript hiểu là 00:00 UTC). Nhờ vậy kết quả không phụ thuộc server
 * chạy ở UTC hay Asia/Ho_Chi_Minh.
 */
const buildExpiryWindow = (now = new Date(), days = notifyDays()) => {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // Ví dụ N = 3: hôm nay + 3 ngày nữa, lấy trọn ngày cuối.
  const end = new Date(start.getTime() + (days + 1) * DAY_MS - 1);
  return { start, end };
};

/**
 * Quét thực phẩm sắp hết hạn và gửi thông báo đẩy.
 *
 * Quy tắc:
 * - Chỉ lấy mục `isNotified = false` có hạn trong [hôm nay, hôm nay + N ngày].
 * - Mỗi nhóm nhận một thông báo tóm tắt (một message cho mỗi deviceToken).
 * - Chỉ đánh dấu `isNotified = true` khi đã gửi thành công ít nhất 1 thiết bị;
 *   nhóm chưa có deviceToken hoặc gửi lỗi sẽ được thử lại ở lần chạy sau.
 *
 * @param {{now?: Date}} [options]
 * @returns {Promise<object>} thống kê lần chạy
 */
const runExpiryCheck = async ({ now = new Date() } = {}) => {
  const { start, end } = buildExpiryWindow(now);

  const items = await FridgeItem.find({
    isNotified: false,
    expiryDate: { $gte: start, $lte: end },
  })
    .populate({ path: 'foodId', select: 'name' })
    .sort({ expiryDate: 1, createdAt: 1 });

  const summary = {
    scanned: items.length,
    groups: 0,
    notificationsSent: 0,
    itemsMarked: 0,
    groupsSkippedNoToken: 0,
    itemsFailed: 0,
    errors: [],
  };

  if (items.length === 0) return summary;

  // Gom theo nhóm để mỗi nhóm chỉ nhận một thông báo tóm tắt.
  const itemsByGroup = new Map();
  for (const item of items) {
    const key = String(item.groupId);
    if (!itemsByGroup.has(key)) itemsByGroup.set(key, []);
    itemsByGroup.get(key).push(item);
  }
  summary.groups = itemsByGroup.size;

  const groupIds = [...itemsByGroup.keys()];
  const users = await User.find({
    groupId: { $in: groupIds },
    deviceToken: { $nin: [null, ''] },
  })
    .select('groupId deviceToken')
    .lean();

  const tokensByGroup = new Map();
  for (const user of users) {
    const key = String(user.groupId);
    if (!tokensByGroup.has(key)) tokensByGroup.set(key, new Set());
    tokensByGroup.get(key).add(user.deviceToken);
  }

  for (const [groupId, groupItems] of itemsByGroup) {
    const tokens = [...(tokensByGroup.get(groupId) || [])];
    if (tokens.length === 0) {
      summary.groupsSkippedNoToken += 1;
      continue;
    }

    const messages = buildExpiryMessages({ groupId, items: groupItems, tokens, now });
    if (messages.length === 0) {
      summary.groupsSkippedNoToken += 1;
      continue;
    }

    const result = await sendExpoPush(messages);
    summary.notificationsSent += result.sent;

    if (result.sent > 0) {
      const marked = await FridgeItem.updateMany(
        { _id: { $in: groupItems.map((item) => item._id) }, isNotified: false },
        { $set: { isNotified: true } }
      );
      summary.itemsMarked += marked.modifiedCount;
    } else {
      summary.itemsFailed += groupItems.length;
      summary.errors.push(...result.errors);
    }
  }

  log(
    `[expiry-checker] quét ${summary.scanned} mục, gửi ${summary.notificationsSent} thông báo, ` +
      `đánh dấu ${summary.itemsMarked} mục`
  );

  return summary;
};

let task = null;

/**
 * Bật cron quét hạn sử dụng. Gọi một lần sau khi kết nối MongoDB.
 * Mặc định 08:00 mỗi ngày theo giờ Việt Nam.
 */
const startExpiryChecker = () => {
  if (task) return task;

  const schedule = process.env.EXPIRY_CRON_SCHEDULE || DEFAULT_SCHEDULE;
  if (!cron.validate(schedule)) {
    throw new Error(`EXPIRY_CRON_SCHEDULE không hợp lệ: ${schedule}`);
  }

  const timezone = process.env.EXPIRY_CRON_TIMEZONE || DEFAULT_TIMEZONE;

  task = cron.schedule(
    schedule,
    async () => {
      try {
        await runExpiryCheck();
      } catch (err) {
        console.error('[expiry-checker] lỗi khi chạy cron:', err);
      }
    },
    { name: 'expiry-checker', timezone, noOverlap: true }
  );

  log(`[expiry-checker] đã lên lịch "${schedule}" (${timezone})`);
  return task;
};

/** Dừng cron (dùng khi tắt server hoặc trong test). */
const stopExpiryChecker = async () => {
  if (!task) return;
  await task.destroy();
  task = null;
};

module.exports = {
  DEFAULT_SCHEDULE,
  DEFAULT_TIMEZONE,
  DEFAULT_NOTIFY_DAYS,
  notifyDays,
  buildExpiryWindow,
  runExpiryCheck,
  startExpiryChecker,
  stopExpiryChecker,
};
