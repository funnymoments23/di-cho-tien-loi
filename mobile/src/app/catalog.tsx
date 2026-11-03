import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { lookupApi } from '@/api/lookup.api';
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
import { useAuthStore } from '@/store/authStore';
import { colors, radius, spacing, typography } from '@/theme';
import { getErrorMessage } from '@/utils/error';
import type { LookupItem } from '@/types/models';

type LookupKind = 'category' | 'unit';

export default function CatalogScreen() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';

  const [kind, setKind] = useState<LookupKind>('category');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [deletingName, setDeletingName] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<LookupItem | null>(null);
  const [input, setInput] = useState('');
  const [editorError, setEditorError] = useState('');
  const [saving, setSaving] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: qk.categories,
    queryFn: lookupApi.categories,
  });
  const unitsQuery = useQuery({
    queryKey: qk.units,
    queryFn: lookupApi.units,
  });

  const activeQuery = kind === 'category' ? categoriesQuery : unitsQuery;
  const items = activeQuery.data ?? [];
  const label = kind === 'category' ? 'danh mục' : 'đơn vị';

  const refreshLookups = () => {
    void queryClient.invalidateQueries({ queryKey: qk.categories });
    void queryClient.invalidateQueries({ queryKey: qk.units });
    // Tên danh mục/đơn vị được populate trong thực phẩm và tủ lạnh.
    void queryClient.invalidateQueries({ queryKey: qk.foodsRoot });
    void queryClient.invalidateQueries({ queryKey: qk.fridge });
  };

  const openAdd = () => {
    setEditing(null);
    setInput('');
    setEditorError('');
    setEditorOpen(true);
  };

  const openEdit = (item: LookupItem) => {
    setEditing(item);
    setInput(item.name);
    setEditorError('');
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
  };

  const save = async () => {
    const name = input.trim();
    setEditorError('');

    if (!name) {
      setEditorError(`Vui lòng nhập tên ${label}.`);
      return;
    }
    if (name.length > 50) {
      setEditorError(`Tên ${label} tối đa 50 ký tự.`);
      return;
    }

    setSaving(true);
    try {
      if (kind === 'category') {
        if (editing) await lookupApi.updateCategory(editing.name, name);
        else await lookupApi.createCategory(name);
      } else {
        if (editing) await lookupApi.updateUnit(editing.name, name);
        else await lookupApi.createUnit(name);
      }

      setEditorOpen(false);
      setNotice(
        `${editing ? 'Đã đổi tên' : 'Đã thêm'} ${label} "${name}".`
      );
      refreshLookups();
    } catch (err) {
      setEditorError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: LookupItem) => {
    setError('');
    setNotice('');
    setDeletingName(item.name);
    try {
      if (kind === 'category') await lookupApi.deleteCategory(item.name);
      else await lookupApi.deleteUnit(item.name);

      setNotice(`Đã xoá ${label} "${item.name}".`);
      refreshLookups();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingName(null);
    }
  };

  const confirmRemove = (item: LookupItem) => {
    Alert.alert(
      `Xoá ${label}`,
      `Bạn chắc chắn muốn xoá "${item.name}"?`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: () => void remove(item),
        },
      ]
    );
  };

  return (
    <>
      <Screen
        refreshing={
          categoriesQuery.isRefetching || unitsQuery.isRefetching
        }
        onRefresh={() => {
          void categoriesQuery.refetch();
          void unitsQuery.refetch();
        }}
      >
        <ScreenHeader
          title="Danh mục & đơn vị"
          subtitle="Dữ liệu dùng chung cho kho thực phẩm"
          onBack={() => router.back()}
        />

        {notice ? <FormMessage type="success" message={notice} /> : null}
        {error ? <FormMessage type="error" message={error} /> : null}

        <View style={styles.segment}>
          <SegmentButton
            title={`Danh mục (${categoriesQuery.data?.length ?? 0})`}
            active={kind === 'category'}
            onPress={() => setKind('category')}
          />
          <SegmentButton
            title={`Đơn vị (${unitsQuery.data?.length ?? 0})`}
            active={kind === 'unit'}
            onPress={() => setKind('unit')}
          />
        </View>

        {!isAdmin ? (
          <FormMessage
            type="info"
            message="Bạn chỉ có thể xem. Chỉ quản trị viên hệ thống mới thêm, sửa hoặc xoá danh mục và đơn vị."
          />
        ) : null}

        {activeQuery.isLoading ? (
          <LoadingState message={`Đang tải ${label}...`} />
        ) : activeQuery.isError ? (
          <ErrorState
            message={getErrorMessage(activeQuery.error)}
            onRetry={() => void activeQuery.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title={`Chưa có ${label}`}
            message={
              isAdmin
                ? `Tạo ${label} đầu tiên để dùng cho kho thực phẩm.`
                : `Quản trị viên chưa tạo ${label} nào.`
            }
            icon={kind === 'category' ? 'pricetags-outline' : 'scale-outline'}
            action={
              isAdmin ? (
                <AppButton
                  title={`Thêm ${label}`}
                  onPress={openAdd}
                  variant="outline"
                />
              ) : undefined
            }
          />
        ) : (
          <SectionCard
            title={kind === 'category' ? 'Danh mục' : 'Đơn vị đo'}
            action={
              isAdmin ? <LinkText onPress={openAdd}>Thêm</LinkText> : null
            }
          >
            {items.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.row,
                  index < items.length - 1 && styles.divider,
                ]}
              >
                <View style={styles.index}>
                  <Text style={styles.indexText}>{index + 1}</Text>
                </View>
                <Text style={styles.name} numberOfLines={2}>
                  {item.name}
                </Text>

                {isAdmin ? (
                  <View style={styles.actions}>
                    <LinkText onPress={() => openEdit(item)}>Sửa</LinkText>
                    <LinkText onPress={() => confirmRemove(item)}>
                      {deletingName === item.name ? 'Đang xoá...' : 'Xoá'}
                    </LinkText>
                  </View>
                ) : null}
              </View>
            ))}
          </SectionCard>
        )}

        {isAdmin && items.length > 0 ? (
          <AppButton
            title={`Thêm ${label}`}
            onPress={openAdd}
            variant="outline"
          />
        ) : null}
      </Screen>

      <Modal
        visible={editorOpen}
        transparent
        animationType="fade"
        onRequestClose={closeEditor}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeEditor} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editing ? `Sửa ${label}` : `Thêm ${label}`}
            </Text>
            <Text style={styles.modalHint}>Tên tối đa 50 ký tự.</Text>

            <AppInput
              label={`Tên ${label}`}
              value={input}
              onChangeText={setInput}
              placeholder={kind === 'category' ? 'Ví dụ: Rau củ' : 'Ví dụ: kg'}
              autoFocus
              maxLength={50}
              returnKeyType="done"
              onSubmitEditing={save}
            />

            {editorError ? (
              <FormMessage type="error" message={editorError} />
            ) : null}

            <AppButton
              title="Lưu"
              onPress={save}
              loading={saving}
              disabled={!input.trim()}
            />
            <AppButton
              title="Huỷ"
              onPress={closeEditor}
              variant="outline"
              style={styles.modalCancel}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function SegmentButton({
  title,
  active,
  onPress,
}: {
  title: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
    >
      <Text
        style={[styles.segmentText, active && styles.segmentTextActive]}
        numberOfLines={1}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.lg,
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  segmentButtonActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentText: {
    ...typography.label,
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.primaryText,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  index: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  indexText: {
    ...typography.label,
    color: colors.primaryText,
  },
  name: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.overlay,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  modalTitle: {
    ...typography.heading,
    color: colors.text,
  },
  modalHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  modalCancel: {
    marginTop: spacing.md,
  },
});
