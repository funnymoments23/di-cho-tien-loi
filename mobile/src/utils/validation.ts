const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (value: string) =>
  EMAIL_PATTERN.test(value.trim().toLowerCase());

export const isValidName = (value: string) => {
  const name = value.trim();
  return name.length >= 3 && name.length <= 30;
};

export const isValidPassword = (value: string) =>
  value.length >= 6 && value.length <= 20;

export const isSixDigitCode = (value: string) =>
  /^\d{6}$/.test(value.trim());
