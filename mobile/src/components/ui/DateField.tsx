import { useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing, typography } from '@/theme';
import { formatDate } from '@/utils/date';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

type DateFieldProps = {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
};

export function DateField({ label, value, onChange }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Dayjs>(() =>
    dayjs(value).startOf('month')
  );

  const toggle = () => {
    if (!open) setViewMonth(dayjs(value).startOf('month'));
    setOpen((current) => !current);
  };

  const select = (day: number) => {
    onChange(
      viewMonth
        .date(day)
        .hour(12)
        .minute(0)
        .second(0)
        .millisecond(0)
        .toDate()
    );
    setOpen(false);
  };

  const firstDay = viewMonth.startOf('month');
  const offset = (firstDay.day() + 6) % 7;
  const daysInMonth = viewMonth.daysInMonth();
  const cells: Array<number | null> = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedDay = dayjs(value);
  const today = dayjs();

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={[styles.field, open && styles.fieldOpen]}
      >
        <Text style={styles.value}>{formatDate(value)}</Text>
        <Ionicons
          name="calendar-outline"
          size={18}
          color={colors.textMuted}
        />
      </Pressable>

      {open ? (
        <View style={styles.calendar}>
          <View style={styles.monthRow}>
            <Pressable
              onPress={() => setViewMonth(viewMonth.subtract(1, 'month'))}
              hitSlop={10}
              style={styles.monthButton}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={colors.primaryText}
              />
            </Pressable>

            <Text style={styles.monthLabel}>{viewMonth.format('MM/YYYY')}</Text>

            <Pressable
              onPress={() => setViewMonth(viewMonth.add(1, 'month'))}
              hitSlop={10}
              style={styles.monthButton}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.primaryText}
              />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((day) => (
              <Text key={day} style={styles.weekday}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {cells.map((day, index) => {
              if (!day) {
                return <View key={`empty-${index}`} style={styles.dayCell} />;
              }

              const date = viewMonth.date(day);
              const selected = date.isSame(selectedDay, 'day');
              const isToday = date.isSame(today, 'day');

              return (
                <Pressable
                  key={date.format('YYYY-MM-DD')}
                  onPress={() => select(day)}
                  style={[styles.dayCell, isToday && styles.todayCell]}
                >
                  <View style={[styles.dayCircle, selected && styles.daySelected]}>
                    <Text
                      style={[
                        styles.dayText,
                        selected && styles.dayTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.footer}>
            <Pressable
              onPress={() => {
                onChange(new Date());
                setOpen(false);
              }}
              hitSlop={8}
            >
              <Text style={styles.todayText}>Hôm nay</Text>
            </Pressable>

            <Pressable onPress={() => setOpen(false)} hitSlop={8}>
              <Text style={styles.closeText}>Đóng</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.label,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  field: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  fieldOpen: {
    borderColor: colors.primaryText,
  },
  value: {
    ...typography.body,
    color: colors.text,
  },
  calendar: {
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  monthButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  weekday: {
    ...typography.label,
    fontSize: 10,
    color: colors.textMuted,
    width: '14.2857%',
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.2857%',
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  todayCell: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: {
    backgroundColor: colors.accent,
  },
  dayText: {
    ...typography.body,
    color: colors.text,
  },
  dayTextSelected: {
    color: colors.onAccent,
    fontFamily: fonts.bold,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  todayText: {
    ...typography.label,
    color: colors.primaryText,
  },
  closeText: {
    ...typography.label,
    color: colors.primaryText,
  },
});
