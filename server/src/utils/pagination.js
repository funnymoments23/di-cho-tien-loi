const RC = require('../constants/responseCode');
const { fail } = require('./response');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const readInt = (value, fallback) => {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.trim() === '') return NaN;
  const number = Number(value);
  return Number.isInteger(number) ? number : NaN;
};

/**
 * Đọc `page` / `limit` từ query.
 * Trả null nếu client không gửi tham số nào (giữ response dạng mảng cũ),
 * trả { page, limit, skip } nếu có ít nhất một tham số.
 */
const parsePagination = (query = {}) => {
  const hasPagination = query.page !== undefined || query.limit !== undefined;
  if (!hasPagination) return null;

  const page = readInt(query.page, 1);
  const limit = readInt(query.limit, DEFAULT_LIMIT);

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw fail(RC.PAGINATION_INVALID); // 00410
  }

  return { page, limit, skip: (page - 1) * limit };
};

const pageResult = (items, total, pagination) => ({
  items,
  total,
  page: pagination.page,
  limit: pagination.limit,
  totalPages: Math.ceil(total / pagination.limit),
});

/** Áp dụng phân trang cho Mongoose query; trả query đã skip/limit. */
const applyPagination = (query, pagination) => {
  if (!pagination) return query;
  return query.skip(pagination.skip).limit(pagination.limit);
};

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  parsePagination,
  pageResult,
  applyPagination,
};
