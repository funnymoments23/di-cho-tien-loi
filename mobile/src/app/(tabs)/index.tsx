import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@/api/client';
import { qk } from '@/api/queryKeys';
import { tabsApi } from '@/api/tabs.api';
import { AppButton } from '@/components/ui/AppButton';
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
import { Thumbnail } from '@/components/ui/Thumbnail';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, typography } from '@/theme';
import { formatMealDate, todayKey } from '@/utils/date';
import { getErrorMessage } from '@/utils/error';
import type { MealPlan } from '@/types/models';

const mealNames = ['sáng', 'trưa', 'tối'] as const;

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const today = todayKey();

  const reportQuery = useQuery({
    queryKey: qk.report('overview'),
    queryFn: tabsApi.reportOverview,
  });
  const shoppingQuery = useQuery({
    queryKey: qk.shopping,
    queryFn: tabsApi.shoppingLists,
  });
  const mealsQuery = useQuery({
    queryKey: qk.meals(today),
    queryFn: () => tabsApi.meals(today),
  });

  const refreshing =
    reportQuery.isRefetching ||
    shoppingQuery.isRefetching ||
    mealsQuery.isRefetching;

  const refresh = () => {
    void Promise.all([
      reportQuery.refetch(),
      shoppingQuery.refetch(),
      mealsQuery.refetch(),
    ]);
  };

  const noGroup =
    reportQuery.error instanceof ApiError &&
    (reportQuery.error.code === '00385' || reportQuery.error.code === '00096');

  const fridge = reportQuery.data?.fridge ?? {
    totalItems: 0,
    totalQuantity: 0,
    expiringSoon: 0,
    expired: 0,
  };
  const lists = shoppingQuery.data ?? [];
  const totalTasks = lists.reduce(
    (sum, list) => sum + (list.taskCount ?? list.tasks?.length ?? 0),
    0
  );
  const completedTasks = lists.reduce(
    (sum, list) =>
      sum +
      (list.completedCount ??
        list.tasks?.filter((task) => task.isCompleted).length ??
        0),
    0
  );
  const meals = mealsQuery.data ?? [];

  const mealItems = (name: (typeof mealNames)[number]) =>
    meals.filter((meal) => meal.name === name);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader
        title={`Xin chào, ${user?.name ?? 'bạn'}`}
        subtitle={formatMealDate(new Date())}
        right={
          <Thumbnail
            uri={user?.avatar}
            label={user?.name ?? '?'}
            size={44}
          />
        }
      />

      {reportQuery.isLoading ? (
        <LoadingState message="Đang tổng hợp dữ liệu hôm nay..." />
      ) : noGroup ? (
        <EmptyState
          title="Bạn chưa tham gia nhóm"
          message="Tạo nhóm hoặc nhờ trưởng nhóm thêm bạn để bắt đầu chia sẻ tủ lạnh và danh sách đi chợ."
          icon="people-outline"
          action={
            <AppButton
              title="Mở Cá nhân"
              onPress={() => router.navigate('/(tabs)/profile')}
              variant="outline"
            />
          }
        />
      ) : reportQuery.isError ? (
        <ErrorState
          message={getErrorMessage(reportQuery.error)}
          onRetry={() => void reportQuery.refetch()}
        />
      ) : (
        <>
          <SectionCard
            title="Tủ lạnh hôm nay"
            action={
              <LinkText onPress={() => router.navigate('/(tabs)/fridge')}>
                Xem tất cả
              </LinkText>
            }
          >
            <View style={styles.statsRow}>
              <StatTile label="Tổng món" value={fridge.totalItems} tone="primary" />
              <StatTile
                label="Sắp hết hạn"
                value={fridge.expiringSoon}
                tone="warning"
              />
              <StatTile label="Đã hết hạn" value={fridge.expired} tone="danger" />
            </View>
            <Text style={styles.cardHint}>
              {fridge.expiringSoon > 0
                ? `${fridge.expiringSoon} món cần dùng sớm để tránh lãng phí.`
                : 'Không có món nào sắp hết hạn.'}
            </Text>
          </SectionCard>

          <SectionCard
            title="Việc cần mua"
            action={
              <LinkText onPress={() => router.navigate('/(tabs)/shopping')}>
                Mở danh sách
              </LinkText>
            }
          >
            {shoppingQuery.isLoading ? (
              <Text style={styles.cardHint}>Đang tải danh sách...</Text>
            ) : shoppingQuery.isError ? (
              <Text style={styles.cardHint}>
                {getErrorMessage(shoppingQuery.error)}
              </Text>
            ) : totalTasks === 0 ? (
              <Text style={styles.cardHint}>
                Chưa có món nào trong danh sách đi chợ.
              </Text>
            ) : (
              <>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressValue}>
                    {completedTasks}/{totalTasks} món
                  </Text>
                  <Text style={styles.progressPercent}>
                    {Math.round((completedTasks / totalTasks) * 100)}%
                  </Text>
                </View>
                <ProgressBar value={completedTasks} total={totalTasks} />
                <Text style={styles.cardHint}>
                  {completedTasks === totalTasks
                    ? 'Đã mua xong toàn bộ danh sách.'
                    : `Còn ${totalTasks - completedTasks} món cần mua trong ${lists.length} danh sách.`}
                </Text>
              </>
            )}
          </SectionCard>

          <SectionCard
            title="Bữa ăn hôm nay"
            action={
              <LinkText onPress={() => router.navigate('/(tabs)/meal')}>
                Xem lịch
              </LinkText>
            }
          >
            {mealsQuery.isLoading ? (
              <Text style={styles.cardHint}>Đang tải lịch bữa ăn...</Text>
            ) : mealsQuery.isError ? (
              <Text style={styles.cardHint}>
                {getErrorMessage(mealsQuery.error)}
              </Text>
            ) : (
              mealNames.map((name) => (
                <MealRow key={name} label={name} items={mealItems(name)} />
              ))
            )}
          </SectionCard>

          <SectionCard title="Mẹo nhỏ">
            <Text style={styles.tip}>
              Đặt món sắp hết hạn lên đầu tủ lạnh để dễ thấy. Khi nấu xong, nhớ
              xoá món khỏi tủ để báo cáo tiêu thụ chính xác.
            </Text>
          </SectionCard>
        </>
      )}
    </Screen>
  );
}

function MealRow({ label, items }: { label: string; items: MealPlan[] }) {
  return (
    <View style={styles.mealRow}>
      <Text style={styles.mealLabel}>{label}</Text>
      <View style={styles.mealItems}>
        {items.length === 0 ? (
          <Text style={styles.mealEmpty}>Chưa có món</Text>
        ) : (
          items.map((item) => (
            <Text key={item.id} style={styles.mealItem}>
              • {item.foodName ?? '—'}
            </Text>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cardHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
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
  mealRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  mealLabel: {
    ...typography.label,
    color: colors.textMuted,
    width: 42,
    textTransform: 'capitalize',
  },
  mealItems: {
    flex: 1,
  },
  mealItem: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  mealEmpty: {
    ...typography.body,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  tip: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
});
