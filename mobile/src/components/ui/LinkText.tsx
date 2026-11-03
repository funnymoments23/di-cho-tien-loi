import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, typography } from '@/theme';

type LinkTextProps = {
  children: string;
  onPress: () => void;
};

export function LinkText({ children, onPress }: LinkTextProps) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
      <Text style={styles.text}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: {
    ...typography.label,
    color: colors.primaryText,
  },
});
