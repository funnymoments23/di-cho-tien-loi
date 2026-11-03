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
import { colors, spacing, typography } from '@/theme';

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  onBack?: () => void;
  centerContent?: boolean;
};

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  onBack,
  centerContent = false,
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

          <View style={centerContent ? styles.centeredBody : undefined}>
            <Text style={styles.brand}>ĐI CHỢ TIỆN LỢI</Text>
            <Text style={[styles.title, !subtitle && styles.titleNoSubtitle]}>
              {title}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

            <View style={styles.form}>{children}</View>

            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
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
  brand: {
    ...typography.label,
    color: colors.primaryText,
    letterSpacing: 1.6,
    marginTop: spacing.lg,
  },
  title: {
    ...typography.display,
    color: colors.text,
    marginTop: spacing.sm,
  },
  titleNoSubtitle: {
    marginBottom: spacing.xl,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  centeredBody: {
    flexGrow: 1,
    justifyContent: 'center',
    width: '100%',
  },
  form: {
    width: '100%',
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
});
