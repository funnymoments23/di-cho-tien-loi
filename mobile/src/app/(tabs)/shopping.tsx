import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { request } from '@/api/client';
import { qk } from '@/api/queryKeys';
import { tabsApi } from '@/api/tabs.api';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/ui/StateView';
import { LinkText } from '@/components/ui/LinkText';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatTile } from '@/components/ui/StatTile';
import { colors, radius, spacing, typography } from '@/theme';
import { formatDate } from '@/utils/date';
import { getErrorMessage } from '@/utils/error';
import type { ShoppingList, ShoppingTask } from '@/types/models';

export default function ShoppingScreen() {
  const queryClient = useQueryClient();
  const shoppingQuery = useQuery({
    queryKey: qk.shopping,
    queryFn: tabsApi.shoppingLists,
  });

  const toggleTask = useMutation({
    mutationFn: ({
      taskId,
      isCompleted,
    }: {
      taskId: string;
      isCompleted: boolean;
    }) =>
      request({
        method: 'PATCH',
        url: `/shopping/task/${taskId}/complete`,
        data: { isCompleted },
      }),
    onMutate: async ({ taskId, isCompleted }) => {
      await queryClient.cancelQueries({ queryKey: qk.shopping });
      const previous = queryClient.getQueryData<ShoppingList[]>(qk.shopping);

      queryClient.setQueryData<ShoppingList[]>(qk.shopping, (old) =>
        old?.map((list) => {
          if (!list.tasks?.some((task) => task.id === taskId)) return list;
          const tasks = list.tasks.map((task) =>
            task.id === taskId ? { ...task, isCompleted } : task
          );
          return {
            ...list,
            tasks,
            completedCount: tasks.filter((task) => task.isCompleted).length,
          };
        })
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(qk.shopping, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.shopping });
      void queryClient.invalidateQueries({ queryKey: qk.report('overview') });
    },
  });

  const lists = shoppingQuery.data ?? [];
  const allTasks = lists.flatMap((list) => list.tasks ?? []);
  const completed = allTasks.filter((task) => task.isCompleted).length;
  const pending = allTasks.length - completed;

  return (
    <Screen
      refreshing={shoppingQuery.isRefetching}
      onRefresh={() => void shoppingQuery.refetch()}
    >
      <ScreenHeader
        title="Đi chợ"
        subtitle={
          lists.length > 0
            ? `${lists.length} danh sách · ${pending} món cần mua`
            : 'Danh sách mua sắm của gia đình'
        }
      />

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
          message="Trưởng nhóm có thể tạo danh sách, phân công người đi chợ và thêm các món cần mua."
          icon="cart-outline"
        />
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatTile label="Danh sách" value={lists.length} tone="primary" />
            <StatTile label="Cần mua" value={pending} tone="warning" />
            <StatTile label="Đã mua" value={completed} tone="success" />
          </View>

          {lists.map((list) => (
            <ShoppingCard
              key={list.id}
              list={list}
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
  );
}

function ShoppingCard({
  list,
  onToggle,
}: {
  list: ShoppingList;
  onToggle: (task: ShoppingTask) => void;
}) {
  const tasks = list.tasks ?? [];
  const [expanded, setExpanded] = useState(false);
  const total = list.taskCount ?? tasks.length;
  const done = list.completedCount ?? tasks.filter((task) => task.isCompleted).length;
  const remaining = total - done;
  const visible = expanded ? tasks : tasks.slice(0, 4);
  const isDone = total > 0 && done === total;

  return (
    <SectionCard>
      <View style={styles.listHeader}>
        <View style={styles.listTitleBlock}>
          <Text style={styles.listName}>{list.name}</Text>
          <Text style={styles.listMeta} numberOfLines={1}>
            Giao cho {list.assignedToName ?? list.assignedToUsername ?? 'chưa phân công'}
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
});
