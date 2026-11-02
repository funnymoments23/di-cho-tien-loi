import { Platform } from 'react-native';

const fallback = Platform.select({
  android: 'http://10.0.2.2:5000/it4788',
  default: 'http://localhost:5000/it4788',
})!;

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? fallback;