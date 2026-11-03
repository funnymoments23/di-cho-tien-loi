import { useEffect } from 'react';
import {
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
  useSegments,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
// Import từng weight để Metro chỉ đóng gói 4 file font cần dùng,
// thay vì cả 18 weight khi import từ entry chính của package.
import { BeVietnamPro_400Regular } from '@expo-google-fonts/be-vietnam-pro/400Regular';
import { BeVietnamPro_500Medium } from '@expo-google-fonts/be-vietnam-pro/500Medium';
import { BeVietnamPro_600SemiBold } from '@expo-google-fonts/be-vietnam-pro/600SemiBold';
import { BeVietnamPro_700Bold } from '@expo-google-fonts/be-vietnam-pro/700Bold';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    // Dùng primaryText cho chữ/icon trên nền sáng; primary chỉ dùng làm màu nền.
    primary: colors.primaryText,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.danger,
  },
};

export default function RootLayout() {
  const { hydrated, accessToken, hydrate } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [fontsLoaded, fontError] = useFonts({
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    BeVietnamPro_700Bold,
  });

  // Đăng ký nhận thông báo đẩy sau khi đăng nhập (token được gửi lên backend).
  usePushNotifications({ enabled: Boolean(hydrated && accessToken) });

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    if (hydrated && (fontsLoaded || fontError)) SplashScreen.hideAsync();
  }, [hydrated, fontsLoaded, fontError]);

  useEffect(() => {
    if (!hydrated) return;
    const inAuth = segments[0] === '(auth)';
    const inTabs = segments[0] === '(tabs)';
    const inGroup = segments[0] === 'group';
    const inCatalog = segments[0] === 'catalog';
    const inFood = segments[0] === 'food';
    const inShoppingDetail = segments[0] === 'shopping';
    const inRecipes = segments[0] === 'recipes';
    const inReports = segments[0] === 'reports';
    const inChangePassword = segments[0] === 'change-password';
    if (!accessToken && !inAuth) router.replace('/(auth)/login');
    if (
      accessToken &&
      !inTabs &&
      !inGroup &&
      !inCatalog &&
      !inFood &&
      !inShoppingDetail &&
      !inRecipes &&
      !inReports &&
      !inChangePassword
    ) {
      router.replace('/(tabs)');
    }
  }, [hydrated, accessToken, segments]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }} />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
