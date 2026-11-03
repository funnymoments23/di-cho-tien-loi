import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { authApi } from '@/api/auth.api';
import { ApiError } from '@/api/client';
import { groupApi } from '@/api/group.api';
import { qk } from '@/api/queryKeys';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { FormMessage } from '@/components/ui/FormMessage';
import { LinkText } from '@/components/ui/LinkText';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/ui/StateView';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { useAuthStore } from '@/store/authStore';
import { colors, radius, spacing, typography } from '@/theme';
import { getErrorMessage } from '@/utils/error';
import type { User } from '@/types/api';

export default function GroupManageScreen() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();

  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingUsername, setRemovingUsername] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const groupQuery = useQuery({
    queryKey: qk.group,
    queryFn: groupApi.detail,
    retry: false,
  });

  const group = groupQuery.data;
  const isAdmin = Boolean(group && user && group.adminId === user.id);
  const noGroup =
    groupQuery.error instanceof ApiError && groupQuery.error.code === '00096';

  const refreshGroup = () => {
    void queryClient.invalidateQueries({ queryKey: qk.group });
    void queryClient.invalidateQueries({ queryKey: qk.groupInfo });
  };

  const addMember = async () => {
    setError('');
    setNotice('');
    const value = username.trim();

    if (value.length < 3 || value.length > 15) {
      setError('Username phải từ 3 đến 15 ký tự.');
      return;
    }

    setAdding(true);
    try {
      await groupApi.addMember(value);
      setUsername('');
      setNotice(`Đã thêm @${value} vào nhóm.`);
      refreshGroup();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const removeMember = async (member: User) => {
    if (!member.username) {
      setError('Thành viên này chưa có username nên chưa thể xoá.');
      return;
    }

    setError('');
    setNotice('');
    setRemovingUsername(member.username);
    try {
      await groupApi.removeMember(member.username);
      setNotice(`Đã xoá ${member.name} khỏi nhóm.`);
      refreshGroup();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRemovingUsername(null);
    }
  };

  const confirmRemove = (member: User) => {
    Alert.alert(
      'Xoá thành viên',
      `Xoá ${member.name} khỏi nhóm?`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: () => void removeMember(member),
        },
      ]
    );
  };

  const leaveGroup = async () => {
    setError('');
    setNotice('');
    setLeaving(true);
    try {
      await groupApi.leave();
      const freshUser = await authApi.me();
      setUser(freshUser);
      queryClient.clear();
      router.replace('/group/setup');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLeaving(false);
    }
  };

  const confirmLeave = () => {
    Alert.alert(
      'Rời nhóm',
      isAdmin
        ? 'Bạn là trưởng nhóm. Quyền trưởng nhóm sẽ được chuyển cho thành viên còn lại. Bạn chắc chắn muốn rời nhóm?'
        : 'Bạn chắc chắn muốn rời nhóm?',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Rời nhóm',
          style: 'destructive',
          onPress: () => void leaveGroup(),
        },
      ]
    );
  };

  return (
    <Screen
      refreshing={groupQuery.isRefetching}
      onRefresh={() => void groupQuery.refetch()}
    >
      <ScreenHeader
        title="Quản lý nhóm"
        subtitle={group?.name ?? 'Thành viên và quyền trong nhóm'}
        onBack={() => router.back()}
      />

      {notice ? <FormMessage type="success" message={notice} /> : null}
      {error ? <FormMessage type="error" message={error} /> : null}

      {groupQuery.isLoading ? (
        <LoadingState message="Đang tải thông tin nhóm..." />
      ) : noGroup ? (
        <EmptyState
          title="Bạn chưa tham gia nhóm"
          message="Tạo nhóm mới hoặc nhờ trưởng nhóm thêm bạn bằng username."
          icon="people-outline"
          action={
            <AppButton
              title="Thiết lập nhóm"
              onPress={() => router.replace('/group/setup')}
              variant="outline"
            />
          }
        />
      ) : groupQuery.isError || !group ? (
        <ErrorState
          message={getErrorMessage(groupQuery.error)}
          onRetry={() => void groupQuery.refetch()}
        />
      ) : (
        <>
          <SectionCard title="Thông tin nhóm">
            <InfoRow label="Tên nhóm" value={group.name} />
            <InfoRow
              label="Trưởng nhóm"
              value={
                group.members.find((member) => member.id === group.adminId)?.name ??
                '—'
              }
            />
            <InfoRow label="Thành viên" value={`${group.memberCount} người`} />
            <InfoRow
              label="Vai trò của bạn"
              value={isAdmin ? 'Trưởng nhóm' : 'Thành viên'}
            />
          </SectionCard>

          {isAdmin ? (
            <SectionCard title="Thêm thành viên">
              <Text style={styles.hint}>
                Nhập username của người đã có tài khoản và chưa thuộc nhóm nào.
              </Text>
              <AppInput
                label="Username"
                value={username}
                onChangeText={setUsername}
                placeholder="username"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={15}
                returnKeyType="done"
                onSubmitEditing={addMember}
              />
              <AppButton
                title="Thêm thành viên"
                onPress={addMember}
                loading={adding}
                disabled={!username.trim()}
              />
            </SectionCard>
          ) : (
            <Text style={styles.note}>
              Chỉ trưởng nhóm mới có quyền thêm hoặc xoá thành viên.
            </Text>
          )}

          <SectionCard title="Thành viên">
            {group.members.map((member, index) => {
              const isGroupAdmin = member.id === group.adminId;
              const canRemove =
                isAdmin && !isGroupAdmin && Boolean(member.username);

              return (
                <View
                  key={member.id}
                  style={[
                    styles.memberRow,
                    index < group.members.length - 1 && styles.memberDivider,
                  ]}
                >
                  <Thumbnail
                    uri={member.avatar}
                    label={member.name}
                    size={44}
                    round
                  />
                  <View style={styles.memberBody}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {member.name}
                    </Text>
                    <Text style={styles.memberMeta} numberOfLines={1}>
                      {member.username ? `@${member.username}` : 'Chưa có username'}
                    </Text>
                  </View>

                  {isGroupAdmin ? (
                    <View style={styles.adminBadge}>
                      <Text style={styles.adminBadgeText}>Trưởng nhóm</Text>
                    </View>
                  ) : null}

                  {canRemove ? (
                    <LinkText onPress={() => confirmRemove(member)}>
                      {removingUsername === member.username ? 'Đang xoá...' : 'Xoá'}
                    </LinkText>
                  ) : null}
                </View>
              );
            })}
          </SectionCard>

          <AppButton
            title="Rời nhóm"
            onPress={confirmLeave}
            loading={leaving}
            variant="outline"
            style={styles.leaveButton}
          />
        </>
      )}
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
    ...typography.body,
    color: colors.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  memberDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  memberBody: {
    flex: 1,
  },
  memberName: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  memberMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  adminBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  adminBadgeText: {
    ...typography.label,
    fontSize: 10,
    color: colors.primaryText,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  note: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  leaveButton: {
    marginTop: spacing.sm,
  },
});
