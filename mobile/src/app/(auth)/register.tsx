import { useState } from 'react';
import { Link, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { authApi } from '@/api/auth.api';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { FormMessage } from '@/components/ui/FormMessage';
import { colors, spacing, typography } from '@/theme';
import { getErrorMessage } from '@/utils/error';
import { isValidEmail, isValidName, isValidPassword } from '@/utils/validation';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  const submit = async () => {
    setError('');

    if (!isValidName(name)) {
      setError('Họ tên phải từ 3 đến 30 ký tự.');
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setError('Email không hợp lệ.');
      return;
    }
    if (!isValidPassword(password)) {
      setError('Mật khẩu phải từ 6 đến 20 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }

    setLoading(true);
    try {
      const data = await authApi.register({
        name: name.trim(),
        email: normalizedEmail,
        password,
        language: 'vi',
        timezone: 'Asia/Ho_Chi_Minh',
      });

      router.replace({
        pathname: '/(auth)/verify-email',
        params: {
          email: normalizedEmail,
          token: data.verificationToken,
        },
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Tạo tài khoản"
      subtitle="Bắt đầu chia sẻ danh sách đi chợ và tủ lạnh với gia đình."
      onBack={() => router.back()}
      footer={
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Đã có tài khoản?</Text>
          <Link href="/(auth)/login" style={styles.link}>
            Đăng nhập
          </Link>
        </View>
      }
    >
      {error ? <FormMessage type="error" message={error} /> : null}

      <AppInput
        label="Họ và tên"
        value={name}
        onChangeText={setName}
        placeholder="Nguyễn Văn A"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        maxLength={30}
        returnKeyType="next"
      />

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
        returnKeyType="next"
      />

      <AppInput
        label="Mật khẩu"
        value={password}
        onChangeText={setPassword}
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
        label="Nhập lại mật khẩu"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Nhập lại mật khẩu"
        secure
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        maxLength={20}
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <AppButton
        title="Tạo tài khoản"
        onPress={submit}
        loading={loading}
        disabled={!name || !email || !password || !confirmPassword}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
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
