import dayjs from 'dayjs';
import 'dayjs/locale/vi';

dayjs.locale('vi');

export const DATE_KEY = 'YYYY-MM-DD';

export const todayKey = () => dayjs().format(DATE_KEY);

export const formatDate = (value: string | Date, format = 'DD/MM/YYYY') =>
  dayjs(value).format(format);

export const formatMealDate = (value: string | Date) => {
  const text = dayjs(value).format('dddd, DD/MM');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const daysUntil = (value: string | Date) =>
  dayjs(value).startOf('day').diff(dayjs().startOf('day'), 'day');

export const expiryLabel = (value: string | Date) => {
  const days = daysUntil(value);
  if (days < 0) return 'Đã hết hạn';
  if (days === 0) return 'Hết hạn hôm nay';
  if (days === 1) return 'Còn 1 ngày';
  return `Còn ${days} ngày`;
};

export const expiryTone = (value: string | Date): 'danger' | 'warning' | 'success' => {
  const days = daysUntil(value);
  if (days <= 0) return 'danger';
  if (days <= 3) return 'warning';
  return 'success';
};

export type DayItem = {
  key: string;
  weekday: string;
  day: string;
  isToday: boolean;
};

export const getNextDays = (count: number): DayItem[] =>
  Array.from({ length: count }, (_, index) => {
    const date = dayjs().add(index, 'day');
    return {
      key: date.format(DATE_KEY),
      weekday: date.format('dd'),
      day: date.format('DD'),
      isToday: index === 0,
    };
  });
