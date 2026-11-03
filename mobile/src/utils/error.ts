import { ApiError } from '@/api/client';

/** Lấy thông điệp tiếng Việt từ backend, fallback khi lỗi mạng/không xác định. */
export function getErrorMessage(
  error: unknown,
  fallback = 'Có lỗi xảy ra, vui lòng thử lại.'
): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
