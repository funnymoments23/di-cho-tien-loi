import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { qk } from '@/api/queryKeys';
import { tabsApi } from '@/api/tabs.api';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/ui/StateView';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatTile } from '@/components/ui/StatTile';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { colors, radius, spacing, typography } from '@/theme';
import { daysUntil, expiryLabel, expiryTone, formatDate } from '@/utils/date';
import { getErrorMessage } from '@/utils/error';
import type { FridgeItem } from '@/types/models';

export default function FridgeScreen() {
  const fridgeQuery = useQuery({
    queryKey: qk.fridge,
    queryFn: tabsApi.fridge,
  });

  const items = fridgeQuery.data ?? [];
  const expired = items.filter((item) => daysUntil(item.useWithin) < 0).length;
  const expiringSoon = items.filter((item) => {
    const days = daysUntil(item.useWithin);
    return days >= 0 && days <= 3;
  }).length;

  return (
    <Screen
      refreshing={fridgeQuery.isRefetching}
      onRefresh={() => void fridgeQuery.refetch()}
    >
      <ScreenHeader
        title="Tủ lạnh"
        subtitle={
          items.length > 0
            ? `${items.length} món đang được lưu trữ`
            : 'Theo dõi thực phẩm và hạn sử dụng'
        }
      />

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
          icon="snow-outline"
        />
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatTile label="Tổng món" value={items.length} tone="primary" />
            <StatTile label="Sắp hết hạn" value={expiringSoon} tone="warning" />
            <StatTile label="Đã hết hạn" value={expired} tone="danger" />
          </View>

          <SectionCard title="Danh sách thực phẩm">
            {items.map((item, index) => (
              <FridgeRow
                key={item.id}
                item={item}
                last={index === items.length - 1}
              />
            ))}
          </SectionCard>
        </>
      )}
    </Screen>
  );
}

function FridgeRow({ item, last }: { item: FridgeItem; last: boolean }) {
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
          {item.location ?? 'Chưa xếp vị trí'}
        </Text>
        <Text style={styles.date}>Hạn dùng: {formatDate(item.useWithin)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
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
});
