import { useEffect, useState } from 'react';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { authApi } from '@/api/auth.api';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { FormMessage } from '@/components/ui/FormMessage';
import { colors, spacing, typography } from '@/theme';
import { getErrorMessage } from '@/utils/error';
import { isSixDigitCode, isValidEmail } from '@/utils/validation';

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ email?: string; token?: string }>();

  const paramEmail = typeof params.email === 'string' ? params.email : '';
  const paramToken = typeof params.token === 'string' ? params.token : '';

  const [email, setEmail] = useState(paramEmail);
  const [token, setToken] = useState(paramToken);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const normalizedEmail = email.trim().toLowerCase();

  const sendCode = async () => {
    setError('');
    setNotice('');

    if (!isValidEmail(normalizedEmail)) {
      setError('Email không hợp lệ.');
      return;
    }

    setSending(true);
    try {
      const data = await authApi.sendVerificationCode(normalizedEmail);

      if (data.alreadyVerified) {
        router.replace({
          pathname: '/(auth)/login',
          params: { email: normalizedEmail, verified: '1' },
        });
        return;
      }

      if (data.verificationToken) setToken(data.verificationToken);
      setNotice('Mã xác minh đã được gửi. Vui lòng kiểm tra email.');
      setCooldown(60);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    setError('');
    setNotice('');

    if (!isSixDigitCode(code)) {
      setError('Mã xác minh phải gồm đúng 6 chữ số.');
      return;
    }
    if (!token) {
      setError('Chưa có mã xác minh. Hãy gửi lại mã trước.');
      return;
    }

    setVerifying(true);
    try {
      await authApi.verifyEmail(code.trim(), token);
      router.replace({
        pathname: '/(auth)/login',
        params: { email: normalizedEmail, verified: '1' },
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <AuthLayout
      title="Xác minh email"
      subtitle="Nhập mã 6 chữ số đã được gửi tới email của bạn để kích hoạt tài khoản."
      onBack={() => router.back()}
      footer={
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Đã xác minh?</Text>
          <Link
            href={{ pathname: '/(auth)/login', params: { email: normalizedEmail } }}
            style={styles.link}
          >
            Đăng nhập
          </Link>
        </View>
      }
    >
      {notice ? <FormMessage type="success" message={notice} /> : null}
      {error ? <FormMessage type="error" message={error} /> : null}

      {token ? (
        <>
          <Text style={styles.helper}>
            Mã đã được gửi tới{' '}
            <Text style={styles.helperStrong}>{email || 'email của bạn'}</Text>. Mã có
            hiệu lực 10 phút.
          </Text>

          <AppInput
            label="Mã xác minh"
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            style={styles.codeInput}
            returnKeyType="done"
            onSubmitEditing={verify}
            autoFocus
          />

          <AppButton
            title="Xác minh email"
            onPress={verify}
            loading={verifying}
            disabled={code.length !== 6}
          />

          <AppButton
            title={cooldown > 0 ? `Gửi lại mã (${cooldown}s)` : 'Gửi lại mã'}
            onPress={sendCode}
            loading={sending}
            disabled={cooldown > 0}
            variant="outline"
            style={styles.secondaryButton}
          />
        </>
      ) : (
        <>
          <Text style={styles.helper}>
            Tài khoản của bạn chưa được xác minh. Nhập email để nhận mã mới.
          </Text>

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
            maxLength={255}
            returnKeyType="go"
            onSubmitEditing={sendCode}
          />

          <AppButton
            title="Gửi mã xác minh"
            onPress={sendCode}
            loading={sending}
            disabled={!email}
          />
        </>
      )}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  helper: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  helperStrong: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: '700',
    paddingVertical: 10,
  },
  secondaryButton: {
    marginTop: spacing.md,
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
