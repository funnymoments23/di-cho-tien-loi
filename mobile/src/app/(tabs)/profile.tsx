import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { authApi } from '@/api/auth.api';
import { ApiError } from '@/api/client';
import { groupApi } from '@/api/group.api';
import { qk } from '@/api/queryKeys';
import { AppButton } from '@/components/ui/AppButton';
import { FormMessage } from '@/components/ui/FormMessage';
import { LinkText } from '@/components/ui/LinkText';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { useAuthStore } from '@/store/authStore';
import { colors, radius, spacing, typography } from '@/theme';
import { getErrorMessage } from '@/utils/error';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);
  const queryClient = useQueryClient();

  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  const groupQuery = useQuery({
    queryKey: qk.groupInfo,
    queryFn: groupApi.info,
    retry: false,
  });

  const noGroup =
    groupQuery.error instanceof ApiError && groupQuery.error.code === '00096';

  const handleLogout = async () => {
    await logout();
    queryClient.clear();
    router.replace('/(auth)/login');
  };

  const uploadAvatar = async (source: 'library' | 'camera') => {
    setError('');
    setNotice('');

    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError(
        source === 'camera'
          ? 'Bạn cần cấp quyền camera để chụp ảnh.'
          : 'Bạn cần cấp quyền thư viện ảnh để chọn ảnh.'
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          });

    if (result.canceled) return;

    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_AVATAR_BYTES) {
      setError('Ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.');
      return;
    }

    const type =
      asset.mimeType && IMAGE_MIME_TYPES.includes(asset.mimeType)
        ? asset.mimeType
        : 'image/jpeg';
    const extension =
      type === 'image/png'
        ? 'png'
        : type === 'image/webp'
          ? 'webp'
          : type === 'image/gif'
            ? 'gif'
            : 'jpg';

    const form = new FormData();
    form.append('image', {
      uri: asset.uri,
      name: asset.fileName ?? `avatar-${Date.now()}.${extension}`,
      type,
    } as any);

    setUploading(true);
    try {
      const updated = await authApi.updateAvatar(form);
      setUser(updated);
      setNotice('Đã cập nhật ảnh đại diện.');
      queryClient.invalidateQueries({ queryKey: qk.group });
      queryClient.invalidateQueries({ queryKey: qk.groupInfo });
      queryClient.invalidateQueries({ queryKey: qk.me });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const chooseAvatar = () => {
    Alert.alert('Ảnh đại diện', 'Chọn nguồn ảnh', [
      { text: 'Thư viện', onPress: () => void uploadAvatar('library') },
      { text: 'Chụp ảnh', onPress: () => void uploadAvatar('camera') },
      { text: 'Huỷ', style: 'cancel' },
    ]);
  };

  return (
    <Screen
      refreshing={groupQuery.isRefetching}
      onRefresh={() => void groupQuery.refetch()}
    >
      <ScreenHeader
        boxed
        title="Cá nhân"
        subtitle="Tài khoản và nhóm gia đình"
      />

      {notice ? <FormMessage type="success" message={notice} /> : null}
      {error ? <FormMessage type="error" message={error} /> : null}

      <SectionCard>
        <View style={styles.userRow}>
          <Pressable
            onPress={chooseAvatar}
            disabled={uploading}
            accessibilityRole="button"
            accessibilityLabel="Đổi ảnh đại diện"
            style={styles.avatarWrapper}
          >
            <Thumbnail
              uri={user?.avatar}
              label={user?.name ?? '?'}
              size={64}
              round
            />
            <View style={styles.avatarBadge}>
              <Ionicons
                name="camera"
                size={13}
                color={colors.onPrimary}
              />
            </View>
            {uploading ? (
              <View style={styles.avatarUploading}>
                <ActivityIndicator color={colors.primaryText} />
              </View>
            ) : null}
          </Pressable>

          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name ?? 'Người dùng'}</Text>
            <Text style={styles.userEmail}>{user?.email ?? '—'}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {user?.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
              </Text>
            </View>
            <View style={styles.avatarAction}>
              {uploading ? (
                <Text style={styles.uploadingText}>Đang tải ảnh...</Text>
              ) : (
                <LinkText onPress={chooseAvatar}>Đổi ảnh đại diện</LinkText>
              )}
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
              Tạo nhóm mới, hoặc nhờ trưởng nhóm thêm bạn bằng username. Sau khi
              được thêm, bấm kiểm tra lại trong phần thiết lập nhóm.
            </Text>
            <AppButton
              title="Thiết lập nhóm"
              onPress={() => router.push('/group/setup')}
              variant="outline"
              style={styles.groupAction}
            />
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
            <AppButton
              title="Quản lý nhóm"
              onPress={() => router.push('/group/manage')}
              variant="outline"
              style={styles.groupAction}
            />
          </View>
        ) : null}
      </SectionCard>

      <SectionCard title="Dữ liệu dùng chung">
        <Text style={styles.muted}>
          Danh mục và đơn vị đo dùng để phân loại thực phẩm trong kho và tủ lạnh.
        </Text>
        <AppButton
          title="Danh mục & đơn vị"
          onPress={() => router.push('/catalog')}
          variant="outline"
          style={styles.groupAction}
        />
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
  avatarWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: colors.surface,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  avatarUploading: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 34,
  },
  avatarAction: {
    marginTop: spacing.sm,
  },
  uploadingText: {
    ...typography.caption,
    color: colors.textMuted,
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
    ...typography.body,
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
  groupAction: {
    marginTop: spacing.md,
  },
  logout: {
    marginTop: spacing.sm,
  },
});
