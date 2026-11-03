import { useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
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
import { groupApi } from '@/api/group.api';
import { qk } from '@/api/queryKeys';
import { shoppingApi } from '@/api/shopping.api';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { FormMessage } from '@/components/ui/FormMessage';
import { LinkText } from '@/components/ui/LinkText';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { SelectField } from '@/components/ui/SelectField';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/ui/StateView';
import { useToggleShoppingTask } from '@/hooks/useToggleShoppingTask';
import { useAuthStore } from '@/store/authStore';
import { colors, radius, spacing, typography } from '@/theme';
import { formatDate } from '@/utils/date';
import { getErrorMessage } from '@/utils/error';
import type { ShoppingTask } from '@/types/models';

export default function ShoppingDetailScreen() {
  const params = useLocalSearchParams<{
    listId?: string | string[];
    openAdd?: string | string[];
  }>();
  const listId = Array.isArray(params.listId)
    ? params.listId[0]
    : params.listId;
  const shouldOpenAdd =
    (Array.isArray(params.openAdd) ? params.openAdd[0] : params.openAdd) ===
    '1';

  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const toggleTask = useToggleShoppingTask();

  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ShoppingTask | null>(null);
  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [editorError, setEditorError] = useState('');
  const [saving, setSaving] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);

  const shoppingQuery = useQuery({
    queryKey: qk.shopping,
    queryFn: shoppingApi.lists,
  });
  const groupQuery = useQuery({
    queryKey: qk.group,
    queryFn: groupApi.detail,
    retry: false,
  });
  const foodsQuery = useQuery({
    queryKey: qk.foods({}),
    queryFn: () => foodApi.list({}),
    enabled: editorOpen,
  });

  const list = shoppingQuery.data?.find((item) => item.id === listId);
  const isAdmin = Boolean(
    groupQuery.data &&
      user &&
      groupQuery.data.adminId === user.id
  );
  const tasks = list?.tasks ?? [];
  const done =
    list?.completedCount ?? tasks.filter((task) => task.isCompleted).length;
  const total = list?.taskCount ?? tasks.length;

  const foodOptions = (foodsQuery.data ?? []).map((food) => ({
    id: food.id,
    name: food.name,
  }));

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: qk.shopping });
    void queryClient.invalidateQueries({ queryKey: qk.report('overview') });
  };

  const openAdd = () => {
    setEditingTask(null);
    setFoodName('');
    setQuantity('1');
    setEditorError('');
    setEditorOpen(true);
  };

  const openEdit = (task: ShoppingTask) => {
    setEditingTask(task);
    setFoodName(task.foodName ?? '');
    setQuantity(String(task.quantity));
    setEditorError('');
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
  };

  useEffect(() => {
    if (!shouldOpenAdd || autoOpened || !list || !isAdmin) return;

    setAutoOpened(true);
    setEditingTask(null);
    setFoodName('');
    setQuantity('1');
    setEditorError('');
    setEditorOpen(true);
  }, [shouldOpenAdd, autoOpened, list, isAdmin]);

  const saveTask = async () => {
    setEditorError('');
    const value = Number(quantity.replace(',', '.'));

    if (!foodName) {
      setEditorError('Vui lòng chọn thực phẩm.');
      return;
    }
    if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) {
      setEditorError('Số lượng phải là số dương, tối đa 1.000.000.');
      return;
    }

    if (editingTask) {
      const changed =
        foodName !== (editingTask.foodName ?? '') ||
        value !== editingTask.quantity;

      if (!changed) {
        setEditorError('Chưa có thay đổi nào.');
        return;
      }

      setSaving(true);
      try {
        await shoppingApi.updateTask({
          taskId: editingTask.id,
          ...(foodName !== (editingTask.foodName ?? '')
            ? { newFoodName: foodName }
            : {}),
          ...(value !== editingTask.quantity ? { newQuantity: value } : {}),
        });
        setEditorOpen(false);
        setNotice(`Đã cập nhật "${foodName}".`);
        refresh();
      } catch (err) {
        setEditorError(getErrorMessage(err));
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!list) return;

    setSaving(true);
    try {
      await shoppingApi.addTasks(list.id, [
        { foodName, quantity: value },
      ]);
      setEditorOpen(false);
      setNotice(`Đã thêm "${foodName}" vào danh sách.`);
      refresh();
    } catch (err) {
      setEditorError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const removeTask = async (task: ShoppingTask) => {
    setError('');
    setNotice('');
    setDeletingTaskId(task.id);
    try {
      await shoppingApi.deleteTask(task.id);
      setNotice(`Đã xoá "${task.foodName ?? 'món ăn'}".`);
      refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingTaskId(null);
    }
  };

  const confirmRemoveTask = (task: ShoppingTask) => {
    Alert.alert(
      'Xoá món',
      `Xoá "${task.foodName ?? 'món ăn'}" khỏi danh sách?`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: () => void removeTask(task),
        },
      ]
    );
  };

  const removeList = async () => {
    if (!list) return;
    setError('');
    setNotice('');
    try {
      await shoppingApi.deleteList(list.id);
      refresh();
      router.back();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const confirmRemoveList = () => {
    if (!list) return;
    Alert.alert(
      'Xoá danh sách',
      `Xoá "${list.name}" và toàn bộ món bên trong?`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: () => void removeList(),
        },
      ]
    );
  };

  return (
    <>
      <Screen
        refreshing={shoppingQuery.isRefetching}
        onRefresh={() => void shoppingQuery.refetch()}
      >
        <ScreenHeader
          title={list?.name ?? 'Chi tiết danh sách'}
          subtitle={
            list
              ? `Giao cho ${list.assignedToName ?? list.assignedToUsername ?? 'chưa phân công'}`
              : 'Danh sách mua sắm'
          }
          onBack={() => router.back()}
        />

        {notice ? <FormMessage type="success" message={notice} /> : null}
        {error ? <FormMessage type="error" message={error} /> : null}

        {shoppingQuery.isLoading ? (
          <LoadingState message="Đang tải danh sách..." />
        ) : shoppingQuery.isError ? (
          <ErrorState
            message={getErrorMessage(shoppingQuery.error)}
            onRetry={() => void shoppingQuery.refetch()}
          />
        ) : !list ? (
          <EmptyState
            title="Không tìm thấy danh sách"
            message="Danh sách có thể đã bị xoá hoặc bạn không còn quyền xem."
            icon="cart-outline"
            action={
              <AppButton
                title="Quay lại"
                onPress={() => router.back()}
                variant="outline"
              />
            }
          />
        ) : (
          <>
            <SectionCard>
              <View style={styles.progressHeader}>
                <Text style={styles.progressValue}>
                  {done}/{total} món
                </Text>
                <Text style={styles.progressPercent}>
                  {total > 0 ? `${Math.round((done / total) * 100)}%` : '0%'}
                </Text>
              </View>
              <ProgressBar value={done} total={total} />

              <View style={styles.metaBlock}>
                <Text style={styles.metaLabel}>Ngày đi chợ</Text>
                <Text style={styles.metaValue}>
                  {list.date ? formatDate(list.date) : 'Chưa đặt ngày'}
                </Text>
              </View>

              {list.note ? (
                <View style={styles.metaBlock}>
                  <Text style={styles.metaLabel}>Ghi chú</Text>
                  <Text style={styles.metaValue}>{list.note}</Text>
                </View>
              ) : null}
            </SectionCard>

            <SectionCard title="Các món cần mua">
              {tasks.length === 0 ? (
                <Text style={styles.empty}>Chưa có món nào trong danh sách.</Text>
              ) : (
                tasks.map((task, index) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    last={index === tasks.length - 1}
                    isAdmin={isAdmin}
                    deleting={deletingTaskId === task.id}
                    onToggle={() =>
                      toggleTask.mutate({
                        taskId: task.id,
                        isCompleted: !task.isCompleted,
                      })
                    }
                    onEdit={() => openEdit(task)}
                    onDelete={() => confirmRemoveTask(task)}
                  />
                ))
              )}

              {isAdmin ? (
                <AppButton
                  title="Thêm món"
                  onPress={openAdd}
                  variant="outline"
                  style={styles.addTask}
                />
              ) : null}
            </SectionCard>

            {isAdmin ? (
              <AppButton
                title="Xoá danh sách"
                onPress={confirmRemoveList}
                variant="outline"
              />
            ) : null}
          </>
        )}
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
                {editingTask ? 'Sửa món' : 'Thêm món cần mua'}
              </Text>
              <Text style={styles.modalHint}>
                Chọn thực phẩm có sẵn trong kho của nhóm.
              </Text>

              {foodsQuery.isLoading ? (
                <FormMessage type="info" message="Đang tải kho thực phẩm..." />
              ) : foodOptions.length === 0 ? (
                <FormMessage
                  type="info"
                  message="Kho thực phẩm đang trống. Thêm thực phẩm trước khi lập danh sách."
                />
              ) : null}

              <SelectField
                label="Thực phẩm"
                value={foodName}
                placeholder="Chọn thực phẩm"
                options={foodOptions}
                onChange={setFoodName}
              />

              <AppInput
                label="Số lượng"
                value={quantity}
                onChangeText={setQuantity}
                placeholder="Ví dụ: 2"
                keyboardType="decimal-pad"
                maxLength={10}
              />

              {editorError ? (
                <FormMessage type="error" message={editorError} />
              ) : null}

              <AppButton
                title="Lưu"
                onPress={saveTask}
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

