import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import dayjs from 'dayjs';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@/api/client';
import { qk } from '@/api/queryKeys';
import { reportApi } from '@/api/report.api';
import { AppButton } from '@/components/ui/AppButton';
import { BarChart } from '@/components/ui/BarChart';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatTile } from '@/components/ui/StatTile';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/ui/StateView';
import { colors, radius, spacing, typography } from '@/theme';
import { DATE_KEY, expiryLabel, formatDate, todayKey } from '@/utils/date';
import { getErrorMessage } from '@/utils/error';
import type {
  ReportEventSeriesPoint,
  ReportRangeFilter,
  ReportShoppingSeriesPoint,
} from '@/types/models';

type TabKey = 'shopping' | 'consumption' | 'waste' | 'fridge';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'shopping', label: 'Mua sắm' },
  { key: 'consumption', label: 'Tiêu thụ' },
  { key: 'waste', label: 'Lãng phí' },
  { key: 'fridge', label: 'Tủ lạnh' },
];

const PRESETS = [7, 30, 90];

const reasonLabels: Record<string, string> = {
  expired: 'Hết hạn',
  discarded: 'Bỏ đi',
  consumed: 'Đã dùng',
};

const percent = (rate: number) => `${Math.round(rate * 100)}%`;

const shoppingChart = (
  series: ReportShoppingSeriesPoint[]
): { key: string; label: string; value: number; secondaryValue: number }[] =>
  series.map((point) => ({
    key: point.date,
    label: formatDate(point.date, 'DD/MM'),
    value: point.itemsCreated,
    secondaryValue: point.itemsCompleted,
  }));

const eventChart = (
  series: ReportEventSeriesPoint[]
): { key: string; label: string; value: number }[] =>
  series.map((point) => ({
    key: point.date,
    label: formatDate(point.date, 'DD/MM'),
    value: point.quantity,
  }));

