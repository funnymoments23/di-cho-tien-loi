const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Bỏ toàn bộ khoảng trắng và chuẩn hoá chữ thường cho email. */
export const normalizeEmail = (value: string) =>
  value.replace(/\s/g, '').toLowerCase();

export const isValidEmail = (value: string) =>
  EMAIL_PATTERN.test(normalizeEmail(value));

export const isValidName = (value: string) => {
  const name = value.trim();
  return name.length >= 3 && name.length <= 30;
};

export const isValidPassword = (value: string) =>
  value.length >= 6 && value.length <= 20;

export const isSixDigitCode = (value: string) =>
  /^\d{6}$/.test(value.trim());
