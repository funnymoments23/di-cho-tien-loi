import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme';

type ThumbnailProps = {
  uri?: string | null;
  label: string;
  size?: number;
};

export function Thumbnail({ uri, label, size = 48 }: ThumbnailProps) {
  const initial = label.trim().charAt(0).toUpperCase() || '?';

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: radius.md }}
        contentFit="cover"
        transition={150}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: radius.md },
      ]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.38 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: colors.primaryText,
    fontWeight: '700',
  },
});
