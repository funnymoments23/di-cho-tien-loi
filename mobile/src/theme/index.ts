export { colors, palette, chartColors } from './colors';
export type { AppColors, AppColorName } from './colors';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const fonts = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
} as const;

export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontFamily: fonts.bold },
  title: { fontSize: 22, lineHeight: 28, fontFamily: fonts.bold },
  heading: { fontSize: 18, lineHeight: 24, fontFamily: fonts.semibold },
  body: { fontSize: 16, lineHeight: 22, fontFamily: fonts.regular },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontFamily: fonts.semibold },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: fonts.regular },
  label: { fontSize: 12, lineHeight: 16, fontFamily: fonts.semibold },
} as const;

export type TypographyVariant = keyof typeof typography;