function TaskRow({
  task,
  last,
  isAdmin,
  deleting,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: ShoppingTask;
  last: boolean;
  isAdmin: boolean;
  deleting: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.taskRow, !last && styles.taskDivider]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.isCompleted }}
        hitSlop={8}
      >
        <Ionicons
          name={task.isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={task.isCompleted ? colors.success : colors.textMuted}
        />
      </Pressable>

      <View style={styles.taskBody}>
        <Text
          style={[styles.taskName, task.isCompleted && styles.taskDone]}
          numberOfLines={2}
        >
          {task.foodName ?? 'Không xác định'}
        </Text>
        <Text style={styles.taskMeta}>
          {task.quantity} {task.unitName ?? ''}
        </Text>
      </View>

      {isAdmin ? (
        <View style={styles.taskActions}>
          <LinkText onPress={onEdit}>Sửa</LinkText>
          <LinkText onPress={onDelete}>
            {deleting ? 'Đang xoá...' : 'Xoá'}
          </LinkText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  progressValue: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  progressPercent: {
    ...typography.bodyStrong,
    color: colors.primaryText,
  },
  metaBlock: {
    marginTop: spacing.md,
  },
  metaLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  metaValue: {
    ...typography.body,
    color: colors.text,
    marginTop: 2,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  taskDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  taskBody: {
    flex: 1,
  },
  taskName: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  taskDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  taskMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  taskActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  addTask: {
    marginTop: spacing.md,
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
  modalCancel: {
    marginTop: spacing.md,
  },
});
