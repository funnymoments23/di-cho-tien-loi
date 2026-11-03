import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@/api/client';
import { qk } from '@/api/queryKeys';
import { tabsApi } from '@/api/tabs.api';
import { AppButton } from '@/components/ui/AppButton';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { useAuthStore } from '@/store/authStore';
import { colors, radius, spacing, typography } from '@/theme';
import { getErrorMessage } from '@/utils/error';

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const queryClient = useQueryClient();

  const groupQuery = useQuery({
    queryKey: qk.groupInfo,
    queryFn: tabsApi.groupInfo,
    retry: false,
  });

  const noGroup =
    groupQuery.error instanceof ApiError && groupQuery.error.code === '00096';

  const handleLogout = async () => {
    await logout();
    queryClient.clear();
    router.replace('/(auth)/login');
  };

  return (
    <Screen
      refreshing={groupQuery.isRefetching}
      onRefresh={() => void groupQuery.refetch()}
    >
      <ScreenHeader title="Cá nhân" subtitle="Tài khoản và nhóm gia đình" />

      <SectionCard>
        <View style={styles.userRow}>
          <Thumbnail uri={user?.avatar} label={user?.name ?? '?'} size={64} />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name ?? 'Người dùng'}</Text>
            <Text style={styles.userEmail}>{user?.email ?? '—'}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {user?.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
              </Text>
            </View>
          </View>
        </View>
      </SectionCard>

      <SectionCard title="Nhóm gia đình">
        {groupQuery.isLoading ? (
          <Text style={styles.muted}>Đang tải thông tin nhóm...</Text>
        ) : noGroup ? (
          <View>
            <Text style={styles.emptyTitle}>Bạn chưa tham gia nhóm</Text>
            <Text style={styles.muted}>
              Nhờ trưởng nhóm thêm bạn bằng username, hoặc tạo nhóm mới khi chức
              năng quản lý nhóm được hoàn thiện.
            </Text>
          </View>
        ) : groupQuery.isError ? (
          <Text style={styles.error}>{getErrorMessage(groupQuery.error)}</Text>
        ) : groupQuery.data ? (
          <View>
            <InfoRow label="Tên nhóm" value={groupQuery.data.name} />
            <InfoRow
              label="Vai trò"
              value={groupQuery.data.isAdmin ? 'Trưởng nhóm' : 'Thành viên'}
            />
            <InfoRow
              label="Trưởng nhóm"
              value={groupQuery.data.admin?.name ?? '—'}
            />
            <InfoRow
              label="Số thành viên"
              value={`${groupQuery.data.memberCount} người`}
            />
          </View>
        ) : null}
      </SectionCard>

      <SectionCard title="Ứng dụng">
        <InfoRow label="Tên ứng dụng" value="Đi chợ tiện lợi" />
        <InfoRow label="Phiên bản" value="1.0.0" />
        <InfoRow label="Máy chủ" value="REST API /it4788" />
      </SectionCard>

      <AppButton
        title="Đăng xuất"
        onPress={handleLogout}
        variant="outline"
        style={styles.logout}
      />
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    ...typography.heading,
    color: colors.text,
  },
  userEmail: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginTop: spacing.sm,
  },
  roleText: {
    ...typography.label,
    fontSize: 10,
    color: colors.primaryText,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    ...typography.body,
    color: colors.textMuted,
  },
  infoValue: {
    ...typography.bodyStrong,
    color: colors.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  muted: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
  emptyTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  error: {
    ...typography.body,
    color: colors.danger,
  },
  logout: {
    marginTop: spacing.sm,
  },
});
