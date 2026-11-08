import dayjs from 'dayjs';

/** 08/11/2026 14:30 */
export const formatDateTime = (value?: string | null): string =>
  value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—';

/** 08/11/2026 */
export const formatDate = (value?: string | null): string =>
  value ? dayjs(value).format('DD/MM/YYYY') : '—';

/** Ngày sinh có thể lưu dạng ISO; trả về chuỗi ngắn gọn. */
export const formatBirthday = (value?: string | null): string =>
  value ? dayjs(value).format('DD/MM/YYYY') : '—';

export const genderLabel = (gender?: string | null): string => {
  if (gender === 'male') return 'Nam';
  if (gender === 'female') return 'Nữ';
  if (gender === 'other') return 'Khác';
  return '—';
};
