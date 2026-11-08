import { ApiError } from '../api/client';

/** Lấy thông điệp tiếng Việt từ lỗi API để hiển thị cho người dùng. */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Có lỗi xảy ra, vui lòng thử lại.';
};
