import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type StatTone = 'primary' | 'warning' | 'danger' | 'success' | 'accent';

const tones: Record<StatTone, { background: string; foreground: string }> = {
  primary: { background: colors.primarySoft, foreground: colors.primaryText },
  warning: { background: colors.warningSoft, foreground: colors.warning },
  danger: { background: colors.dangerSoft, foreground: colors.danger },
  success: { background: colors.successSoft, foreground: colors.success },
  accent: { background: colors.accentSoft, foreground: colors.accentText },
};

type StatTileProps = {
  label: string;
  value: number | string;
  tone?: StatTone;
  hint?: string;
};

export function StatTile({ label, value, tone = 'primary', hint }: StatTileProps) {
  const palette = tones[tone];

  return (
    <View style={[styles.tile, { backgroundColor: palette.background }]}>
      <Text style={[styles.value, { color: palette.foreground }]}>{value}</Text>
      <Text style={[styles.label, { color: palette.foreground }]}>{label}</Text>
      {hint ? (
        <Text style={[styles.hint, { color: palette.foreground }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  value: {
    ...typography.title,
  },
  label: {
    ...typography.label,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  hint: {
    ...typography.caption,
    marginTop: 2,
    textAlign: 'center',
  },
});
