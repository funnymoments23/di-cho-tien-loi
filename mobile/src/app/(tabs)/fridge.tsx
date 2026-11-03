import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { foodApi } from '@/api/food.api';
import {
  fridgeApi,
  type CreateFridgePayload,
  type UpdateFridgePayload,
} from '@/api/fridge.api';
import { qk } from '@/api/queryKeys';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { LinkText } from '@/components/ui/LinkText';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { SelectField } from '@/components/ui/SelectField';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/ui/StateView';
import { StatTile } from '@/components/ui/StatTile';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { colors, radius, spacing, typography } from '@/theme';
import { daysUntil, expiryLabel, expiryTone, formatDate } from '@/utils/date';
import { getErrorMessage } from '@/utils/error';
import type { FridgeItem } from '@/types/models';

const LOCATION_OPTIONS = [
  { id: 'ngăn mát', name: 'Ngăn mát' },
  { id: 'ngăn đá', name: 'Ngăn đá' },
  { id: 'cánh tủ', name: 'Cánh tủ' },
  { id: 'ngoài tủ', name: 'Ngoài tủ' },
];

const normalizeLocation = (value: string) =>
  value.trim().toLocaleLowerCase('vi');

const displayLocation = (value: string | null) =>
  value ? value.charAt(0).toLocaleUpperCase('vi') + value.slice(1) : '';

const defaultExpiryDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setHours(12, 0, 0, 0);
  return date;
};

const toUtcIso = (date: Date) =>
  new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  ).toISOString();

