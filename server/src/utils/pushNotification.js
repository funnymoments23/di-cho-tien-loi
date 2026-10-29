const DEFAULT_EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Expo giới hạn 100 message mỗi request.
const MAX_MESSAGES_PER_REQUEST = 100;
// Token hợp lệ có dạng ExponentPushToken[xxxx] hoặc ExpoPushToken[xxxx].
const TOKEN_PATTERN = /^Expo(nent)?PushToken\[[^\]]+\]$/;

const DAY_MS = 24 * 60 * 60 * 1000;

const isValidExpoPushToken = (token) =>
  typeof token === 'string' && TOKEN_PATTERN.test(token.trim());

const normalizeToken = (token) => (typeof token === 'string' ? token.trim() : '');

const chunk = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const truncate = (text, maxLength = 160) =>
  text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;

/** "hôm nay" / "sau 1 ngày" / "sau 3 ngày" — dùng cho nội dung thông báo. */
const describeDays = (days) => {
  if (days <= 0) return 'hôm nay';
  if (days === 1) return 'sau 1 ngày';
  return `sau ${days} ngày`;
};

/**
 * Số ngày còn lại, tính theo ngày (không theo giờ) để "hết hạn hôm nay"
 * vẫn là 0 ngày dù thời điểm chạy cron là 8 giờ sáng.
 */
const daysUntilExpiry = (expiryDate, now = new Date()) => {
  const utcDayStart = (value) =>
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  const startOfToday = utcDayStart(now);
  const expiryDay = utcDayStart(new Date(expiryDate));
  return Math.max(0, Math.round((expiryDay - startOfToday) / DAY_MS));
};

/**
 * Dựng danh sách message Expo cho các mục sắp hết hạn của một nhóm.
 * Mỗi deviceToken nhận một message (Expo nhận `to` là một token).
 *
 * @param {object} params
 * @param {string|import('mongoose').Types.ObjectId} params.groupId
 * @param {Array} params.items  fridge items đã populate foodId
 * @param {string[]} params.tokens deviceToken của thành viên nhóm
 * @param {Date} [params.now]
 */
const buildExpiryMessages = ({ groupId, items, tokens, now = new Date() }) => {
  if (!Array.isArray(items) || items.length === 0) return [];

  const uniqueTokens = [...new Set((tokens || []).map(normalizeToken).filter(isValidExpoPushToken))];
  if (uniqueTokens.length === 0) return [];

  const prepared = items.map((item) => ({
    id: String(item._id),
    name: item.foodId?.name || 'Thực phẩm',
    days: daysUntilExpiry(item.expiryDate, now),
  }));

  const body =
    prepared.length === 1
      ? `${prepared[0].name} sẽ hết hạn ${describeDays(prepared[0].days)}!`
      : `${prepared.length} thực phẩm sắp hết hạn: ${prepared
          .slice(0, 3)
          .map((item) => item.name)
          .join(', ')}${prepared.length > 3 ? '…' : ''}`;

  const data = {
    type: 'EXPIRY_REMINDER',
    groupId: String(groupId),
    itemIds: prepared.map((item) => item.id),
    foodNames: prepared.map((item) => item.name),
    daysUntilExpiry: Math.min(...prepared.map((item) => item.days)),
  };

  return uniqueTokens.map((token) => ({
    to: token,
    title: 'Thực phẩm sắp hết hạn',
    body: truncate(body),
    data,
    sound: 'default',
    priority: 'high',
    // Android 8+ cần channel; app tạo channel cùng id này khi khởi động.
    channelId: 'expiry',
  }));
};

/**
 * Gửi các message qua Expo Push Service.
 * Không ném lỗi mạng/HTTP ra ngoài để cron job luôn chạy tiếp các nhóm khác;
 * kết quả gồm số message thành công / thất bại và lỗi chi tiết.
 *
 * @param {Array<object>} messages
 * @returns {Promise<{sent: number, failed: number, tickets: Array, errors: Array}>}
 */
const sendExpoPush = async (messages = []) => {
  const validMessages = messages
    .filter((message) => message && isValidExpoPushToken(message.to))
    .map((message) => ({ ...message, to: normalizeToken(message.to) }));

  const result = { sent: 0, failed: 0, tickets: [], errors: [] };
  if (validMessages.length === 0) return result;

  const url = process.env.EXPO_PUSH_URL || DEFAULT_EXPO_PUSH_URL;
  const headers = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
    // Chỉ cần khi bật "Push Security" trong Expo; bỏ trống thì không gửi header.
    ...(process.env.EXPO_ACCESS_TOKEN
      ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
      : {}),
  };

  for (const batch of chunk(validMessages, MAX_MESSAGES_PER_REQUEST)) {
    try {
      // eslint-disable-next-line no-undef -- Node 18+ có fetch toàn cục
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        result.failed += batch.length;
        result.errors.push({
          status: response.status,
          message: detail || `Expo Push trả HTTP ${response.status}`,
          count: batch.length,
        });
        continue;
      }

      const payload = await response.json().catch(() => ({}));
      const tickets = Array.isArray(payload.data)
        ? payload.data
        : payload.data
          ? [payload.data]
          : [];

      batch.forEach((message, index) => {
        const ticket = tickets[index];
        if (ticket && ticket.status === 'ok') {
          result.sent += 1;
        } else {
          result.failed += 1;
          result.errors.push({
            token: message.to,
            message: ticket?.message || 'Không nhận được ticket hợp lệ từ Expo Push',
            details: ticket?.details || null,
          });
        }
      });

      result.tickets.push(...tickets);
    } catch (err) {
      result.failed += batch.length;
      result.errors.push({
        message: err.message || 'Không gửi được Expo Push',
        count: batch.length,
      });
    }
  }

  return result;
};

module.exports = {
  DEFAULT_EXPO_PUSH_URL,
  MAX_MESSAGES_PER_REQUEST,
  DAY_MS,
  isValidExpoPushToken,
  daysUntilExpiry,
  describeDays,
  buildExpiryMessages,
  sendExpoPush,
};
