import { useState } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, StyleSheet, Text } from 'react-native';
import { authApi } from '@/api/auth.api';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { FormMessage } from '@/components/ui/FormMessage';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, typography } from '@/theme';
import { getErrorMessage } from '@/utils/error';

export default function ChangePasswordScreen() {
  const logout = useAuthStore((state) => state.logout);
  const queryClient = useQueryClient();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError('');

    if (!oldPassword) {
      setError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 20) {
      setError('Mật khẩu mới phải từ 6 đến 20 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (newPassword === oldPassword) {
      setError('Mật khẩu mới không được giống mật khẩu hiện tại.');
      return;
    }

    setSaving(true);
    try {
      await authApi.changePassword(oldPassword, newPassword);

      // Backend huỷ toàn bộ phiên cũ (refresh token + tokenVersion) sau khi đổi
      // mật khẩu, nên app cũng phải đăng xuất để tránh request bằng token chết.
      await logout();
      queryClient.clear();

      Alert.alert(
        'Đã đổi mật khẩu',
        'Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại bằng mật khẩu mới.'
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthLayout
      title="Đổi mật khẩu"
      subtitle="Cập nhật mật khẩu đăng nhập của bạn"
      onBack={() => router.back()}
    >
      {error ? <FormMessage type="error" message={error} /> : null}

      <AppInput
        label="Mật khẩu hiện tại"
        value={oldPassword}
        onChangeText={setOldPassword}
        placeholder="Nhập mật khẩu hiện tại"
        secure
        maxLength={20}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="next"
      />

      <AppInput
        label="Mật khẩu mới"
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder="6–20 ký tự"
        secure
        maxLength={20}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
      />

      <AppInput
        label="Xác nhận mật khẩu mới"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Nhập lại mật khẩu mới"
        secure
        maxLength={20}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={save}
      />

      <AppButton
        title="Đổi mật khẩu"
        onPress={save}
        loading={saving}
        disabled={!oldPassword || !newPassword || !confirmPassword}
      />

      <Text style={styles.hint}>
        Mật khẩu gồm 6–20 ký tự. Sau khi đổi, mật khẩu cũ không còn hiệu lực và
        bạn sẽ được đăng xuất khỏi mọi thiết bị để đăng nhập lại.
      </Text>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
