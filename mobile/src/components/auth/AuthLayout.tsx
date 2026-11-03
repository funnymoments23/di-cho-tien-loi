import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme';

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  onBack?: () => void;
};

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  onBack,
}: AuthLayoutProps) {
  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View pointerEvents="none" style={styles.blobTop} />
      <View pointerEvents="none" style={styles.blobBottom} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {onBack ? (
            <Pressable onPress={handleBack} hitSlop={12} style={styles.backButton}>
              <Text style={styles.backText}>← Quay lại</Text>
            </Pressable>
          ) : (
            <View style={styles.backSpacer} />
          )}

          <View style={styles.brandRow}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <View style={[styles.dot, { backgroundColor: colors.secondary }]} />
            <View style={[styles.dot, { backgroundColor: colors.highlight }]} />
            <View style={[styles.dot, { backgroundColor: colors.accent }]} />
          </View>

          <Text style={styles.brand}>ĐI CHỢ TIỆN LỢI</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.card}>{children}</View>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  blobTop: {
    position: 'absolute',
    top: -90,
    right: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.highlight,
    opacity: 0.55,
  },
  blobBottom: {
    position: 'absolute',
    bottom: -110,
    left: -90,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: colors.accentSoft,
    opacity: 0.8,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 32,
    justifyContent: 'center',
  },
  backText: {
    ...typography.bodyStrong,
    color: colors.primaryText,
  },
  backSpacer: {
    height: 32,
  },
  brandRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.lg,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  brand: {
    ...typography.label,
    color: colors.primaryText,
    letterSpacing: 1.6,
    marginTop: spacing.md,
  },
  title: {
    ...typography.display,
    color: colors.text,
    marginTop: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
});
