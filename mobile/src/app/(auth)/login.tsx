import { useState } from 'react';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { authApi } from '@/api/auth.api';
import { ApiError } from '@/api/client';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { FormMessage } from '@/components/ui/FormMessage';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, typography } from '@/theme';
import { getErrorMessage } from '@/utils/error';
import { isValidEmail, isValidPassword } from '@/utils/validation';

export default function LoginScreen() {
  const params = useLocalSearchParams<{
    email?: string;
    verified?: string;
    reset?: string;
  }>();

  const paramEmail = typeof params.email === 'string' ? params.email : '';

  const [email, setEmail] = useState(paramEmail);
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState(
    params.verified === '1'
      ? 'Email đã được xác minh. Hãy đăng nhập.'
      : params.reset === '1'
        ? 'Mật khẩu đã được đặt lại. Hãy đăng nhập bằng mật khẩu mới.'
        : ''
  );
  const [error, setError] = useState('');
  const [needsVerify, setNeedsVerify] = useState(false);
  const [loading, setLoading] = useState(false);

  const setSession = useAuthStore((state) => state.setSession);

  const normalizedEmail = email.trim().toLowerCase();

  const submit = async () => {
    setError('');
    setNotice('');
    setNeedsVerify(false);

    if (!isValidEmail(normalizedEmail)) {
      setError('Email không hợp lệ.');
      return;
    }
    if (!isValidPassword(password)) {
      setError('Mật khẩu phải từ 6 đến 20 ký tự.');
      return;
    }

    setLoading(true);
    try {
      const data = await authApi.login(normalizedEmail, password);
      await setSession(data);
      router.replace('/(tabs)');
    } catch (err) {
      if (err instanceof ApiError && err.code === '00044') {
        setNeedsVerify(true);
        setError(err.message);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Đăng nhập"
      subtitle="Quay lại để tiếp tục quản lý tủ lạnh và danh sách đi chợ của gia đình."
      footer={
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Chưa có tài khoản?</Text>
          <Link href="/(auth)/register" style={styles.link}>
            Đăng ký ngay
          </Link>
        </View>
      }
    >
      {notice ? <FormMessage type="success" message={notice} /> : null}
      {error ? <FormMessage type="error" message={error} /> : null}

      {needsVerify ? (
        <Link
          href={{
            pathname: '/(auth)/verify-email',
            params: { email: normalizedEmail },
          }}
          style={styles.verifyLink}
        >
          Xác minh email ngay →
        </Link>
      ) : null}

      <AppInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="ban@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
      />

      <AppInput
        label="Mật khẩu"
        value={password}
        onChangeText={setPassword}
        placeholder="Tối thiểu 6 ký tự"
        secure
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <View style={styles.forgotRow}>
        <Link href="/(auth)/forgot-password" style={styles.link}>
          Quên mật khẩu?
        </Link>
      </View>

      <AppButton
        title="Đăng nhập"
        onPress={submit}
        loading={loading}
        disabled={!email || !password}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  verifyLink: {
    ...typography.bodyStrong,
    color: colors.primaryText,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginBottom: spacing.lg,
  },
  link: {
    ...typography.bodyStrong,
    color: colors.primaryText,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  footerText: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
