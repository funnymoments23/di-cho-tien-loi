import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
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
import { groupApi } from '@/api/group.api';
import { qk } from '@/api/queryKeys';
import { shoppingApi } from '@/api/shopping.api';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { DateField } from '@/components/ui/DateField';
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
import { StatTile } from '@/components/ui/StatTile';
import { useToggleShoppingTask } from '@/hooks/useToggleShoppingTask';
import { useAuthStore } from '@/store/authStore';
import { colors, radius, spacing, typography } from '@/theme';
import { formatDate } from '@/utils/date';
import { getErrorMessage } from '@/utils/error';
import type { ShoppingList, ShoppingTask } from '@/types/models';

const toUtcIso = (date: Date) =>
  new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  ).toISOString();

export default function ShoppingScreen() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const toggleTask = useToggleShoppingTask();

  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ShoppingList | null>(null);
  const [name, setName] = useState('');
  const [assignee, setAssignee] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [editorError, setEditorError] = useState('');
  const [saving, setSaving] = useState(false);

  const shoppingQuery = useQuery({
    queryKey: qk.shopping,
    queryFn: shoppingApi.lists,
  });
  const groupQuery = useQuery({
    queryKey: qk.group,
    queryFn: groupApi.detail,
    retry: false,
  });

  const lists = shoppingQuery.data ?? [];
  const group = groupQuery.data;
  const isAdmin = Boolean(group && user && group.adminId === user.id);

  const memberOptions = (group?.members ?? [])
    .filter((member) => member.username)
    .map((member) => ({
      id: member.id,
      name: member.username as string,
      label: `${member.name} (@${member.username})`,
    }));

  const allTasks = lists.flatMap((list) => list.tasks ?? []);
  const completed = allTasks.filter((task) => task.isCompleted).length;
  const pending = allTasks.length - completed;

  const refreshShopping = () => {
    void queryClient.invalidateQueries({ queryKey: qk.shopping });
    void queryClient.invalidateQueries({ queryKey: qk.report('overview') });
  };

  const openCreate = () => {
    setEditing(null);
    setName('');
    setAssignee(memberOptions[0]?.name ?? '');
    setNote('');
    setDate(new Date());
    setEditorError('');
    setEditorOpen(true);
  };

  const openEdit = (list: ShoppingList) => {
    setEditing(list);
    setName(list.name);
    setAssignee(list.assignedToUsername ?? '');
    setNote(list.note ?? '');
    const parsed = list.date ? new Date(list.date) : new Date();
    setDate(Number.isNaN(parsed.getTime()) ? new Date() : parsed);
    setEditorError('');
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
  };

  const saveList = async () => {
    setEditorError('');
    const trimmedName = name.trim();

    if (!trimmedName) {
      setEditorError('Vui lòng nhập tên danh sách.');
      return;
    }
    if (!assignee) {
      setEditorError('Vui lòng chọn người được giao.');
      return;
    }

    const payloadDate = toUtcIso(date);

    if (editing) {
      const payload: Parameters<typeof shoppingApi.updateList>[0] = {
        listId: editing.id,
      };
      let changed = false;

      if (trimmedName !== editing.name) {
        payload.newName = trimmedName;
        changed = true;
      }
      if (assignee !== (editing.assignedToUsername ?? '')) {
        payload.newAssignToUsername = assignee;
        changed = true;
      }
      if (note.trim() !== (editing.note ?? '')) {
        payload.newNote = note.trim();
        changed = true;
      }
      if (
        !editing.date ||
        formatDate(date) !== formatDate(editing.date)
      ) {
        payload.newDate = payloadDate;
        changed = true;
      }

      if (!changed) {
        setEditorError('Chưa có thay đổi nào.');
        return;
      }

      setSaving(true);
      try {
        await shoppingApi.updateList(payload);
        setEditorOpen(false);
        setNotice(`Đã cập nhật "${trimmedName}".`);
        refreshShopping();
      } catch (err) {
        setEditorError(getErrorMessage(err));
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    try {
      const created = await shoppingApi.createList({
        name: trimmedName,
        assignToUsername: assignee,
        ...(note.trim() ? { note: note.trim() } : {}),
        date: payloadDate,
      });
      setEditorOpen(false);
      refreshShopping();
      // Danh sách và các món là 2 API riêng: tạo xong mở ngay màn chi tiết
      // và bật form thêm món để không phải tìm lại danh sách.
      router.push({
        pathname: '/shopping/[listId]',
        params: { listId: created.id, openAdd: '1' },
      });
    } catch (err) {
      setEditorError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const removeList = async (list: ShoppingList) => {
    setError('');
    setNotice('');
    setDeletingId(list.id);
    try {
      await shoppingApi.deleteList(list.id);
      setNotice(`Đã xoá danh sách "${list.name}".`);
      refreshShopping();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const confirmRemove = (list: ShoppingList) => {
    Alert.alert(
      'Xoá danh sách',
      `Xoá "${list.name}" và toàn bộ món bên trong?`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: () => void removeList(list),
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
          boxed
          title="Đi chợ"
          subtitle={
            lists.length > 0
              ? `${lists.length} danh sách · ${pending} món cần mua`
              : 'Danh sách mua sắm của gia đình'
          }
        />

        {notice ? <FormMessage type="success" message={notice} /> : null}
        {error ? <FormMessage type="error" message={error} /> : null}

        {shoppingQuery.isLoading ? (
          <LoadingState message="Đang tải danh sách đi chợ..." />
        ) : shoppingQuery.isError ? (
          <ErrorState
            message={getErrorMessage(shoppingQuery.error)}
            onRetry={() => void shoppingQuery.refetch()}
          />
        ) : lists.length === 0 ? (
          <EmptyState
            title="Chưa có danh sách nào"
            message={
              isAdmin
                ? 'Tạo danh sách, phân công người đi chợ và thêm các món cần mua.'
                : 'Trưởng nhóm chưa tạo danh sách mua sắm nào.'
            }
            icon="cart-outline"
            action={
              isAdmin ? (
                <AppButton
                  title="Tạo danh sách"
                  onPress={openCreate}
                  variant="outline"
                />
              ) : undefined
            }
          />
        ) : (
          <>
            <View style={styles.statsRow}>
              <StatTile label="Danh sách" value={lists.length} tone="primary" />
              <StatTile label="Cần mua" value={pending} tone="warning" />
              <StatTile label="Đã mua" value={completed} tone="success" />
            </View>

            {isAdmin ? (
              <AppButton
                title="Tạo danh sách mua sắm"
                onPress={openCreate}
                variant="outline"
                style={styles.createButton}
              />
            ) : null}

            {lists.map((list) => (
              <ShoppingCard
                key={list.id}
                list={list}
                isAdmin={isAdmin}
                deleting={deletingId === list.id}
                onOpen={() =>
                  router.push({
                    pathname: '/shopping/[listId]',
                    params: { listId: list.id },
                  })
                }
                onEdit={() => openEdit(list)}
                onDelete={() => confirmRemove(list)}
                onToggle={(task) =>
                  toggleTask.mutate({
                    taskId: task.id,
                    isCompleted: !task.isCompleted,
                  })
                }
              />
            ))}
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
                {editing ? 'Sửa danh sách' : 'Tạo danh sách mua sắm'}
              </Text>
              <Text style={styles.modalHint}>
                Chỉ trưởng nhóm mới tạo, sửa hoặc xoá danh sách. Sau khi tạo,
                bạn sẽ được chuyển đến chi tiết để thêm món.
              </Text>

              {groupQuery.isLoading ? (
                <FormMessage type="info" message="Đang tải thành viên..." />
              ) : memberOptions.length === 0 ? (
                <FormMessage
                  type="info"
                  message="Chưa có thành viên nào có username để phân công."
                />
              ) : null}

              <AppInput
                label="Tên danh sách"
                value={name}
                onChangeText={setName}
                placeholder="Ví dụ: Đi chợ cuối tuần"
                maxLength={100}
                returnKeyType="next"
              />

              <SelectField
                label="Giao cho"
                value={assignee}
                placeholder="Chọn thành viên"
                options={memberOptions}
                onChange={setAssignee}
              />

              <DateField
                label="Ngày đi chợ"
                value={date}
                onChange={setDate}
              />

              <AppInput
                label="Ghi chú"
                value={note}
                onChangeText={setNote}
                placeholder="Ví dụ: mua ở chợ đầu mối"
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
                onPress={saveList}
                loading={saving}
                disabled={!name.trim() || !assignee}
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

function ShoppingCard({
  list,
  isAdmin,
  deleting,
  onOpen,
  onEdit,
  onDelete,
  onToggle,
}: {
  list: ShoppingList;
  isAdmin: boolean;
  deleting: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (task: ShoppingTask) => void;
}) {
  const tasks = list.tasks ?? [];
  const [expanded, setExpanded] = useState(false);
  const total = list.taskCount ?? tasks.length;
  const done =
    list.completedCount ?? tasks.filter((task) => task.isCompleted).length;
  const remaining = total - done;
  const visible = expanded ? tasks : tasks.slice(0, 4);
  const isDone = total > 0 && done === total;

  return (
    <SectionCard>
      <View style={styles.listHeader}>
        <View style={styles.listTitleBlock}>
          <Text style={styles.listName}>{list.name}</Text>
          <Text style={styles.listMeta} numberOfLines={1}>
            Giao cho{' '}
            {list.assignedToName ??
              list.assignedToUsername ??
              'chưa phân công'}
          </Text>
        </View>
        <View
          style={[
            styles.countBadge,
            {
              backgroundColor: isDone ? colors.successSoft : colors.primarySoft,
            },
          ]}
        >
          <Text
            style={[
              styles.countText,
              { color: isDone ? colors.success : colors.primaryText },
            ]}
          >
            {done}/{total}
          </Text>
        </View>
      </View>

      <ProgressBar value={done} total={total} />

      <View style={styles.taskPreview}>
        {visible.length === 0 ? (
          <Text style={styles.emptyTasks}>Chưa có món nào trong danh sách.</Text>
        ) : (
          visible.map((task) => (
            <TaskPreview
              key={task.id}
              task={task}
              onToggle={() => onToggle(task)}
            />
          ))
        )}
        {tasks.length > 4 ? (
          <LinkText onPress={() => setExpanded((value) => !value)}>
            {expanded ? 'Thu gọn' : `Xem thêm ${tasks.length - 4} món`}
          </LinkText>
        ) : null}
      </View>

      {list.note ? <Text style={styles.note}>{list.note}</Text> : null}

      <View style={styles.listFooter}>
        <Text style={styles.footerText}>
          {list.date ? formatDate(list.date) : 'Chưa đặt ngày'}
        </Text>
        <Text style={styles.footerText}>
          {remaining > 0 ? `Còn ${remaining} món` : 'Đã mua xong'}
        </Text>
      </View>

      <View style={styles.cardActions}>
        <LinkText onPress={onOpen}>Chi tiết</LinkText>
        {isAdmin ? (
          <View style={styles.adminActions}>
            <LinkText onPress={onEdit}>Sửa</LinkText>
            <LinkText onPress={onDelete}>
              {deleting ? 'Đang xoá...' : 'Xoá'}
            </LinkText>
          </View>
        ) : null}
      </View>
    </SectionCard>
  );
}

function TaskPreview({
  task,
  onToggle,
}: {
  task: ShoppingTask;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: task.isCompleted }}
      style={({ pressed }) => [styles.taskRow, pressed && styles.taskPressed]}
    >
      <Ionicons
        name={task.isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
        size={18}
        color={task.isCompleted ? colors.success : colors.textMuted}
      />
      <Text
        style={[styles.taskName, task.isCompleted && styles.taskDone]}
        numberOfLines={1}
      >
        {task.foodName ?? 'Không xác định'}
      </Text>
      <Text style={styles.taskQuantity}>
        {task.quantity} {task.unitName ?? ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  createButton: {
    marginBottom: spacing.lg,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  listTitleBlock: {
    flex: 1,
  },
  listName: {
    ...typography.heading,
    color: colors.text,
  },
  listMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  countBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  countText: {
    ...typography.label,
  },
  taskPreview: {
    marginTop: spacing.md,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  taskPressed: {
    opacity: 0.6,
  },
  taskName: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  taskDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  taskQuantity: {
    ...typography.caption,
    color: colors.textMuted,
  },
  emptyTasks: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  note: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  listFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerText: {
    ...typography.label,
    color: colors.textMuted,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  adminActions: {
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