export default function ReportsScreen() {
  const [preset, setPreset] = useState(30);
  const [tab, setTab] = useState<TabKey>('shopping');

  const range = useMemo<ReportRangeFilter>(
    () => ({
      from: dayjs().subtract(preset - 1, 'day').format(DATE_KEY),
      to: todayKey(),
    }),
    [preset]
  );

  const overviewQuery = useQuery({
    queryKey: qk.report('overview', range),
    queryFn: () => reportApi.overview(range),
  });
  const shoppingQuery = useQuery({
    queryKey: qk.report('shopping', range),
    queryFn: () => reportApi.shopping(range),
    enabled: tab === 'shopping',
  });
  const consumptionQuery = useQuery({
    queryKey: qk.report('consumption', range),
    queryFn: () => reportApi.consumption(range),
    enabled: tab === 'consumption',
  });
  const wasteQuery = useQuery({
    queryKey: qk.report('waste', range),
    queryFn: () => reportApi.waste(range),
    enabled: tab === 'waste',
  });
  const fridgeQuery = useQuery({
    queryKey: qk.report('fridge'),
    queryFn: reportApi.fridge,
    enabled: tab === 'fridge',
  });

  const activeQuery =
    tab === 'shopping'
      ? shoppingQuery
      : tab === 'consumption'
        ? consumptionQuery
        : tab === 'waste'
          ? wasteQuery
          : fridgeQuery;

  const refreshing =
    overviewQuery.isRefetching || activeQuery.isRefetching;
  const labelEvery = preset <= 7 ? 1 : preset <= 30 ? 7 : 15;

  const noGroup =
    overviewQuery.error instanceof ApiError &&
    (overviewQuery.error.code === '00385' || overviewQuery.error.code === '00096');

  const overview = overviewQuery.data;
  const totalHandled =
    (wasteQuery.data?.summary.quantity ?? 0) +
    (wasteQuery.data?.summary.consumedQuantity ?? 0);

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        void overviewQuery.refetch();
        void activeQuery.refetch();
      }}
    >
      <ScreenHeader
        title="Báo cáo"
        subtitle={
          overview
            ? `${formatDate(overview.range.from)} – ${formatDate(overview.range.to)}`
            : 'Mua sắm, tiêu thụ và lãng phí'
        }
        onBack={() => router.back()}
      />

      <View style={styles.presetRow}>
        {PRESETS.map((days) => {
          const active = preset === days;
          return (
            <Pressable
              key={days}
              onPress={() => setPreset(days)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.preset, active && styles.presetActive]}
            >
              <Text
                style={[styles.presetText, active && styles.presetTextActive]}
              >
                {days} ngày
              </Text>
            </Pressable>
          );
        })}
      </View>

      {overviewQuery.isLoading ? (
        <LoadingState message="Đang tổng hợp báo cáo..." />
      ) : noGroup ? (
        <EmptyState
          title="Bạn chưa tham gia nhóm"
          message="Tạo nhóm hoặc nhờ trưởng nhóm thêm bạn để xem báo cáo chung."
          icon="people-outline"
          action={
            <AppButton
              title="Thiết lập nhóm"
              onPress={() => router.push('/group/setup')}
              variant="outline"
            />
          }
        />
      ) : overviewQuery.isError ? (
        <ErrorState
          message={getErrorMessage(overviewQuery.error)}
          onRetry={() => void overviewQuery.refetch()}
        />
      ) : overview ? (
        <>
          <SectionCard title="Tổng quan">
            <View style={styles.statsRow}>
              <StatTile
                label="Món cần mua"
                value={overview.shopping.items}
                tone="primary"
              />
              <StatTile
                label="Đã mua"
                value={overview.shopping.completedItems}
                tone="success"
              />
            </View>
            <View style={styles.statsRow}>
              <StatTile
                label="Đã tiêu thụ"
                value={overview.consumption.items}
                tone="accent"
              />
              <StatTile
                label="Tỉ lệ lãng phí"
                value={percent(overview.waste.wasteRate)}
                tone="warning"
              />
            </View>
            <Text style={styles.cardHint}>
              Tủ lạnh hiện có {overview.fridge.totalItems} món, trong đó{' '}
              {overview.fridge.expiringSoon} món sắp hết hạn và{' '}
              {overview.fridge.expired} món đã hết hạn.
            </Text>
          </SectionCard>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRow}
          >
            {TABS.map((item) => {
              const active = tab === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setTab(item.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {activeQuery.isLoading ? (
            <LoadingState message="Đang tải báo cáo..." />
          ) : activeQuery.isError ? (
            <ErrorState
              message={getErrorMessage(activeQuery.error)}
              onRetry={() => void activeQuery.refetch()}
            />
          ) : tab === 'shopping' && shoppingQuery.data ? (
            <>
              <SectionCard title="Mua sắm">
                <View style={styles.statsRow}>
                  <StatTile
                    label="Danh sách"
                    value={shoppingQuery.data.summary.lists}
                    tone="primary"
                  />
                  <StatTile
                    label="Món cần mua"
                    value={shoppingQuery.data.summary.items}
                    tone="warning"
                  />
                  <StatTile
                    label="Hoàn thành"
                    value={percent(shoppingQuery.data.summary.completionRate)}
                    tone="success"
                  />
                </View>
                <Text style={styles.cardHint}>
                  {shoppingQuery.data.summary.completedItems} món đã được tick
                  trong kỳ, gồm cả món tạo từ trước.
                </Text>
              </SectionCard>

              <SectionCard title="Món theo ngày">
                <BarChart
                  data={shoppingChart(shoppingQuery.data.series)}
                  labelEvery={labelEvery}
                  legend={[
                    { color: colors.primary, label: 'Cần mua' },
                    { color: colors.accent, label: 'Đã mua' },
                  ]}
                />
              </SectionCard>

              <BreakdownCard
                title="Theo danh mục"
                emptyText="Chưa có món nào trong khoảng này."
                rows={shoppingQuery.data.byCategory.map((item) => ({
                  key: item.category,
                  label: item.category,
                  detail: `${item.completedItems}/${item.items} món đã mua`,
                  value: `${item.items} món`,
                }))}
              />

              <BreakdownCard
                title="Theo người được giao"
                emptyText="Chưa có danh sách nào được giao."
                rows={shoppingQuery.data.byAssignee.map((item) => ({
                  key: item.userId ?? 'unassigned',
                  label: item.name ?? 'Chưa giao',
                  detail: `${item.lists} danh sách · ${item.completedItems}/${item.items} món đã mua`,
                  value: `${item.items} món`,
                }))}
              />
            </>
          ) : tab === 'consumption' && consumptionQuery.data ? (
            <>
              <SectionCard title="Tiêu thụ">
                <View style={styles.statsRow}>
                  <StatTile
                    label="Lượt dùng hết"
                    value={consumptionQuery.data.summary.items}
                    tone="success"
                  />
                  <StatTile
                    label="Tổng số lượng"
                    value={consumptionQuery.data.summary.quantity}
                    tone="accent"
                  />
                </View>
                <Text style={styles.cardHint}>
                  Thực phẩm được dùng hết trước khi hết hạn.
                </Text>
              </SectionCard>

              <SectionCard title="Số lượng theo ngày">
                <BarChart
                  data={eventChart(consumptionQuery.data.series)}
                  color={colors.success}
                  labelEvery={labelEvery}
                />
              </SectionCard>

              <BreakdownCard
                title="Thực phẩm đã dùng"
                emptyText="Chưa có thực phẩm nào được dùng hết trong khoảng này."
                rows={consumptionQuery.data.byFood.slice(0, 10).map((item) => ({
                  key: item.name,
                  label: item.name,
                  detail: `${item.items} lần`,
                  value: `${item.quantity}${item.unitName ? ` ${item.unitName}` : ''}`,
                }))}
              />

              <BreakdownCard
                title="Theo danh mục"
                emptyText="Chưa có dữ liệu theo danh mục."
                rows={consumptionQuery.data.byCategory.map((item) => ({
                  key: item.name,
                  label: item.name,
                  detail: `${item.items} lần`,
                  value: `${item.quantity}`,
                }))}
              />
            </>
          ) : tab === 'waste' && wasteQuery.data ? (
            <>
              <SectionCard title="Lãng phí">
                <View style={styles.statsRow}>
                  <StatTile
                    label="Lượt bỏ"
                    value={wasteQuery.data.summary.items}
                    tone="danger"
                  />
                  <StatTile
                    label="Số lượng"
                    value={wasteQuery.data.summary.quantity}
                    tone="warning"
                  />
                  <StatTile
                    label="Tỉ lệ"
                    value={percent(wasteQuery.data.summary.wasteRate)}
                    tone="danger"
                  />
                </View>
                <View style={styles.rateBlock}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>Đã tiêu thụ</Text>
                    <Text style={styles.progressValue}>
                      {wasteQuery.data.summary.consumedQuantity} /{' '}
                      {totalHandled}
                    </Text>
                  </View>
                  <ProgressBar
                    value={wasteQuery.data.summary.consumedQuantity}
                    total={totalHandled}
                  />
                </View>
                <Text style={styles.cardHint}>
                  Tỉ lệ lãng phí = số lượng bỏ đi / tổng số lượng đã xử lý.
                </Text>
              </SectionCard>

              <SectionCard title="Số lượng theo ngày">
                <BarChart
                  data={eventChart(wasteQuery.data.series)}
                  color={colors.danger}
                  labelEvery={labelEvery}
                />
              </SectionCard>

              <BreakdownCard
                title="Theo lý do"
                emptyText="Không có thực phẩm nào bị bỏ trong khoảng này."
                rows={wasteQuery.data.byReason.map((item) => ({
                  key: item.name,
                  label: reasonLabels[item.name] ?? item.name,
                  detail: `${item.items} lượt`,
                  value: `${item.quantity}`,
                }))}
              />

              <BreakdownCard
                title="Thực phẩm bị bỏ"
                emptyText="Không có thực phẩm nào bị bỏ."
                rows={wasteQuery.data.byFood.slice(0, 10).map((item) => ({
                  key: item.name,
                  label: item.name,
                  detail: `${item.items} lượt`,
                  value: `${item.quantity}${item.unitName ? ` ${item.unitName}` : ''}`,
                }))}
              />
            </>
          ) : tab === 'fridge' && fridgeQuery.data ? (
            <>
              <SectionCard title="Tủ lạnh hiện tại">
                <View style={styles.statsRow}>
                  <StatTile
                    label="Tổng món"
                    value={fridgeQuery.data.summary.totalItems}
                    tone="primary"
                  />
                  <StatTile
                    label="Sắp hết hạn"
                    value={fridgeQuery.data.summary.expiringSoon}
                    tone="warning"
                  />
                  <StatTile
                    label="Đã hết hạn"
                    value={fridgeQuery.data.summary.expired}
                    tone="danger"
                  />
                </View>
                <Text style={styles.cardHint}>
                  Ảnh chụp tủ lạnh tại thời điểm hiện tại, không phụ thuộc khoảng
                  ngày đã chọn.
                </Text>
              </SectionCard>

              <BreakdownCard
                title="Theo vị trí"
                emptyText="Tủ lạnh đang trống."
                rows={fridgeQuery.data.byLocation.map((item) => ({
                  key: item.name,
                  label: item.name,
                  detail: `${item.items} món`,
                  value: `${item.quantity}`,
                }))}
              />

              <BreakdownCard
                title="Theo danh mục"
                emptyText="Tủ lạnh đang trống."
                rows={fridgeQuery.data.byCategory.map((item) => ({
                  key: item.name,
                  label: item.name,
                  detail: `${item.items} món`,
                  value: `${item.quantity}`,
                }))}
              />

              <SectionCard title="Cần dùng sớm">
                {fridgeQuery.data.items.filter(
                  (item) => item.status !== 'fresh'
                ).length === 0 ? (
                  <Text style={styles.empty}>Không có món nào sắp hết hạn.</Text>
                ) : (
                  fridgeQuery.data.items
                    .filter((item) => item.status !== 'fresh')
                    .slice(0, 12)
                    .map((item, index, all) => (
                      <View
                        key={item.id}
                        style={[
                          styles.fridgeRow,
                          index < all.length - 1 && styles.divider,
                        ]}
                      >
                        <View style={styles.fridgeBody}>
                          <Text style={styles.breakdownLabel} numberOfLines={1}>
                            {item.foodName ?? 'Không xác định'}
                          </Text>
                          <Text style={styles.breakdownDetail} numberOfLines={1}>
                            {item.quantity}
                            {item.unitName ? ` ${item.unitName}` : ''}
                            {item.location ? ` · ${item.location}` : ''}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.expiry,
                            item.status === 'expired' && styles.expiryDanger,
                          ]}
                        >
                          {expiryLabel(item.expiryDate)}
                        </Text>
                      </View>
                    ))
                )}
              </SectionCard>
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function BreakdownCard({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: {
    key: string;
    label: string;
    value: string;
    detail?: string;
  }[];
  emptyText: string;
}) {
  return (
    <SectionCard title={title}>
      {rows.length === 0 ? (
        <Text style={styles.empty}>{emptyText}</Text>
      ) : (
        rows.map((row, index) => (
          <View
            key={row.key}
            style={[styles.breakdownRow, index < rows.length - 1 && styles.divider]}
          >
            <View style={styles.breakdownBody}>
              <Text style={styles.breakdownLabel} numberOfLines={1}>
                {row.label}
              </Text>
              {row.detail ? (
                <Text style={styles.breakdownDetail} numberOfLines={1}>
                  {row.detail}
                </Text>
              ) : null}
            </View>
            <Text style={styles.breakdownValue}>{row.value}</Text>
          </View>
        ))
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  presetRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  preset: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  presetActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  presetText: {
    ...typography.label,
    color: colors.textMuted,
  },
  presetTextActive: {
    color: colors.onAccent,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  tabRow: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    ...typography.label,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.onPrimary,
  },
  rateBlock: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  progressValue: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  breakdownBody: {
    flex: 1,
  },
  breakdownLabel: {
    ...typography.body,
    color: colors.text,
  },
  breakdownDetail: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  breakdownValue: {
    ...typography.bodyStrong,
    color: colors.primaryText,
  },
  fridgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  fridgeBody: {
    flex: 1,
  },
  expiry: {
    ...typography.label,
    color: colors.warning,
  },
  expiryDanger: {
    color: colors.danger,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
