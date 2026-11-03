import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { authApi } from '@/api/auth.api';
import { groupApi } from '@/api/group.api';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { FormMessage } from '@/components/ui/FormMessage';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, typography } from '@/theme';
import { getErrorMessage } from '@/utils/error';

export default function GroupSetupScreen() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();

  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);

  const refreshUserAndEnter = async () => {
    const freshUser = await authApi.me();
    setUser(freshUser);

    if (!freshUser.groupId) {
      setNotice('Chưa thấy nhóm. Nếu trưởng nhóm vừa thêm bạn, thử lại sau ít giây.');
      return false;
    }

    queryClient.clear();
    router.replace('/(tabs)');
    return true;
  };

  const createGroup = async () => {
    setError('');
    setNotice('');
    const name = groupName.trim();

    if (!name) {
      setError('Vui lòng nhập tên nhóm.');
      return;
    }
    if (name.length > 50) {
      setError('Tên nhóm tối đa 50 ký tự.');
      return;
    }

    setCreating(true);
    try {
      await groupApi.create(name);
      await refreshUserAndEnter();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const checkMembership = async () => {
    setError('');
    setNotice('');
    setChecking(true);
    try {
      await refreshUserAndEnter();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setChecking(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader
        title="Nhóm gia đình"
        subtitle="Tạo nhóm mới hoặc chờ trưởng nhóm thêm bạn"
        onBack={() => router.back()}
      />

      {notice ? <FormMessage type="info" message={notice} /> : null}
      {error ? <FormMessage type="error" message={error} /> : null}

      <SectionCard title="Tài khoản của bạn">
        <Text style={styles.muted}>
          Gửi username này cho trưởng nhóm để được thêm vào nhóm:
        </Text>
        <View style={styles.usernameBox}>
          <Text style={styles.username}>
            {user?.username ? `@${user.username}` : 'Chưa đặt username'}
          </Text>
        </View>
        {!user?.username ? (
          <Text style={styles.hint}>
            Bạn cần cập nhật username trong hồ sơ trước khi được thêm vào nhóm.
          </Text>
        ) : null}
      </SectionCard>

      <SectionCard title="Tạo nhóm mới">
        <Text style={styles.muted}>
          Bạn sẽ trở thành trưởng nhóm và có thể thêm các thành viên khác.
        </Text>
        <AppInput
          label="Tên nhóm"
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Ví dụ: Gia đình nhà mình"
          autoCapitalize="words"
          maxLength={50}
          returnKeyType="done"
          onSubmitEditing={createGroup}
        />
        <AppButton
          title="Tạo nhóm"
          onPress={createGroup}
          loading={creating}
          disabled={!groupName.trim()}
        />
      </SectionCard>

      <SectionCard title="Đã được thêm vào nhóm?">
        <Text style={styles.muted}>
          Sau khi trưởng nhóm thêm username của bạn, bấm kiểm tra lại để tải nhóm
          và dữ liệu mới.
        </Text>
        <AppButton
          title="Kiểm tra lại"
          onPress={checkMembership}
          loading={checking}
          variant="outline"
          style={styles.secondaryButton}
        />
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  usernameBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  username: {
    ...typography.title,
    color: colors.primaryText,
  },
  hint: {
    ...typography.caption,
    color: colors.warning,
  },
  secondaryButton: {
    marginTop: spacing.md,
  },
});
