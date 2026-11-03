import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type FormMessageProps = {
  type?: 'error' | 'success' | 'info';
  message: string;
  autoHideMs?: number;
};

const tones = {
  error: { background: colors.dangerSoft, foreground: colors.danger },
  success: { background: colors.successSoft, foreground: colors.success },
  info: { background: colors.infoSoft, foreground: colors.info },
} as const;

export function FormMessage({
  type = 'info',
  message,
  autoHideMs = 5000,
}: FormMessageProps) {
  const [hiddenMessage, setHiddenMessage] = useState<string | null>(null);

  useEffect(() => {
    // Chỉ thông báo thành công tự ẩn; lỗi/info cần người dùng đọc và xử lý.
    if (type !== 'success') return;

    const timer = setTimeout(() => setHiddenMessage(message), autoHideMs);
    return () => clearTimeout(timer);
  }, [message, type, autoHideMs]);

  // Thông báo mới (khác lần vừa tự ẩn) sẽ hiện lại mà không cần setState
  // đồng bộ trong effect.
  if (hiddenMessage === message) return null;

  const tone = tones[type];

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.container, { backgroundColor: tone.background }]}
    >
      <View style={[styles.dot, { backgroundColor: tone.foreground }]} />
      <Text style={[styles.message, { color: tone.foreground }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  message: {
    ...typography.caption,
    flex: 1,
  },
});
