/**
 * Bảng màu của ứng dụng "Đi chợ tiện lợi".
 *
 * Palette gốc lấy từ Color Hunt:
 *   #FF933E · #FFCB56 · #FFE9A9 · #73A5CA
 *
 * Giai đoạn hiện tại chỉ dùng một giao diện sáng (light-only).
 * Khi cần dark mode, chỉ cần bổ sung một bộ token thứ hai và một hook chọn theme;
 * các màn hình đã dùng token ngữ nghĩa sẽ không phải sửa.
 *
 * Quy ước:
 * - `palette`     : màu thô, chỉ dùng trong file này hoặc biểu đồ.
 * - `colors`      : màu ngữ nghĩa (semantic) để dùng trong toàn bộ ứng dụng.
 * - `primary`     : màu nền nút/điểm nhấn, KHÔNG dùng làm màu chữ trên nền sáng.
 * - `primaryText` : màu chữ/icon cam đủ tương phản trên nền sáng.
 * - `onPrimary`   : màu chữ/icon đặt trên nền `primary`.
 */

export const palette = {
  // Bốn màu gốc từ palette
  orange: '#FF933E',
  yellow: '#FFCB56',
  cream: '#FFE9A9',
  blue: '#73A5CA',

  // Tông đậm hơn để dùng cho chữ/trạng thái nhấn
  orangeDeep: '#9A3F00',
  orangePressed: '#E97A22',
  yellowDeep: '#8A5A00',
  yellowPressed: '#F0B83C',
  blueDeep: '#2F6F99',
  bluePressed: '#5C8FB5',

  // Trung tính ấm
  warm50: '#FFFBF5',
  warm100: '#FFF4E4',
  warm200: '#F0DFC8',
  warm500: '#7A6656',
  warm900: '#2A1A0F',
  white: '#FFFFFF',

  // Trạng thái
  green: '#2E7D32',
  greenSoft: '#E8F5E9',
  amber: '#8A5A00',
  amberSoft: '#FFF3D1',
  red: '#C62828',
  redSoft: '#FFEBEE',
  blueStatus: '#2F6F99',
  blueSoft: '#E7F1F8',
} as const;

export const colors = {
  // Thương hiệu
  primary: palette.orange,
  primaryPressed: palette.orangePressed,
  primarySoft: '#FFE9D6',
  primaryText: palette.orangeDeep,
  onPrimary: '#2A1608',

  // Màu phụ (vàng)
  secondary: palette.yellow,
  secondaryPressed: palette.yellowPressed,
  secondarySoft: '#FFF3D1',
  secondaryText: palette.yellowDeep,
  onSecondary: '#2A1A0F',

  // Màu nhấn (xanh)
  accent: palette.blue,
  accentPressed: palette.bluePressed,
  accentSoft: '#E7F1F8',
  accentText: palette.blueDeep,
  onAccent: '#0E2A3A',

  // Nền và bề mặt
  background: palette.warm50,
  surface: palette.white,
  surfaceAlt: palette.warm100,
  highlight: palette.cream,
  border: palette.warm200,

  // Chữ
  text: palette.warm900,
  textMuted: palette.warm500,
  textInverse: palette.white,

  // Trạng thái
  success: palette.green,
  successSoft: palette.greenSoft,
  warning: palette.amber,
  warningSoft: palette.amberSoft,
  danger: palette.red,
  dangerSoft: palette.redSoft,
  info: palette.blueStatus,
  infoSoft: palette.blueSoft,

  overlay: 'rgba(42, 26, 15, 0.45)',
} as const;

export type AppColors = typeof colors;
export type AppColorName = keyof AppColors;

/** Màu dùng cho biểu đồ / thống kê, giữ đúng thứ tự palette gốc. */
export const chartColors = [
  palette.orange,
  palette.yellow,
  palette.blue,
  palette.cream,
  palette.orangePressed,
  palette.bluePressed,
] as const;
