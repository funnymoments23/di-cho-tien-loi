import { useEffect, useState } from 'react';
import { Link, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { authApi } from '@/api/auth.api';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { FormMessage } from '@/components/ui/FormMessage';
import { colors, spacing, typography } from '@/theme';
import { getErrorMessage } from '@/utils/error';
import {
  isSixDigitCode,
  isValidEmail,
  isValidPassword,
} from '@/utils/validation';

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);
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
      const data = await authApi.forgotPassword(normalizedEmail);
      setResetToken(data.resetToken);
      setStep(2);
      setCode('');
      setNewPassword('');
      setConfirmPassword('');
      setNotice('Mã đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra email.');
      setCooldown(60);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const resetPassword = async () => {
    setError('');
    setNotice('');

    if (!isSixDigitCode(code)) {
      setError('Mã xác minh phải gồm đúng 6 chữ số.');
      return;
    }
    if (!isValidPassword(newPassword)) {
      setError('Mật khẩu mới phải từ 6 đến 20 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }
    if (!resetToken) {
      setError('Phiên đặt lại mật khẩu không hợp lệ. Hãy gửi lại mã.');
      return;
    }

    setResetting(true);
    try {
      await authApi.resetPassword(code.trim(), resetToken, newPassword);
      router.replace({
        pathname: '/(auth)/login',
        params: { email: normalizedEmail, reset: '1' },
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setResetting(false);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      setError('');
      setNotice('');
      return;
    }
    router.back();
  };

  return (
    <AuthLayout
      title="Quên mật khẩu"
      subtitle={
        step === 1
          ? 'Nhập email đã đăng ký để nhận mã đặt lại mật khẩu.'
          : 'Nhập mã 6 chữ số và mật khẩu mới cho tài khoản của bạn.'
      }
      onBack={handleBack}
      footer={
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Nhớ mật khẩu?</Text>
          <Link href="/(auth)/login" style={styles.link}>
            Đăng nhập
          </Link>
        </View>
      }
    >
      {notice ? <FormMessage type="success" message={notice} /> : null}
      {error ? <FormMessage type="error" message={error} /> : null}

      {step === 1 ? (
        <>
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
            title="Gửi mã đặt lại"
            onPress={sendCode}
            loading={sending}
            disabled={!email}
          />
        </>
      ) : (
        <>
          <Text style={styles.helper}>
            Mã đã được gửi tới{' '}
            <Text style={styles.helperStrong}>{normalizedEmail}</Text>. Mã có hiệu lực
            10 phút.
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
            returnKeyType="next"
          />

          <AppInput
            label="Mật khẩu mới"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="6–20 ký tự"
            secure
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            maxLength={20}
            returnKeyType="next"
          />

          <AppInput
            label="Nhập lại mật khẩu mới"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Nhập lại mật khẩu mới"
            secure
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            maxLength={20}
            returnKeyType="go"
            onSubmitEditing={resetPassword}
          />

          <AppButton
            title="Đặt lại mật khẩu"
            onPress={resetPassword}
            loading={resetting}
            disabled={!code || !newPassword || !confirmPassword}
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
