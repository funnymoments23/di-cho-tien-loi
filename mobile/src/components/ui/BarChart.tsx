import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

export type BarChartDatum = {
  key: string;
  label: string;
  value: number;
  secondaryValue?: number;
};

type BarChartProps = {
  data: BarChartDatum[];
  height?: number;
  color?: string;
  secondaryColor?: string;
  labelEvery?: number;
  emptyText?: string;
  legend?: { color: string; label: string }[];
};

/**
 * Biểu đồ cột đơn giản bằng View (không cần thư viện chart).
 * - `value`: cột chính; `secondaryValue`: cột phụ (ví dụ đã mua cạnh cần mua).
 * - Chuỗi dài hơn 14 điểm sẽ cuộn ngang để cột không bị bóp quá nhỏ.
 */
export function BarChart({
  data,
  height = 132,
  color = colors.primary,
  secondaryColor = colors.accent,
  labelEvery = 1,
  emptyText = 'Chưa có dữ liệu trong khoảng này.',
  legend,
}: BarChartProps) {
  const hasData = data.some(
    (datum) => datum.value > 0 || (datum.secondaryValue ?? 0) > 0
  );

  if (!hasData) {
    return <Text style={styles.empty}>{emptyText}</Text>;
  }

  const max = Math.max(
    1,
    ...data.map((datum) =>
      Math.max(datum.value, datum.secondaryValue ?? 0)
    )
  );
  const scrollable = data.length > 14;

  const chart = (
    <View style={[styles.row, scrollable && styles.rowScrollable]}>
      {data.map((datum, index) => {
        const primaryHeight =
          datum.value > 0 ? Math.max(3, (datum.value / max) * height) : 0;
        const secondaryHeight =
          datum.secondaryValue !== undefined && datum.secondaryValue > 0
            ? Math.max(3, (datum.secondaryValue / max) * height)
            : null;
        const showLabel =
          index === 0 || index === data.length - 1 || index % labelEvery === 0;

        return (
          <View
            key={datum.key}
            style={[styles.column, scrollable && styles.columnScrollable]}
          >
            <View style={[styles.barArea, { height }]}>
              <View style={styles.bars}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: primaryHeight,
                      backgroundColor: color,
                      width: secondaryHeight !== null ? 5 : 9,
                    },
                  ]}
                />
                {secondaryHeight !== null ? (
                  <View
                    style={[
                      styles.bar,
                      {
                        height: secondaryHeight,
                        backgroundColor: secondaryColor,
                        width: 5,
                      },
                    ]}
                  />
                ) : null}
              </View>
            </View>
            <Text style={styles.axisLabel} numberOfLines={1}>
              {showLabel ? datum.label : ' '}
            </Text>
          </View>
        );
      })}
    </View>
  );

  return (
    <View>
      {scrollable ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {chart}
        </ScrollView>
      ) : (
        chart
      )}

      {legend && legend.length > 0 ? (
        <View style={styles.legend}>
          {legend.map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  rowScrollable: {
    gap: 4,
  },
  scrollContent: {
    paddingRight: spacing.sm,
  },
  column: {
    flex: 1,
    alignItems: 'center',
  },
  columnScrollable: {
    flex: 0,
    width: 12,
  },
  barArea: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  bar: {
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
  },
  axisLabel: {
    ...typography.label,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 4,
  },
  empty: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: spacing.lg,
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
});
