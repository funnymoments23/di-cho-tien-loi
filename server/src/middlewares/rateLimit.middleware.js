const RC = require('../constants/responseCode');
const { fail } = require('../utils/response');

const MINUTE = 60 * 1000;
const MAX_ENTRIES = 10_000; // chặn Map phình vô hạn nếu bị spam IP

/** Đọc số nguyên từ env, trả về mặc định nếu không có/không hợp lệ. */
const readNumber = (raw, fallback) => {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

/**
 * Rate limit trong bộ nhớ (đủ dùng cho 1 instance; nhiều instance thì cần Redis).
 *
 * Cấu hình qua env, đọc lại mỗi request để test có thể đổi:
 * - AUTH_RATE_LIMIT_WINDOW_MINUTES (mặc định 15)
 * - AUTH_RATE_LIMIT_MAX            (mặc định 20; đặt 0 để tắt)
 *
 * Vượt ngưỡng -> 429 / 00024 kèm header Retry-After.
 */
const createRateLimiter = ({ defaultMax = 20, keyGenerator } = {}) => {
  const hits = new Map();

  // Dọn entry hết hạn định kỳ để Map không giữ mãi IP cũ.
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, 5 * MINUTE);
  if (typeof timer.unref === 'function') timer.unref();

  const middleware = (req, res, next) => {
    const max = readNumber(process.env.AUTH_RATE_LIMIT_MAX, defaultMax);
    if (max <= 0) return next(); // tắt rate limit (test / môi trường dev đặc biệt)

    const windowMs =
      readNumber(process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES, 15) * MINUTE;
    const key = keyGenerator ? keyGenerator(req) : req.ip;
    const now = Date.now();

    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      if (hits.size >= MAX_ENTRIES) {
        // Xoá entry cũ nhất trước khi thêm mới.
        const oldestKey = hits.keys().next().value;
        hits.delete(oldestKey);
      }
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.set('Retry-After', String(retryAfter));
      return next(fail(RC.TOO_MANY_REQUESTS)); // 00024
    }

    return next();
  };

  middleware.reset = () => hits.clear();

  return middleware;
};

// Dùng chung cho các endpoint nhạy cảm (đăng ký, đăng nhập, gửi mã, xác minh email).
const authRateLimiter = createRateLimiter({ defaultMax: 20 });

module.exports = { createRateLimiter, authRateLimiter };
