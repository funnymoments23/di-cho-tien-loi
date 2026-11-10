import { useCallback, useEffect, useState } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { authApi } from '@/api/auth.api';

export type PushStatus =
  | 'idle'
  | 'loading'
  | 'granted'
  | 'denied'
  | 'unsupported'
  | 'error';

type PushState = {
  status: PushStatus;
  message: string;
  token: string | null;
};

const CHANNEL_ID = 'expiry';

const initialState: PushState = {
  status: 'idle',
  message: '',
  token: null,
};

// Hiển thị thông báo cả khi app đang mở (foreground).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let inFlight: Promise<PushState> | null = null;

const ensureAndroidChannel = async () => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Thực phẩm sắp hết hạn',
    importance: AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F59E0B',
  });
};

/**
 * Xin quyền + lấy Expo push token + gửi lên backend.
 * `requestPermission = false` chỉ kiểm tra quyền hiện tại (dùng cho màn Cá nhân).
 */
export async function registerPushNotifications(
  requestPermission = true
): Promise<PushState> {
  // iOS Simulator không có APNs nên không thể lấy token. Android emulator có
  // Google Play services vẫn nhận push bình thường — nếu thiếu FCM,
  // getExpoPushTokenAsync() sẽ ném lỗi và được bắt ở dưới.
  if (!Device.isDevice && Platform.OS === 'ios') {
    return {
      status: 'unsupported',
      message: 'Trình mô phỏng iOS không nhận được thông báo đẩy.',
      token: null,
    };
  }

  inFlight ??= doRegister(requestPermission).finally(() => {
    inFlight = null;
  });

  return inFlight;
}

async function doRegister(requestPermission: boolean): Promise<PushState> {
  await ensureAndroidChannel();

  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted' && requestPermission) {
    permission = await Notifications.requestPermissionsAsync();
  }

  if (permission.status !== 'granted') {
    return {
      status: 'denied',
      message: 'Bạn chưa cấp quyền thông báo cho ứng dụng.',
      token: null,
    };
  }

  if (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient &&
    Constants.appOwnership === 'expo'
  ) {
    return {
      status: 'error',
      message:
        'Expo Go không hỗ trợ push token. Hãy chạy development build để nhận thông báo.',
      token: null,
    };
  }

  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId;

  try {
    const result = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    // Giúp thử push khi chạy development build: copy token từ log Metro.
    if (__DEV__) {
      console.info('[push] Expo push token:', result.data);
    }

    await authApi.updateDeviceToken(result.data);

    return {
      status: 'granted',
      message: 'Đã bật thông báo thực phẩm sắp hết hạn.',
      token: result.data,
    };
  } catch (err) {
    // Log lỗi thật để debug trên Metro: thường gặp "Default FirebaseApp is not
    // initialized" (thiếu google-services.json) hoặc lỗi FCM credentials.
    console.warn('[push] getExpoPushTokenAsync failed:', err);
    return {
      status: 'error',
      message:
        'Không lấy được push token. Kiểm tra cấu hình projectId (EAS) hoặc dùng development build.',
      token: null,
    };
  }
}

type UsePushNotificationsOptions = {
  enabled: boolean;
  autoRequest?: boolean;
};

/**
 * Tự đăng ký nhận thông báo khi đã đăng nhập và điều hướng tới tủ lạnh
 * khi người dùng bấm vào thông báo.
 */
export function usePushNotifications({
  enabled,
  autoRequest = true,
}: UsePushNotificationsOptions) {
  const [state, setState] = useState<PushState>(initialState);
  const lastResponse = Notifications.useLastNotificationResponse();

  const register = useCallback(
    async (requestPermission = true) => {
      setState((current) => ({
        ...current,
        status: 'loading',
        message: '',
      }));
      const result = await registerPushNotifications(requestPermission);
      setState(result);
      return result;
    },
    []
  );

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    void registerPushNotifications(autoRequest).then((result) => {
      if (active) setState(result);
    });

    return () => {
      active = false;
    };
  }, [enabled, autoRequest]);

  useEffect(() => {
    if (!enabled || !lastResponse) return;

    Notifications.clearLastNotificationResponse();
    const type = lastResponse.notification.request.content.data?.type;
    if (type === 'EXPIRY_REMINDER') {
      router.navigate('/(tabs)/fridge');
    }
  }, [enabled, lastResponse]);

  return { ...state, register };
}