export default function FridgeScreen() {
  const queryClient = useQueryClient();

  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<FridgeItem | null>(null);
  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [expiryDate, setExpiryDate] = useState(defaultExpiryDate);
  const [location, setLocation] = useState('Ngăn mát');
  const [note, setNote] = useState('');
  const [editorError, setEditorError] = useState('');
  const [saving, setSaving] = useState(false);

  const fridgeQuery = useQuery({
    queryKey: qk.fridge,
    queryFn: fridgeApi.list,
  });
  const foodsQuery = useQuery({
    queryKey: qk.foods({}),
    queryFn: () => foodApi.list({}),
    enabled: editorOpen,
  });

  const items = fridgeQuery.data ?? [];
  const foods = foodsQuery.data ?? [];
  const foodOptions = foods.map((food) => ({
    id: food.id,
    name: food.name,
  }));

  const expired = items.filter((item) => daysUntil(item.useWithin) < 0).length;
  const expiringSoon = items.filter((item) => {
    const days = daysUntil(item.useWithin);
    return days >= 0 && days <= 3;
  }).length;

  const refreshFridge = () => {
    void queryClient.invalidateQueries({ queryKey: qk.fridge });
    void queryClient.invalidateQueries({ queryKey: qk.foodsRoot });
    void queryClient.invalidateQueries({ queryKey: qk.report('overview') });
    void queryClient.invalidateQueries({ queryKey: qk.report('fridge') });
  };

  const openCreate = () => {
    setEditing(null);
    setFoodName('');
    setQuantity('1');
    setExpiryDate(defaultExpiryDate());
    setLocation('Ngăn mát');
    setNote('');
    setEditorError('');
    setEditorOpen(true);
  };

  const openEdit = (item: FridgeItem) => {
    setEditing(item);
    setFoodName(item.foodName ?? '');
    setQuantity(String(item.quantity));
    const parsed = new Date(item.useWithin);
    setExpiryDate(Number.isNaN(parsed.getTime()) ? defaultExpiryDate() : parsed);
    setLocation(displayLocation(item.location));
    setNote(item.note ?? '');
    setEditorError('');
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
  };

  const save = async () => {
    setEditorError('');
    const quantityValue = Number(quantity.replace(',', '.'));

    if (!foodName) {
      setEditorError('Vui lòng chọn thực phẩm.');
      return;
    }
    if (
      !Number.isFinite(quantityValue) ||
      quantityValue <= 0 ||
      quantityValue > 1_000_000
    ) {
      setEditorError('Số lượng phải là số dương, tối đa 1.000.000.');
      return;
    }

    const useWithin = toUtcIso(expiryDate);

    if (editing) {
      const payload: UpdateFridgePayload = { itemId: editing.id };
      let changed = false;

      if (quantityValue !== editing.quantity) {
        payload.newQuantity = quantityValue;
        changed = true;
      }
      if (formatDate(expiryDate) !== formatDate(editing.useWithin)) {
        payload.newUseWithin = useWithin;
        changed = true;
      }
      if (normalizeLocation(location) !== (editing.location ?? '')) {
        payload.newLocation = normalizeLocation(location);
        changed = true;
      }
      if (note.trim() !== (editing.note ?? '')) {
        payload.newNote = note.trim();
        changed = true;
      }

      if (!changed) {
        setEditorError('Chưa có thay đổi nào.');
        return;
      }

      setSaving(true);
      try {
        await fridgeApi.update(payload);
        setEditorOpen(false);
        setNotice(`Đã cập nhật "${editing.foodName ?? 'món ăn'}".`);
        refreshFridge();
      } catch (err) {
        setEditorError(getErrorMessage(err));
      } finally {
        setSaving(false);
      }
      return;
    }

    const payload: CreateFridgePayload = {
      foodName,
      quantity: quantityValue,
      useWithin,
      ...(normalizeLocation(location)
        ? { location: normalizeLocation(location) }
        : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };

    setSaving(true);
    try {
      await fridgeApi.create(payload);
      setEditorOpen(false);
      setNotice(`Đã thêm "${foodName}" vào tủ lạnh.`);
      refreshFridge();
    } catch (err) {
      setEditorError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: FridgeItem) => {
    setError('');
    setNotice('');
    setDeletingId(item.id);
    try {
      await fridgeApi.remove(item.id);
      setNotice(`Đã xoá "${item.foodName ?? 'món ăn'}" khỏi tủ.`);
      refreshFridge();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const confirmRemove = (item: FridgeItem) => {
    Alert.alert(
      'Xoá món khỏi tủ',
      `Xoá "${item.foodName ?? 'món ăn'}" khỏi tủ lạnh? Hành động này được ghi nhận vào báo cáo.`,
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
        refreshing={fridgeQuery.isRefetching}
        onRefresh={() => void fridgeQuery.refetch()}
      >
        <ScreenHeader
          boxed
          title="Tủ lạnh"
          subtitle={
            items.length > 0
              ? `${items.length} món đang được lưu trữ`
              : 'Theo dõi thực phẩm và hạn sử dụng'
          }
        />

        {notice ? <FormMessage type="success" message={notice} /> : null}
        {error ? <FormMessage type="error" message={error} /> : null}

        {fridgeQuery.isLoading ? (
          <LoadingState message="Đang mở tủ lạnh..." />
        ) : fridgeQuery.isError ? (
          <ErrorState
            message={getErrorMessage(fridgeQuery.error)}
            onRetry={() => void fridgeQuery.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="Tủ lạnh đang trống"
            message="Thêm thực phẩm vào tủ để theo dõi hạn sử dụng và nhận nhắc nhở trước 3 ngày."
            materialIcon="fridge-outline"
          />
        ) : (
          <>
            <View style={styles.statsRow}>
              <StatTile
                label="Tổng thực phẩm"
                value={items.length}
                tone="primary"
              />
              <StatTile
                label="Sắp hết hạn"
                value={expiringSoon}
                tone="warning"
              />
              <StatTile label="Đã hết hạn" value={expired} tone="danger" />
            </View>

            <SectionCard title="Danh sách thực phẩm">
              {items.map((item, index) => (
                <FridgeRow
                  key={item.id}
                  item={item}
                  last={index === items.length - 1}
                  deleting={deletingId === item.id}
                  onEdit={() => openEdit(item)}
                  onDelete={() => confirmRemove(item)}
                />
              ))}
            </SectionCard>
          </>
        )}

        <View style={styles.footerActions}>
          <AppButton
            title="Kho thực phẩm"
            onPress={() => router.push('/food')}
            variant="outline"
            style={styles.footerButton}
          />
          <AppButton
            title="Thêm thực phẩm"
            onPress={openCreate}
            disabled={fridgeQuery.isLoading || fridgeQuery.isError}
            style={styles.footerButton}
          />
        </View>
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
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalTitle}>
                {editing ? 'Sửa món trong tủ' : 'Thêm món vào tủ'}
              </Text>
              <Text style={styles.modalHint}>
                Mỗi thực phẩm chỉ có một mục trong tủ của nhóm.
              </Text>

              {foodsQuery.isLoading ? (
                <FormMessage type="info" message="Đang tải kho thực phẩm..." />
              ) : foods.length === 0 ? (
                <FormMessage
                  type="info"
                  message="Kho thực phẩm đang trống. Thêm thực phẩm trước khi thêm vào tủ."
                />
              ) : null}

              <SelectField
                label="Thực phẩm"
                value={foodName}
                placeholder="Chọn thực phẩm"
                options={foodOptions}
                onChange={setFoodName}
                disabled={Boolean(editing)}
              />

              <AppInput
                label="Số lượng"
                value={quantity}
                onChangeText={setQuantity}
                placeholder="Ví dụ: 1"
                keyboardType="decimal-pad"
                maxLength={10}
              />

              <DateField
                label="Hạn sử dụng"
                value={expiryDate}
                onChange={setExpiryDate}
              />

              <SelectField
                label="Vị trí"
                value={location}
                placeholder="Chọn vị trí"
                options={LOCATION_OPTIONS}
                onChange={setLocation}
              />

              <AppInput
                label="Ghi chú"
                value={note}
                onChangeText={setNote}
                placeholder="Ví dụ: dùng cho bữa sáng"
                multiline
                numberOfLines={3}
                maxLength={500}
                style={styles.noteInput}
              />

              {editorError ? (
                <FormMessage type="error" message={editorError} />
              ) : null}

              <AppButton
                title="Lưu"
                onPress={save}
                loading={saving}
                disabled={!foodName || !quantity}
              />
              <AppButton
                title="Huỷ"
                onPress={closeEditor}
                variant="outline"
                style={styles.modalCancel}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function FridgeRow({
  item,
  last,
  deleting,
  onEdit,
  onDelete,
}: {
  item: FridgeItem;
  last: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tone = expiryTone(item.useWithin);
  const toneStyle = {
    danger: { background: colors.dangerSoft, foreground: colors.danger },
    warning: { background: colors.warningSoft, foreground: colors.warning },
    success: { background: colors.successSoft, foreground: colors.success },
  }[tone];

  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <Thumbnail
        uri={item.image}
        label={item.foodName ?? '?'}
        size={52}
      />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.name} numberOfLines={1}>
            {item.foodName ?? 'Không xác định'}
          </Text>
          <View style={[styles.badge, { backgroundColor: toneStyle.background }]}>
            <Text
              style={[styles.badgeText, { color: toneStyle.foreground }]}
              numberOfLines={1}
            >
              {expiryLabel(item.useWithin)}
            </Text>
          </View>
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {item.quantity} {item.unitName ?? ''} ·{' '}
          {displayLocation(item.location) || 'Chưa xếp vị trí'}
        </Text>
        <Text style={styles.date}>Hạn dùng: {formatDate(item.useWithin)}</Text>
      </View>

      <View style={styles.actions}>
        <LinkText onPress={onEdit}>Sửa</LinkText>
        <LinkText onPress={onDelete}>
          {deleting ? 'Đang xoá...' : 'Xoá'}
        </LinkText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footerActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  footerButton: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowBody: {
    flex: 1,
    justifyContent: 'center',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...typography.bodyStrong,
    color: colors.text,
    flex: 1,
  },
  badge: {
    maxWidth: 120,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    ...typography.label,
    fontSize: 10,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  date: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.overlay,
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
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
  noteInput: {
    minHeight: 82,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  modalCancel: {
    marginTop: spacing.md,
  },
});
