import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

type ProgressBarProps = {
  value: number;
  total: number;
};

export function ProgressBar({ value, total }: ProgressBarProps) {
  const percent = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;

  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${percent * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
});
