# Build & phát hành app mobile

Tài liệu này mô tả cấu hình build/release của app **Đi chợ tiện lợi** (Expo SDK 58).

## Thông tin project

| Mục | Giá trị |
|---|---|
| EAS project | `@funnymoments23/di-cho-tien-loi` |
| Project ID | `5a2d4ee3-3cfc-4876-9ed7-b3e301076e81` |
| Android package | `com.dichotienloi.app` |
| iOS bundle identifier | `com.dichotienloi.app` |
| Scheme | `dichotienloi` |
| API URL trên EAS | `EXPO_PUBLIC_API_URL` (đã đặt cho development/preview/production) |

> Đổi `package`/`bundleIdentifier` **trước khi phát hành** lần đầu; sau khi đã đăng lên Google Play / App Store thì không đổi được.

## 1. Cài đặt & kiểm tra

```bash
cd mobile

npm ci
npx expo-doctor      # cảnh báo react-native-render-html là đã biết
npx tsc --noEmit
npx expo lint
npx expo export --platform android
```

Đăng nhập EAS (nếu chưa):

```bash
npx eas-cli@latest login
# hoặc dùng biến môi trường EXPO_TOKEN
```

## 2. Development build (cần cho push notification)

Expo Go trên Android **không nhận remote push** từ SDK 53, nên phải dùng development build:

```bash
npx eas-cli@latest build --profile development --platform android
```

- Cài APK nhận được lên máy.
- Chạy `npx expo start`, mở app bằng development build.
- Đăng nhập → app xin quyền thông báo và gửi `ExpoPushToken` lên backend.
- Token được in trong log Metro: `[push] Expo push token: ExponentPushToken[...]`.
- Thử gửi tại <https://expo.dev/notifications> bằng token đó.

## 3. Cấu hình push notification

### Android — Firebase Cloud Messaging (FCM)

1. Tạo project tại [Firebase Console](https://console.firebase.google.com).
2. Thêm ứng dụng Android với package `com.dichotienloi.app`.
3. Tải `google-services.json` về đặt tại `mobile/google-services.json`.
4. Khai báo trong `app.json`:

   ```json
   "android": {
     "package": "com.dichotienloi.app",
     "googleServicesFile": "./google-services.json"
   }
   ```

5. Vào **Firebase Console → Project settings → Service accounts → Generate new private key**, tải file JSON service account.
6. Upload khoá lên EAS:

   ```bash
   npx eas-cli@latest credentials
   # Android → production → Google Service Account
   # → Manage your Google Service Account Key for Push Notifications (FCM V1)
   # → Upload a new service account key
   ```

   Không commit file service account (đã có trong `.gitignore`).

### iOS — APNs

- Cần **Apple Developer Account** có trả phí.
- Lần build iOS đầu tiên, EAS sẽ hỏi bật Push Notifications và tạo APNs key; chọn **Yes**.
- Hoặc chạy `npx eas-cli@latest credentials` → iOS → push key.

## 4. Build preview & production

```bash
# APK nội bộ để test
npx eas-cli@latest build --profile preview --platform android

# AAB cho Google Play
npx eas-cli@latest build --profile production --platform android

# iOS (cần Apple Developer)
npx eas-cli@latest build --profile production --platform ios
```

Cấu hình trong `eas.json`:

- `development`: dev client, APK, phân phối nội bộ.
- `preview`: APK, phân phối nội bộ.
- `production`: AAB, tự tăng version (`autoIncrement`).

## 5. Gửi lên store

```bash
npx eas-cli@latest submit --profile production --platform android
npx eas-cli@latest submit --profile production --platform ios
```

Android cần service account Google Play; iOS cần Apple ID/App Store Connect.

## 6. Backend

- Deploy backend mới lên Render (các thay đổi công thức/gợi ý hiện chưa commit).
- Biến môi trường backend cần có: `MONGODB_URI`, JWT secrets, Cloudinary, SMTP, `EXPO_ACCESS_TOKEN` (nếu bật Push Security), `EXPIRY_*`.
- App dùng `EXPO_PUBLIC_API_URL` từ EAS env, không phụ thuộc file `.env` local.

## Lưu ý

- Notification channel Android dùng id `expiry`, khớp `channelId` backend gửi.
- Bấm thông báo `EXPIRY_REMINDER` sẽ mở tab **Tủ lạnh**.
- Nếu thiếu `google-services.json` hoặc chưa upload FCM key, app vẫn build nhưng **không nhận được push** trên Android.
- Nếu chưa có `projectId`, app hiện thông báo hướng dẫn thay vì crash.
