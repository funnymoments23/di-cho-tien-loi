# Báo cáo kiểm thử — nhóm API Auth, Quên mật khẩu, Tài khoản, Nhóm, Danh mục, Đơn vị, Thực phẩm, Tủ lạnh, Đi chợ, Bữa ăn, Công thức, Báo cáo & Cron/Push

- **Ngày chạy:** 29/10/2026 (bổ sung nhóm API Quên mật khẩu)
- **Phạm vi:** 6 endpoint Auth + 2 endpoint Quên mật khẩu + 5 endpoint Tài khoản + 6 endpoint Nhóm + 4 endpoint Danh mục + 4 endpoint Đơn vị + 5 endpoint Thực phẩm + 5 endpoint Tủ lạnh + 8 endpoint Đi chợ + 5 endpoint Bữa ăn + 4 endpoint Công thức + 5 endpoint Báo cáo (`server/src/routes/user.route.js`, `group.route.js`, `admin.route.js`, `food.route.js`, `fridge.route.js`, `shopping.route.js`, `meal.route.js`, `recipe.route.js`, `report.route.js`) + endpoint health + rate limit
- **Công cụ:** Jest 30.5.2, Supertest 7.3.1, mongodb-memory-server 11.3.0
- **Môi trường:** Windows, Node.js v24.11.0, MongoDB in-memory 8.2.6
- **Kết quả:** **462/462 test PASS**, 15 test suite, ~65 giây (sau khi binary Mongo đã tải sẵn)

## Cách chạy

```bash
cd server
npm install          # lần đầu: tải thêm binary MongoDB (~77 MB) cho mongodb-memory-server
npm test             # jest --runInBand
```

Cấu hình: [`server/jest.config.js`](../server/jest.config.js), biến môi trường test ở
[`server/tests/setup-env.js`](../server/tests/setup-env.js), test suite ở
[`server/tests/auth.test.js`](../server/tests/auth.test.js),
[`server/tests/forgot-password.test.js`](../server/tests/forgot-password.test.js),
[`server/tests/user.test.js`](../server/tests/user.test.js),
[`server/tests/group.test.js`](../server/tests/group.test.js),
[`server/tests/category.test.js`](../server/tests/category.test.js),
[`server/tests/unit.test.js`](../server/tests/unit.test.js),
[`server/tests/food.test.js`](../server/tests/food.test.js),
[`server/tests/fridge.test.js`](../server/tests/fridge.test.js),
[`server/tests/shopping.test.js`](../server/tests/shopping.test.js),
[`server/tests/meal.test.js`](../server/tests/meal.test.js),
[`server/tests/recipe.test.js`](../server/tests/recipe.test.js),
[`server/tests/report.test.js`](../server/tests/report.test.js),
[`server/tests/push-notification.test.js`](../server/tests/push-notification.test.js),
[`server/tests/expiry-checker.test.js`](../server/tests/expiry-checker.test.js) và
[`server/tests/rate-limit.test.js`](../server/tests/rate-limit.test.js).

Đặc điểm bộ test:

- Dùng **MongoDB in-memory** nên không chạm vào DB thật, không cần `.env`, chạy được trên CI.
- **Mock `utils/email.js`** — không gửi email thật; mã 6 số (`sendVerificationCode` / `sendPasswordResetCode`) lấy từ `mock.calls` để test luồng verify và quên mật khẩu.
- `BCRYPT_ROUNDS=4` cho nhanh; JWT secret cố định trong `setup-env.js`.
- `User.deleteMany({})` + `Group.deleteMany({})` + `Category.deleteMany({})` + `Unit.deleteMany({})` + `Food.deleteMany({})` + `FridgeItem.deleteMany({})` + `FridgeEvent.deleteMany({})` + `ShoppingList.deleteMany({})` + `Task.deleteMany({})` + `MealPlan.deleteMany({})` + `Recipe.deleteMany({})` trước mỗi test → các test độc lập, không phụ thuộc thứ tự.
- Rate limit tắt mặc định trong bộ test chức năng (`AUTH_RATE_LIMIT_MAX=0`), có test riêng với ngưỡng thấp.

## Kết quả theo endpoint

### `GET /it4788/health` — 1/1

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 1 | Server sống | 200 / `00000` | PASS |

### `POST /it4788/user` — đăng ký (7/7)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 2 | Body rỗng | 400 / `00025` | PASS |
| 3 | Email sai định dạng | 400 / `00026` | PASS |
| 4 | Mật khẩu 5 ký tự | 400 / `00027` | PASS |
| 5 | Tên 2 ký tự | 400 / `00028` | PASS |
| 6 | Hợp lệ | 201 / `00035`; trả `verificationToken`, `codeExpiresIn=600`; không lộ `password`/`refreshToken`/`verificationCode` | PASS |
| 7 | Email trùng (khác hoa/thường) | 409 / `00032` | PASS |
| 8 | Gửi kèm `role: admin`, `isVerified: true` | Bị Joi loại bỏ; DB vẫn `role=user`, `isVerified=false` | PASS |

Kiểm tra thêm ở case 6: mật khẩu trong DB là hash bcrypt (không phải plaintext), mã xác minh đúng mã đã "gửi", hạn dùng > hiện tại.

### `POST /it4788/user/send-verification-code` — gửi lại mã (5/5)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 9 | Thiếu email | 400 / `00005` | PASS |
| 10 | Email sai định dạng | 400 / `00026` | PASS |
| 11 | Email không tồn tại | 404 / `00036` | PASS |
| 12 | Tài khoản đã xác minh | 200 / **`00058`** + `alreadyVerified=true`, `user`; **không gửi email** | PASS |
| 13 | Tài khoản chưa xác minh | 200 / `00048`, `alreadyVerified=false`; mã + token mới verify được | PASS |

### `POST /it4788/user/verify-email` — xác minh email (9/9)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 14 | Thiếu `code` | 400 / `00053` | PASS |
| 15 | `code="abc123"` | 400 / `00054` | PASS |
| 16 | Thiếu `token` | **401 / `00055`** | PASS |
| 17 | `token` rác | 401 / `00055` | PASS |
| 18 | Mã sai | 400 / `00054`, `isVerified` vẫn `false` | PASS |
| 19 | Mã quá hạn (set `verificationCodeExpiresAt` về quá khứ) | 400 / `00054` | PASS |
| 20 | Mã đúng | 200 / `00058`, `isVerified=true`, mã bị xoá khỏi DB | PASS |
| 21 | Gọi lại lần 2 cùng token | 200, `alreadyVerified=true` | PASS |
| 22 | Dùng access token thay verification token | 401 / `00055` | PASS |

### `POST /it4788/user/login` — đăng nhập (8/8)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 23 | Thiếu field | 400 / `00038` | PASS |
| 24 | Email sai định dạng | 400 / `00039` | PASS |
| 25 | Mật khẩu sai định dạng | 400 / `00040` | PASS |
| 26 | Email không tồn tại | 404 / `00042` | PASS |
| 27 | Chưa xác minh email | 403 / `00044` | PASS |
| 28 | Sai mật khẩu | 401 / `00045` | PASS |
| 29 | Đúng thông tin | 200 / `00047`, trả access + refresh token, không lộ hash; DB lưu SHA-256 của refresh token | PASS |
| 30 | Email viết hoa | 200 / `00047` (Joi chuẩn hoá lowercase) | PASS |

### `POST /it4788/user/refresh-token` — làm mới token (9/9)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 31 | Thiếu `refreshToken` | 400 / `00059` | PASS |
| 32 | Token rác | 401 / `00063` | PASS |
| 33 | Dùng access token thay refresh token | 401 / `00063` | PASS |
| 34 | Refresh token hết hạn | 401 / `00062` | PASS |
| 35 | Token hợp lệ nhưng user không tồn tại | 401 / `00061` | PASS |
| 36 | `sub` không phải ObjectId | 401 / `00063` | PASS |
| 37 | Token hợp lệ | 200 / `00065`; cặp token mới khác cặp cũ | PASS |
| 38 | Dùng lại refresh token cũ sau rotate | 401 / `00063` | PASS |
| 39 | Refresh token mới sau rotate | Dùng được, 200 / `00065` | PASS |

### `POST /it4788/user/logout` — đăng xuất (7/7)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 40 | Không có header `Authorization` | 401 / `00006` | PASS |
| 41 | Header sai scheme (`Token ...`) | 401 / `00006` | PASS |
| 42 | Access token rác | 401 / `00012` | PASS |
| 43 | Access token hết hạn | 401 / `00011` | PASS |
| 44 | Dùng refresh token làm Bearer token | 401 / `00012` | PASS |
| 45 | Logout hợp lệ | 200 / `00050`; refresh token bị thu hồi (`null` trong DB), dùng lại trả `00063` | PASS |
| 46 | Token hợp lệ nhưng user đã bị xoá | **404 / `00052`** | PASS |

### Rate limit (`tests/rate-limit.test.js`) — 3/3

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 47 | Quá ngưỡng (3 request/IP/15 phút) | 3 request đầu 400, request 4 → 429 / `00024` + header `Retry-After` | PASS |
| 48 | Áp dụng cho đăng ký, gửi mã, xác minh email | Mỗi endpoint: request thứ 2 khi ngưỡng = 1 → 429 / `00024` | PASS |
| 49 | `AUTH_RATE_LIMIT_MAX=0` | Tắt hoàn toàn, 10 request liên tiếp không bị chặn | PASS |

### Nhóm API Tài khoản (`tests/user.test.js`) — 27/27

#### `GET /it4788/user` — xem hồ sơ (4/4)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 50 | Không có token | 401 / `00006` | PASS |
| 51 | Token rác | 401 / `00012` | PASS |
| 52 | Token hợp lệ | 200 / `00089`; không lộ `password`, `refreshToken`, `verificationCode` | PASS |
| 53 | Token hợp lệ nhưng user đã bị xoá | 404 / `00052` | PASS |

#### `PUT /it4788/user` — sửa hồ sơ (11/11)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 54 | Không có token | 401 / `00006` | PASS |
| 55 | Tên 2 ký tự | 400 / `00077` | PASS |
| 56 | Username 2 ký tự | 400 / `00081` | PASS |
| 57 | Username đã có người dùng | 409 / `00084` | PASS |
| 58 | Giới tính ngoài `female/male/other` | 400 / `00078` | PASS |
| 59 | Ngày sinh sai định dạng | 400 / `00080` | PASS |
| 60 | Ngôn ngữ ngoài `vi/en` | 400 / `00079` | PASS |
| 61 | Dữ liệu hợp lệ | 200 / `00086`; lưu đủ `name`, `username`, `gender`, `birthday`, `language`, `timezone`, `avatar` | PASS |
| 62 | Gửi kèm `email`, `role`, `isVerified`, `groupId` | Joi loại bỏ; DB không đổi các trường bảo vệ | PASS |
| 63 | Upload `multipart/form-data` field `image` | 200 / `00086`; `avatar` = `/it4788/uploads/avatars/...`, file tồn tại | PASS |
| 64 | Upload tệp không phải ảnh | 400 / `00158` | PASS |

#### `POST /it4788/user/change-password` — đổi mật khẩu (7/7)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 65 | Không có token | 401 / `00006` | PASS |
| 66 | Thiếu trường | 400 / `00069` | PASS |
| 67 | Mật khẩu mới 5 ký tự | 400 / `00069` | PASS |
| 68 | Mật khẩu cũ sai | 400 / `00072` | PASS |
| 69 | Mật khẩu mới trùng mật khẩu cũ | 400 / `00073` | PASS |
| 70 | Đổi thành công | 200 / `00076`; mật khẩu cũ không đăng nhập được, mật khẩu mới đăng nhập được | PASS |
| 71 | Dùng refresh token cũ sau khi đổi | 401 / `00063` (đã bị thu hồi) | PASS |

#### `DELETE /it4788/user` — xoá tài khoản (2/2)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 72 | Không có token | 401 / `00006` | PASS |
| 73 | Xoá thành công | 200 / `00092`; DB không còn user, token cũ gọi lại trả `00052` | PASS |

#### `PUT /it4788/user/device-token` — cập nhật push token (3/3)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 74 | Không có token | 401 / `00006` | PASS |
| 75 | Thiếu `deviceToken` | 400 / `00025` | PASS |
| 76 | Token hợp lệ | 200 / `00086`; `deviceToken` được lưu vào DB | PASS |

Ghi chú nhóm Tài khoản:

- `PUT /user` nhận cả JSON và `multipart/form-data` (ảnh field `image`, tối đa 5MB, chỉ nhận `image/*`).
  Ảnh được upload lên Cloudinary và DB lưu URL `https://res.cloudinary.com/...`; cấu hình `CLOUDINARY_*` trong `.env`.
- Đổi mật khẩu **thu hồi refresh token** đang lưu để các phiên cũ không tiếp tục được; access token hiện tại vẫn dùng được tới khi hết hạn (1 giờ).
- `PUT /user/device-token` là API bổ sung (đặc tả gốc không có), chưa có mã response riêng nên dùng `00086`/`00025`.
- `DELETE /user` gỡ user khỏi nhóm trước khi xoá tài khoản: thành viên bị bỏ khỏi `members`, trưởng nhóm rời đi thì chuyển quyền cho thành viên còn lại (hoặc xoá nhóm nếu không còn ai, kèm dọn đồ trong tủ lạnh). Các dữ liệu khác (danh sách mua sắm, bữa ăn...) chưa dọn vì model chưa được xây dựng.

### Nhóm API Quên mật khẩu (`tests/forgot-password.test.js`) — 20/20

#### `POST /it4788/user/forgot-password` — yêu cầu mã (7/7)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| F1 | Thiếu email | 400 / `00005` | PASS |
| F2 | Email sai định dạng | 400 / `00026` | PASS |
| F3 | Email không tồn tại | 404 / `00036`; không gửi email | PASS |
| F4 | Hợp lệ | 200 / `00048`; trả `resetToken`, `codeExpiresIn=600`; mã 6 số hạn 10 phút, mật khẩu chưa đổi | PASS |
| F5 | Email viết hoa | Tìm thấy tài khoản, gửi mã bình thường | PASS |
| F6 | Yêu cầu lại | Mã mới thay mã cũ; mã cũ dùng để đặt lại trả `00067` | PASS |
| F7 | Dùng mã xác minh email để đặt lại mật khẩu | 400 / `00067` (hai loại mã nằm ở trường riêng) | PASS |

#### `POST /it4788/user/reset-password` — đặt mật khẩu mới (13/13)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| F8 | Thiếu mã | 400 / `00053` | PASS |
| F9 | Mã không đúng 6 chữ số | 400 / `00067` | PASS |
| F10 | Mật khẩu mới 5 ký tự | 400 / `00066` | PASS |
| F11 | Thiếu token | 401 / `00055` | PASS |
| F12 | Token rác | 401 / `00055` | PASS |
| F13 | Dùng access token thay token đặt lại | 401 / `00055` | PASS |
| F14 | Token hợp lệ nhưng user không tồn tại | 404 / `00052` | PASS |
| F15 | Mã sai | 400 / `00067`; mật khẩu cũ vẫn đăng nhập được | PASS |
| F16 | Mã quá hạn | 400 / `00067`; mật khẩu không đổi | PASS |
| F17 | Token và mã của hai người khác nhau | 400 / `00067`; không tài khoản nào bị đổi | PASS |
| F18 | Mật khẩu mới trùng mật khẩu hiện tại | 400 / `00073` | PASS |
| F19 | Đặt lại thành công | 200 / `00068`; mật khẩu cũ không đăng nhập được, mật khẩu mới đăng nhập được; DB lưu hash bcrypt, xoá mã; dùng lại token/mã trả `00067` | PASS |
| F20 | Refresh token của phiên cũ | 401 / `00063` (đã bị thu hồi sau khi đặt lại) | PASS |

Ghi chú nhóm Quên mật khẩu:

- Luồng 2 bước giống xác minh email: `forgot-password` gửi mã 6 số qua email và trả `resetToken` (JWT `typ=reset`, hạn 10 phút); `reset-password` nhận `{ code, token, newPassword }`.
- Mã đặt lại lưu ở `passwordResetCode` / `passwordResetCodeExpiresAt` (riêng với mã xác minh email), dùng `safeCompare` khi so sánh; đặt lại xong thì xoá mã và **thu hồi refresh token** như đổi mật khẩu.
- Không tiết lộ mã cho client: dev chưa cấu hình SMTP thì mã chỉ in ra console (`utils/email.js`).

### Nhóm API Nhóm gia đình (`tests/group.test.js`) — 32/32

#### `POST /it4788/user/group` — tạo nhóm (5/5)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 77 | Không có token | 401 / `00006` | PASS |
| 78 | Thiếu `groupName` | 400 / `00094` | PASS |
| 79 | `groupName` rỗng hoặc quá 50 ký tự | 400 / `00094` | PASS |
| 80 | Tạo thành công | 201 / `00095`; người tạo là `adminId` + thành viên đầu tiên, `user.groupId` được gán | PASS |
| 81 | Tạo nhóm lần 2 | 409 / `00093`; DB chỉ có 1 nhóm | PASS |

#### `GET /it4788/user/group` — xem nhóm (3/3)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 82 | Không có token | 401 / `00006` | PASS |
| 83 | Chưa vào nhóm | 403 / `00096` | PASS |
| 84 | Có nhóm | 200 / `00098`; đủ thành viên, không lộ `password`/`refreshToken`/`verificationCode` | PASS |

#### `GET /it4788/user/group/info` — thông tin nhóm (3/3)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 85 | Không có token | 401 / `00006` | PASS |
| 86 | Chưa vào nhóm | 403 / `00096` | PASS |
| 87 | Trưởng nhóm / thành viên | 200 / `00098`; `isAdmin` đúng, trả tên + username trưởng nhóm, `memberCount` | PASS |

#### `POST /it4788/user/group/add` — thêm thành viên (7/7)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 88 | Không có token | 401 / `00006` | PASS |
| 89 | Người gọi chưa vào nhóm | 403 / `00096` | PASS |
| 90 | Thiếu username / username 2 ký tự | 400 / `00100` | PASS |
| 91 | Username không tồn tại | 404 / `00099` | PASS |
| 92 | Người được thêm đã thuộc nhóm khác | 409 / `00099` | PASS |
| 93 | Thành viên (không phải trưởng nhóm) thêm người | 403 / `00101` | PASS |
| 94 | Thêm thành công | 200 / `00102`; gán `groupId`, cập nhật `members` | PASS |

#### `DELETE /it4788/user/group` — xoá thành viên (7/7)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 95 | Không có token | 401 / `00006` | PASS |
| 96 | Người gọi chưa vào nhóm | 403 / `00096` | PASS |
| 97 | Thiếu username | 400 / `00107` | PASS |
| 98 | Thành viên (không phải trưởng nhóm) xoá người | 403 / `00104` | PASS |
| 99 | Người cần xoá không thuộc nhóm | 404 / `00103` | PASS |
| 100 | Trưởng nhóm tự xoá mình qua API xoá thành viên | 400 / `00105` | PASS |
| 101 | Xoá thành công | 200 / `00106`; user vẫn tồn tại, `groupId=null`, bỏ khỏi `members` | PASS |

#### `POST /it4788/user/group/leave` — rời nhóm (5/5)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 102 | Không có token | 401 / `00006` | PASS |
| 103 | Chưa vào nhóm | 403 / `00096` | PASS |
| 104 | Thành viên rời nhóm | 200 / `00108`; nhóm và trưởng nhóm giữ nguyên | PASS |
| 105 | Trưởng nhóm rời nhóm | 200 / `00108`; chuyển quyền cho thành viên còn lại, quyền trưởng nhóm dùng được ngay | PASS |
| 106 | Người cuối cùng rời nhóm | 200 / `00108`; nhóm bị xoá | PASS |

#### `DELETE /it4788/user` — dọn quan hệ nhóm (2/2)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 107 | Trưởng nhóm xoá tài khoản | 200 / `00092`; chuyển quyền trưởng nhóm cho thành viên còn lại | PASS |
| 108 | Thành viên xoá tài khoản | 200 / `00092`; bỏ khỏi `members`, `memberCount` giảm | PASS |

Ghi chú nhóm Nhóm:

- `POST /user/group` được bổ sung body `{ groupName }` theo đề xuất ở [tài liệu 02](02-GOP-Y-DAC-TA-API.md) mục 1.3; mã `00094` là mã mới trong dải trống của nhóm.
- `GET /user/group/info` và `POST /user/group/leave` là hai API bổ sung theo mục 4.4 tài liệu 02. Quyền trưởng nhóm được kiểm tra bằng middleware `groupAdmin`.
- Các mã mới dùng dải trống: `00094` (thiếu tên nhóm), `00101` (không phải trưởng nhóm khi thêm), `00105` (không xoá được trưởng nhóm), `00108` (rời nhóm).
- Tạo nhóm/thêm thành viên dùng cập nhật có điều kiện (`groupId = null`) để tránh 2 request đồng thời đưa một người vào 2 nhóm.

### Nhóm API Danh mục (`tests/category.test.js`) — 22/22

#### `GET /it4788/admin/category` — lấy danh sách (3/3)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 109 | Không có token | 401 / `00006` | PASS |
| 110 | Chưa có danh mục | 200 / `00129`, `data = []` | PASS |
| 111 | Người dùng thường xem danh sách | 200 / `00129`; sắp xếp theo tên, không lộ trường nội bộ | PASS |

#### `POST /it4788/admin/category` — tạo danh mục (7/7)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 112 | Không có token | 401 / `00006` | PASS |
| 113 | Người dùng thường gọi API | 403 / `00017` | PASS |
| 114 | Thiếu `name` | 400 / `00131` | PASS |
| 115 | `name` rỗng hoặc quá 50 ký tự | 400 / `00131` | PASS |
| 116 | Tạo thành công | 201 / `00135`; tên được trim, lưu đúng vào DB | PASS |
| 117 | Tên đã tồn tại | 409 / `00132`; DB không thêm bản ghi | PASS |
| 118 | Tên trùng sau khi trim | 409 / `00132`; DB không thêm bản ghi | PASS |

#### `PUT /it4788/admin/category` — sửa tên (7/7)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 119 | Không có token | 401 / `00006` | PASS |
| 120 | Người dùng thường gọi API | 403 / `00017` | PASS |
| 121 | Thiếu `name` hoặc `newName` | 400 / `00136` | PASS |
| 122 | Tên cũ trùng tên mới | 400 / `00137` | PASS |
| 123 | Tên cũ không tồn tại | 404 / `00138` | PASS |
| 124 | Tên mới đã tồn tại | 409 / `00138`; bản ghi cũ giữ nguyên tên | PASS |
| 125 | Sửa thành công | 200 / `00141`; tên mới được trim và lưu vào DB | PASS |

#### `DELETE /it4788/admin/category` — xoá danh mục (5/5)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 126 | Không có token | 401 / `00006` | PASS |
| 127 | Người dùng thường gọi API | 403 / `00017` | PASS |
| 128 | Thiếu `name` | 400 / `00142` | PASS |
| 129 | Danh mục không tồn tại | 404 / `00143` | PASS |
| 130 | Xoá thành công | 200 / `00146`; DB không còn bản ghi | PASS |

Ghi chú nhóm Danh mục:

- `GET` mở cho **mọi tài khoản đã đăng nhập** vì app cần danh mục khi tạo thực phẩm; `POST`/`PUT`/`DELETE` chỉ dành cho role `admin`.
- `admin.middleware.js` kiểm tra role trong access token và trả `00017` ("Truy cập bị từ chối…") khi không phải admin.
- `PUT` nhận `{ name, newName }` đúng theo mã `00136` ("Thiếu thông tin name cũ, name mới"). Tên được trim và giới hạn 50 ký tự; model có unique index trên `name`.
- Tên mới trùng danh mục khác dùng mã `00138` — tương ứng mã `00138x` "Tên mới đã tồn tại" trong đặc tả gốc ([tài liệu 02](02-GOP-Y-DAC-TA-API.md) mục 2.2).
- `DELETE` nhận body `{ name }` theo đặc tả gốc; xem góp ý về body của `DELETE` ở [tài liệu 02](02-GOP-Y-DAC-TA-API.md) mục 2.6.

### Nhóm API Đơn vị đo (`tests/unit.test.js`) — 22/22

#### `GET /it4788/admin/unit` — lấy danh sách (3/3)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 131 | Không có token | 401 / `00006` | PASS |
| 132 | Chưa có đơn vị | 200 / `00110`, `data = []` | PASS |
| 133 | Người dùng thường xem danh sách | 200 / `00110`; sắp xếp theo tên, không lộ trường nội bộ | PASS |

#### `POST /it4788/admin/unit` — tạo đơn vị (7/7)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 134 | Không có token | 401 / `00006` | PASS |
| 135 | Người dùng thường gọi API | 403 / `00017` | PASS |
| 136 | Thiếu `name` | 400 / `00112` | PASS |
| 137 | `name` rỗng hoặc quá 50 ký tự | 400 / `00112` | PASS |
| 138 | Tạo thành công | 201 / `00116`; tên được trim, lưu đúng vào DB | PASS |
| 139 | Tên đã tồn tại | 409 / `00113`; DB không thêm bản ghi | PASS |
| 140 | Tên trùng sau khi trim | 409 / `00113`; DB không thêm bản ghi | PASS |

#### `PUT /it4788/admin/unit` — sửa tên (7/7)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 141 | Không có token | 401 / `00006` | PASS |
| 142 | Người dùng thường gọi API | 403 / `00017` | PASS |
| 143 | Thiếu `name` hoặc `newName` | 400 / `00117` | PASS |
| 144 | Tên cũ trùng tên mới | 400 / `00118` | PASS |
| 145 | Tên cũ không tồn tại | 404 / `00119` | PASS |
| 146 | Tên mới đã tồn tại | 409 / `00113`; bản ghi cũ giữ nguyên tên | PASS |
| 147 | Sửa thành công | 200 / `00122`; tên mới được trim và lưu vào DB | PASS |

#### `DELETE /it4788/admin/unit` — xoá đơn vị (5/5)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 148 | Không có token | 401 / `00006` | PASS |
| 149 | Người dùng thường gọi API | 403 / `00017` | PASS |
| 150 | Thiếu `name` | 400 / `00123` | PASS |
| 151 | Đơn vị không tồn tại | 404 / `00125` | PASS |
| 152 | Xoá thành công | 200 / `00128`; DB không còn bản ghi | PASS |

Ghi chú nhóm Đơn vị:

- Cùng mô hình quyền với Danh mục: đọc mở cho tài khoản đã đăng nhập, ghi chỉ dành cho `admin`.
- Đặc tả không có mã riêng cho "tên mới đã tồn tại" khi sửa đơn vị; nhóm dùng `00113` ("Đã tồn tại đơn vị có tên này") và khai báo thành hằng `UNIT_UPDATE_NEW_NAME_EXISTS`.
- Việc tạo/sửa bắt lỗi trùng khoá `11000` của MongoDB để hai request đồng thời vẫn trả đúng `00113`/`00132` thay vì lỗi máy chủ.
- Model `Food` đã có (`name`, `categoryId`, `unitId`, `image`, `groupId`, `createdBy`) với unique index `{ groupId, name }`. Tuy nhiên `DELETE /admin/category` và `DELETE /admin/unit` **chưa chặn** xoá danh mục/đơn vị đang được thực phẩm tham chiếu — xem mục "Còn tồn tại".

### Nhóm API Thực phẩm (`tests/food.test.js`) — 47/47

#### `GET /it4788/food` — danh sách thực phẩm của nhóm (5/5)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 153 | Không có token | 401 / `00006` | PASS |
| 154 | Người dùng chưa vào nhóm | 403 / `00185` | PASS |
| 155 | Nhóm chưa có thực phẩm | 200 / `00188`, `data = []` | PASS |
| 156 | Có dữ liệu | 200 / `00188`; kèm `categoryName`/`unitName`, sắp xếp theo tên | PASS |
| 157 | Hai nhóm khác nhau | Chỉ trả thực phẩm của nhóm mình | PASS |

#### `GET /it4788/food/search` — tìm kiếm (6/6)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 158 | Không có token | 401 / `00006` | PASS |
| 159 | Người dùng chưa vào nhóm | 403 / `00185` | PASS |
| 160 | `keyword` khác hoa/thường | 200 / `00188`; lọc đúng tên | PASS |
| 161 | Lọc theo `categoryName` | 200 / `00188`; chỉ trả món của danh mục | PASS |
| 162 | Danh mục không tồn tại | 200 / `00188`, `data = []` | PASS |
| 163 | `keyword` chứa ký tự regex (`.*[(`) | 200 / `00188`; không lỗi truy vấn, `data = []` | PASS |

#### `POST /it4788/food` — tạo thực phẩm (14/14)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 164 | Không có token | 401 / `00006` | PASS |
| 165 | Body rỗng | 400 / `00147` | PASS |
| 166 | `foodName` rỗng | 400 / `00147` | PASS |
| 167 | `foodName` quá 100 ký tự | 400 / `00148` | PASS |
| 168 | Thiếu `categoryName` | 400 / `00149` | PASS |
| 169 | Thiếu `unitName` | 400 / `00150` | PASS |
| 170 | Người dùng chưa vào nhóm | 403 / `00156` | PASS |
| 171 | Đơn vị không tồn tại | 404 / `00153` | PASS |
| 172 | Danh mục không tồn tại | 404 / `00155` | PASS |
| 173 | Trùng tên trong nhóm (kể cả sau trim) | 409 / `00151`; DB không thêm bản ghi | PASS |
| 174 | Hợp lệ | 201 / `00160`; trim tên, gắn `groupId` + `createdBy` | PASS |
| 175 | Hai nhóm cùng tên thực phẩm | 201 / `00160`; cho phép | PASS |
| 176 | `multipart/form-data` với `image` | 201 / `00160`; ảnh lưu vào `uploads/foods/` | PASS |
| 177 | Tệp tải lên không phải ảnh | 400 / `00158` | PASS |

#### `PUT /it4788/food` — sửa thực phẩm (16/16)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 178 | Không có token | 401 / `00006` | PASS |
| 179 | Thiếu `foodName` | 400 / `00161` | PASS |
| 180 | `foodName` rỗng | 400 / `00161` | PASS |
| 181 | `foodName` quá 100 ký tự | 400 / `00162` | PASS |
| 182 | Không có trường cập nhật | 400 / `00163` | PASS |
| 183 | `newName` rỗng | 400 / `00166` | PASS |
| 184 | `newCategory` rỗng | 400 / `00164` | PASS |
| 185 | `newUnit` rỗng | 400 / `00165` | PASS |
| 186 | Thực phẩm không tồn tại | 404 / `00167` | PASS |
| 187 | Không phải người tạo/trưởng nhóm | 403 / `00167` | PASS |
| 188 | Đơn vị mới không tồn tại | 404 / `00169` | PASS |
| 189 | Danh mục mới không tồn tại | 404 / `00171` | PASS |
| 190 | Tên mới đã tồn tại | 409 / `00173`; bản ghi cũ giữ nguyên tên | PASS |
| 191 | Người tạo sửa tên + danh mục + đơn vị | 200 / `00178` | PASS |
| 192 | Trưởng nhóm sửa món của thành viên | 200 / `00178` | PASS |
| 193 | Chỉ cập nhật ảnh | 200 / `00178`; ảnh lưu vào `uploads/foods/` | PASS |

#### `DELETE /it4788/food` — xoá thực phẩm (6/6)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 194 | Không có token | 401 / `00006` | PASS |
| 195 | Thiếu `foodName` | 400 / `00179` | PASS |
| 196 | Thực phẩm không tồn tại | 404 / `00180` | PASS |
| 197 | Không phải người tạo/trưởng nhóm | 403 / `00181`; DB giữ nguyên bản ghi | PASS |
| 198 | Người tạo xoá món của mình | 200 / `00184`; DB không còn bản ghi | PASS |
| 199 | Trưởng nhóm xoá món của thành viên | 200 / `00184`; DB không còn bản ghi | PASS |

Ghi chú nhóm Thực phẩm:

- Tên thực phẩm unique **trong phạm vi nhóm** (`{ groupId, name }`), hai nhóm khác nhau dùng cùng tên bình thường; bắt lỗi `11000` để hai request đồng thời vẫn trả `00151`/`00173`.
- Quyền: mọi thành viên được tạo; **người tạo hoặc trưởng nhóm** được sửa/xoá (`00167`/`00181` cho người khác). Đây là quy ước của nhóm vì đặc tả gốc chỉ có mã lỗi mà không nói rõ ai được sửa/xoá.
- Chuỗi rỗng sau trim được xử lý là **thiếu trường** (`00147`/`00161`) để đồng nhất với Danh mục/Đơn vị; mã "tên không hợp lệ" (`00148`/`00162`) dùng cho tên quá dài.
- Ảnh thực phẩm lưu ở `server/uploads/foods/` và phục vụ qua `/it4788/uploads/foods/...`; `uploadFoodImage` ghi đường dẫn vào `req.body.image` trước bước validate nên request chỉ có ảnh vẫn cập nhật được.
- `GET /food/search` hỗ trợ `keyword`, `categoryName` và `inFridge` (`true`/`false` — lọc theo tủ lạnh của nhóm, [tài liệu 02](02-GOP-Y-DAC-TA-API.md) mục 3.1).

### Nhóm API Tủ lạnh (`tests/fridge.test.js`) — 53/53

#### `POST /it4788/fridge` — thêm thực phẩm vào tủ (15/15)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 200 | Không có token | 401 / `00006` | PASS |
| 201 | Body rỗng | 400 / `00190` | PASS |
| 202 | `foodName` rỗng | 400 / `00190` | PASS |
| 203 | `foodName` quá 100 ký tự | 400 / `00190` | PASS |
| 204 | Thiếu `useWithin` | 400 / `00191` | PASS |
| 205 | `useWithin` không phải ngày | 400 / `00191` | PASS |
| 206 | `quantity` = 0 hoặc không phải số | 400 / `00192` | PASS |
| 207 | `note` quá 500 ký tự | 400 / `00193` | PASS |
| 208 | Người dùng chưa vào nhóm | 403 / `00196` | PASS |
| 209 | Thực phẩm không tồn tại | 404 / `00194` | PASS |
| 210 | Thực phẩm thuộc nhóm khác | 403 / `00198` | PASS |
| 211 | Thực phẩm đã có trong tủ | 409 / `00199`; DB không thêm bản ghi | PASS |
| 212 | Hợp lệ | 201 / `00202`; lưu `quantity`, `useWithin`, `location`, `note`, `isNotified=false` | PASS |
| 213 | Tên / ghi chú có khoảng trắng | 201 / `00202`; được trim | PASS |
| 214 | Hai nhóm cùng tên thực phẩm của mình | 201 / `00202`; cho phép | PASS |

#### `GET /it4788/fridge` — danh sách đồ trong tủ (5/5)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 215 | Không có token | 401 / `00006` | PASS |
| 216 | Người dùng chưa vào nhóm | 403 / `00225` | PASS |
| 217 | Tủ chưa có gì | 200 / `00228`, `data = []` | PASS |
| 218 | Có dữ liệu | 200 / `00228`; kèm `foodName`/`categoryName`/`unitName`, sắp xếp theo `useWithin` | PASS |
| 219 | Hai nhóm khác nhau | Chỉ trả đồ trong tủ của nhóm mình | PASS |

#### `GET /it4788/fridge/item` — xem một mục (7/7)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 220 | Không có token | 401 / `00006` | PASS |
| 221 | Người dùng chưa vào nhóm | 403 / `00225` | PASS |
| 222 | Thiếu `foodName` | 400 / `00229` | PASS |
| 223 | Thực phẩm không tồn tại | 404 / `00230` | PASS |
| 224 | Thực phẩm thuộc nhóm khác | 403 / `00232` | PASS |
| 225 | Thực phẩm có nhưng chưa thêm vào tủ | 404 / `00234` | PASS |
| 226 | Mục tồn tại | 200 / `00237`; trả đúng số lượng, ghi chú | PASS |

#### `PUT /it4788/fridge` — sửa mục trong tủ (16/16)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 227 | Không có token | 401 / `00006` | PASS |
| 228 | Thiếu `itemId` | 400 / `00204` | PASS |
| 229 | `itemId` sai định dạng | 400 / `00204` | PASS |
| 230 | Không có trường cập nhật | 400 / `00204` | PASS |
| 231 | `newUseWithin` không hợp lệ | 400 / `00205` | PASS |
| 232 | `newQuantity` <= 0 hoặc không phải số | 400 / `00206` | PASS |
| 233 | `newNote` quá 500 ký tự | 400 / `00207` | PASS |
| 234 | `newFoodName` rỗng | 400 / `00207` | PASS |
| 235 | Người dùng chưa vào nhóm | 403 / `00210` | PASS |
| 236 | Mục trong tủ không tồn tại | 404 / `00213` | PASS |
| 237 | Mục thuộc nhóm khác | 403 / `00212` | PASS |
| 238 | Tên thực phẩm mới không có trong nhóm | 404 / `00214` | PASS |
| 239 | Thực phẩm mới đã có mục khác trong tủ | 409 / `00199` | PASS |
| 240 | Sửa số lượng + hạn + ghi chú + vị trí | 200 / `00216`; đặt lại `isNotified=false` | PASS |
| 241 | Đổi tên thực phẩm | 200 / `00216`; trả kèm danh mục/đơn vị mới | PASS |
| 242 | Xoá ghi chú / vị trí bằng chuỗi rỗng | 200 / `00216`; hai trường thành `null` | PASS |

#### `DELETE /it4788/fridge` — xoá mục trong tủ (6/6)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 243 | Không có token | 401 / `00006` | PASS |
| 244 | Thiếu `foodName` | 400 / `00217` | PASS |
| 245 | Thực phẩm không tồn tại | 404 / `00218` | PASS |
| 246 | Thực phẩm thuộc nhóm khác | 403 / `00219` | PASS |
| 247 | Thực phẩm chưa thêm vào tủ | 404 / `00221` | PASS |
| 248 | Xoá thành công | 200 / `00224`; các mục khác giữ nguyên | PASS |

#### Dọn dữ liệu liên quan (1/1)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 249 | Người cuối cùng rời nhóm | 200 / `00108`; đồ trong tủ lạnh của nhóm bị xoá | PASS |

#### Bộ lọc `inFridge` của `GET /it4788/food/search` (3/3)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 250 | `inFridge=true` | 200 / `00188`; chỉ thực phẩm đang có trong tủ | PASS |
| 251 | `inFridge=false` | 200 / `00188`; chỉ thực phẩm chưa có trong tủ | PASS |
| 252 | Xoá thực phẩm đang có trong tủ | 200 / `00184`; mục tủ lạnh tham chiếu cũng bị xoá | PASS |

Ghi chú nhóm Tủ lạnh:

- `useWithin` nhận chuỗi ISO 8601 và lưu vào `expiryDate` kiểu `Date` (theo đề xuất [tài liệu 02](02-GOP-Y-DAC-TA-API.md) mục 4.2); response trả lại `useWithin` để client dùng đúng tên trường của đặc tả.
- Trường `location` (ngăn mát / ngăn đá / cánh tủ / ngoài tủ) là bổ sung theo đề mục B.3 và [tài liệu 02](02-GOP-Y-DAC-TA-API.md) mục 3.6.
- Mỗi cặp `{ groupId, foodId }` là unique (`00199`); kiểm tra cả trước khi ghi lẫn bắt lỗi `11000` khi hai request đồng thời.
- Quyền: mọi thành viên trong nhóm được thêm/sửa/xoá mục tủ. Thực phẩm hoặc mục tủ thuộc nhóm khác bị từ chối bằng `00198`/`00212`/`00219`/`00232`.
- Đổi `useWithin` đặt lại `isNotified = false` để cron job nhắc hết hạn gửi lại theo hạn mới (docs/01 mục 6.3).
- `DELETE /food` xoá kèm các mục tủ lạnh tham chiếu để không còn bản ghi mồ côi; `GET /food/search` dùng `FridgeItem.distinct('foodId')` cho bộ lọc `inFridge`.

### Nhóm API Đi chợ (`tests/shopping.test.js`) — 81/81

#### `POST /it4788/shopping` — tạo danh sách đi chợ (13/13)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 253 | Không có token | 401 / `00006` | PASS |
| 254 | Thiếu `name` | 400 / `00239` | PASS |
| 255 | Thiếu `assignToUsername` | 400 / `00240` | PASS |
| 256 | `note` quá 500 ký tự | 400 / `00241` | PASS |
| 257 | `date` không hợp lệ | 400 / `00242` | PASS |
| 258 | Người dùng chưa vào nhóm | 403 / `00243` | PASS |
| 259 | Thành viên không phải trưởng nhóm | 403 / `00243` | PASS |
| 260 | Username được giao không tồn tại | 404 / `00245` | PASS |
| 261 | Người được giao thuộc nhóm khác | 403 / `00246` | PASS |
| 262 | Hợp lệ | 201 / `00249`; lưu `name`, `assignedTo`, `note`, `date`, `createdBy`, `groupId` | PASS |
| 263 | Tên / ghi chú có khoảng trắng | 201 / `00249`; được trim | PASS |
| 264 | Bỏ trống `note` / `date` | 201 / `00249`; hai trường thành `null` | PASS |
| 265 | Hai nhóm khác nhau tạo danh sách riêng | 201 / `00249`; cho phép | PASS |

#### `PUT /it4788/shopping` — sửa danh sách (15/15)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 266 | Không có token | 401 / `00006` | PASS |
| 267 | Thiếu `listId` | 400 / `00251` | PASS |
| 268 | Không có trường cập nhật | 400 / `00252` | PASS |
| 269 | `newName` rỗng | 400 / `00253` | PASS |
| 270 | `newAssignToUsername` rỗng | 400 / `00254` | PASS |
| 271 | `newNote` quá 500 ký tự | 400 / `00255` | PASS |
| 272 | `newDate` không hợp lệ | 400 / `00256` | PASS |
| 273 | Thành viên không phải trưởng nhóm | 403 / `00258` | PASS |
| 274 | Người dùng chưa vào nhóm | 403 / `00258` | PASS |
| 275 | Danh sách không tồn tại | 404 / `00260` | PASS |
| 276 | Danh sách thuộc nhóm khác | 403 / `00261` | PASS |
| 277 | Người được giao mới không tồn tại | 404 / `00262` | PASS |
| 278 | Giao cho người thuộc nhóm khác | 403 / `00263` | PASS |
| 279 | Sửa tên + người được giao + ghi chú + ngày | 200 / `00266` | PASS |
| 280 | Xoá ghi chú / bỏ ngày bằng `''` và `null` | 200 / `00266`; hai trường thành `null` | PASS |

#### `DELETE /it4788/shopping` — xoá danh sách (7/7)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 281 | Không có token | 401 / `00006` | PASS |
| 282 | Thiếu `listId` | 400 / `00268` | PASS |
| 283 | Thành viên không phải trưởng nhóm | 403 / `00270` | PASS |
| 284 | Người dùng chưa vào nhóm | 403 / `00270` | PASS |
| 285 | Danh sách không tồn tại | 404 / `00272` | PASS |
| 286 | Danh sách thuộc nhóm khác | 403 / `00273` | PASS |
| 287 | Xoá thành công | 200 / `00275`; xoá luôn các món bên trong | PASS |

#### `POST /it4788/shopping/task` — thêm món (13/13)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 288 | Không có token | 401 / `00006` | PASS |
| 289 | Thiếu `listId` | 400 / `00277` | PASS |
| 290 | Thiếu mảng `tasks` | 400 / `00278` | PASS |
| 291 | Mảng `tasks` rỗng | 400 / `00279` | PASS |
| 292 | Một món thiếu `foodName` | 400 / `00279` | PASS |
| 293 | `quantity` = 0 | 400 / `00279` | PASS |
| 294 | Thành viên không phải trưởng nhóm | 403 / `00281` | PASS |
| 295 | Danh sách không tồn tại | 404 / `00283` | PASS |
| 296 | Danh sách thuộc nhóm khác | 403 / `00284` | PASS |
| 297 | Thực phẩm không tồn tại trong nhóm | 404 / `00285` | PASS |
| 298 | Cùng thực phẩm lặp trong mảng gửi lên | 409 / `00285x`; DB không thêm bản ghi | PASS |
| 299 | Thực phẩm đã có trong danh sách | 409 / `00285x`; DB giữ 1 bản ghi | PASS |
| 300 | Thêm nhiều món hợp lệ | 201 / `00287`; kèm `foodName`, `unitName`, `isCompleted=false` | PASS |

#### `GET /it4788/shopping/task` — danh sách kèm món (6/6)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 301 | Không có token | 401 / `00006` | PASS |
| 302 | Người dùng chưa vào nhóm | 403 / `00288` | PASS |
| 303 | Nhóm chưa có danh sách | 200 / `00292`, `data = []` | PASS |
| 304 | Có dữ liệu | 200 / `00292`; sắp xếp theo ngày, kèm `tasks`, `taskCount`, `completedCount` | PASS |
| 305 | Hai nhóm khác nhau | Chỉ trả danh sách của nhóm mình | PASS |
| 306 | `GET /it4788/shopping` (API bổ sung) | 200 / `00292`; cùng dữ liệu với `/shopping/task` | PASS |

#### `DELETE /it4788/shopping/task` — xoá món (6/6)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 307 | Không có token | 401 / `00006` | PASS |
| 308 | Thiếu `taskId` | 400 / `00294` | PASS |
| 309 | Thành viên không phải trưởng nhóm | 403 / `00297` | PASS |
| 310 | Nhiệm vụ không tồn tại | 404 / `00296` | PASS |
| 311 | Nhiệm vụ thuộc nhóm khác | 404 / `00296` | PASS |
| 312 | Xoá thành công | 200 / `00299`; DB không còn bản ghi | PASS |

#### `PUT /it4788/shopping/task` — sửa món (11/11)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 313 | Không có token | 401 / `00006` | PASS |
| 314 | Thiếu `taskId` | 400 / `00301` | PASS |
| 315 | Không có trường cập nhật | 400 / `00302` | PASS |
| 316 | `newFoodName` rỗng | 400 / `00303` | PASS |
| 317 | `newQuantity` âm | 400 / `00304` | PASS |
| 318 | Thành viên không phải trưởng nhóm | 403 / `00307` | PASS |
| 319 | Nhiệm vụ không tồn tại | 404 / `00306` | PASS |
| 320 | Tên thực phẩm mới không tồn tại | 404 / `00308` | PASS |
| 321 | Thực phẩm mới đã có trong cùng danh sách | 409 / `00309` | PASS |
| 322 | Sửa tên + số lượng | 200 / `00312`; trả kèm đơn vị mới | PASS |
| 323 | Chỉ sửa số lượng | 200 / `00312`; tên giữ nguyên | PASS |

#### `PATCH /it4788/shopping/task/:taskId/complete` — đánh dấu đã mua (8/8)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 324 | Không có token | 401 / `00006` | PASS |
| 325 | Thiếu `isCompleted` | 400 / `00300` | PASS |
| 326 | `isCompleted` không phải boolean | 400 / `00300` | PASS |
| 327 | Người dùng chưa vào nhóm | 403 / `00288` | PASS |
| 328 | Nhiệm vụ không tồn tại | 404 / `00306` | PASS |
| 329 | Thành viên (không phải trưởng nhóm) tick đã mua | 200 / `00312`; `isCompleted=true` | PASS |
| 330 | Bỏ tick để mua lại | 200 / `00312`; `isCompleted=false` | PASS |
| 331 | `completedCount` sau khi tick | 200 / `00292`; `taskCount=1`, `completedCount=1` | PASS |

#### Dọn dữ liệu liên quan (2/2)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 332 | Xoá thực phẩm đang có trong danh sách | 200 / `00184`; món tham chiếu trong danh sách cũng bị xoá | PASS |
| 333 | Người cuối cùng rời nhóm | 200 / `00108`; danh sách đi chợ và món của nhóm bị xoá | PASS |

Ghi chú nhóm Đi chợ:

- Đặc tả gốc (file PDF mô tả API IT4788, thư mục `BTL/` ngoài repo) dùng body cho cả `DELETE`; nhóm giữ đúng đặc tả (body `{ listId }` / `{ taskId }`) và ghi góp ý ở [tài liệu 02](02-GOP-Y-DAC-TA-API.md) mục 2.6.
- Quyền: **trưởng nhóm** tạo/sửa/xoá danh sách và món; mọi thành viên xem danh sách của nhóm. API bổ sung `PATCH .../complete` cho phép mọi thành viên tick đã mua vì người đi chợ thường không phải trưởng nhóm.
- `date` / `note` không bắt buộc khi tạo: bảng mã chỉ có mã "thiếu tên" (`00239`) và "thiếu `assignToUsername`" (`00240`); mã `00242`/`00241` dùng khi hai trường này sai định dạng. `date = null` nghĩa là danh sách chưa chốt ngày.
- Ràng buộc `{ listId, foodId }` unique bảo đảm một món chỉ xuất hiện một lần trong danh sách (`00285x`/`00309`); bắt cả trường hợp trùng ngay trong mảng gửi lên.
- Xoá danh sách xoá luôn `Task` bên trong; `GET /shopping/task` gom nhiệm vụ theo danh sách và trả `taskCount` / `completedCount` để app hiển thị tiến độ.
- `PUT /shopping/task` nhận thêm `newQuantity` theo đề xuất [tài liệu 02](02-GOP-Y-DAC-TA-API.md) mục 1.4 (đặc tả gốc bỏ sót trường này).
- `middlewares/validate.middleware.js` được chỉnh để lỗi thiếu trường **bên trong mảng** (`tasks[0].foodName`) trả `00279` (mảng sai) thay vì `00278` (thiếu mảng).

### Nhóm API Bữa ăn (`tests/meal.test.js`) — 35/35

#### `POST /it4788/meal` — lập kế hoạch bữa ăn (10/10)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 334 | Không có token | 401 / `00006` | PASS |
| 335 | Body rỗng | 400 / `00313` | PASS |
| 336 | `foodName` rỗng | 400 / `00313` | PASS |
| 337 | Thiếu `timestamp` / `timestamp` sai định dạng | 400 / `00313` và `00315` | PASS |
| 338 | Tên bữa `chiều` | 400 / `00316` | PASS |
| 339 | Người dùng chưa vào nhóm | 403 / `00319` | PASS |
| 340 | Thành viên (không phải trưởng nhóm) lập kế hoạch | 403 / `00319` | PASS |
| 341 | Thực phẩm không tồn tại | 404 / `00317` | PASS |
| 342 | Thực phẩm thuộc nhóm khác | 404 / `00317` | PASS |
| 343 | Trưởng nhóm tạo hợp lệ; `"Sang"` chuẩn hoá thành `"sáng"` | 201 / `00322`; trả kèm `foodName`, `categoryName`, `unitName` | PASS |

#### `GET /it4788/meal` — lịch bữa ăn (5/5)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 344 | Không có token | 401 / `00006` | PASS |
| 345 | Người dùng chưa vào nhóm | 403 / `00345` | PASS |
| 346 | Danh sách đầy đủ, sắp theo ngày rồi sáng → trưa → tối | 200 / `00348` | PASS |
| 347 | `?date=` và `?from=&to=` lọc đúng ngày / khoảng ngày | 200 / `00348`; đúng số bản ghi | PASS |
| 348 | Không lộ kế hoạch của nhóm khác | 200 / `00348`; mảng rỗng | PASS |

#### `PUT /it4788/meal` — sửa kế hoạch bữa ăn (10/10)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 349 | Thiếu `planId` | 400 / `00332` | PASS |
| 350 | `planId` sai định dạng | 400 / `00332` | PASS |
| 351 | Không có trường nào để cập nhật | 400 / `00333` | PASS |
| 352 | `newFoodName` rỗng | 400 / `00334` | PASS |
| 353 | `newTimestamp` sai định dạng | 400 / `00335` | PASS |
| 354 | `newName` không hợp lệ | 400 / `00336` | PASS |
| 355 | Kế hoạch không tồn tại | 404 / `00337` | PASS |
| 356 | Thành viên (không phải trưởng nhóm) sửa | 403 / `00339` | PASS |
| 357 | Thực phẩm mới không tồn tại | 404 / `00341` | PASS |
| 358 | Cập nhật món, ngày và tên bữa | 200 / `00344`; dữ liệu đổi đúng | PASS |

#### `DELETE /it4788/meal` — xoá kế hoạch bữa ăn (5/5)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 359 | Thiếu `planId` | 400 / `00323` | PASS |
| 360 | `planId` sai định dạng | 400 / `00324` | PASS |
| 361 | Kế hoạch không tồn tại | 404 / `00325` | PASS |
| 362 | Thành viên (không phải trưởng nhóm) xoá | 403 / `00327` | PASS |
| 363 | Trưởng nhóm xoá | 200 / `00330`; trả lại dữ liệu vừa xoá | PASS |

#### `GET /it4788/meal/suggestion` — gợi ý món từ tủ lạnh (4/4)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 364 | Người dùng chưa vào nhóm | 403 / `00345` | PASS |
| 365 | Tủ lạnh trống | 200 / `00348`; mảng rỗng | PASS |
| 366 | Ưu tiên thực phẩm sắp hết hạn, bỏ qua mục đã hết hạn | 200 / `00348`; cà rốt (còn 1 ngày) đứng trước thịt bò (còn 5 ngày) | PASS |
| 367 | `?limit=1` | 200 / `00348`; đúng 1 gợi ý | PASS |

#### Dọn dữ liệu liên quan (1/1)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 368 | Xoá thực phẩm đang có trong kế hoạch bữa ăn / công thức | 200 / `00184`; kế hoạch và công thức tham chiếu cũng bị xoá | PASS |

Ghi chú nhóm Bữa ăn:

- Quyền: **chỉ trưởng nhóm** được lập / sửa / xoá kế hoạch bữa ăn (mã `00319`, `00339`, `00327`); mọi thành viên được xem lịch và gợi ý món.
- Tên bữa nhận cả có dấu và không dấu (`Sang`, `sang`, `sáng`) rồi chuẩn hoá về `sáng` / `trưa` / `tối` trước khi lưu, tránh lỗi gõ từ client.
- `GET /meal` hỗ trợ `?date=YYYY-MM-DD` cho màn hình một ngày và `?from=&to=` cho màn hình tuần; tham số ngày sai định dạng bị bỏ qua thay vì làm hỏng cả danh sách.
- `GET /meal/suggestion` (API bổ sung, [tài liệu 02](02-GOP-Y-DAC-TA-API.md) mục 3.2) lấy các mục còn hạn trong tủ, tìm công thức gắn với thực phẩm đó và sắp xếp theo hạn sử dụng gần nhất. Mục đã hết hạn bị loại khỏi gợi ý để không đề xuất thực phẩm không còn dùng được.
- Mỗi công thức chỉ gắn một `foodId` nên chưa xếp hạng được theo số nguyên liệu khớp; hướng mở rộng là thêm `ingredients[]` vào `recipes` (docs/01 mục 6.3).

### Nhóm API Công thức (`tests/recipe.test.js`) — 31/31

#### `POST /it4788/recipe` — thêm công thức (10/10)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 369 | Không có token | 401 / `00006` | PASS |
| 370 | Body rỗng | 400 / `00349` | PASS |
| 371 | `foodName` rỗng | 400 / `00349` | PASS |
| 372 | Tên công thức quá 200 ký tự | 400 / `00351` | PASS |
| 373 | Mô tả quá 2000 ký tự | 400 / `00352` | PASS |
| 374 | `htmlContent` sai kiểu | 400 / `00353` | PASS |
| 375 | Người dùng chưa vào nhóm | 403 / `00096` | PASS |
| 376 | Thực phẩm không tồn tại | 404 / `00354` | PASS |
| 377 | Thực phẩm thuộc nhóm khác | 404 / `00354` | PASS |
| 378 | Thành viên thường tạo hợp lệ | 201 / `00357`; lưu đúng `foodName`, mô tả, HTML | PASS |

#### `GET /it4788/recipe` — danh sách công thức (7/7)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 379 | Không có token | 401 / `00006` | PASS |
| 380 | Người dùng chưa vào nhóm | 403 / `00096` | PASS |
| 381 | Lấy toàn bộ công thức của nhóm | 200 / `00378` | PASS |
| 382 | `?foodName=` lọc theo tên món | 200 / `00378`; đúng công thức | PASS |
| 383 | `?foodId=` lọc theo id món (đặc tả gốc) | 200 / `00378`; đúng công thức | PASS |
| 384 | `foodId` sai định dạng / tên món không tồn tại | 200 / `00378`; mảng rỗng | PASS |
| 385 | Không lộ công thức của nhóm khác | 200 / `00378`; chỉ công thức của nhóm | PASS |

#### `PUT /it4788/recipe` — sửa công thức (10/10)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 386 | Thiếu `recipeId` | 400 / `00359` | PASS |
| 387 | `recipeId` sai định dạng | 400 / `00359` | PASS |
| 388 | Không có trường nào để cập nhật | 400 / `00360` | PASS |
| 389 | `newFoodName` rỗng | 400 / `00361` | PASS |
| 390 | `newDescription` rỗng | 400 / `00362` | PASS |
| 391 | `newHtmlContent` rỗng | 400 / `00363` | PASS |
| 392 | `newName` rỗng | 400 / `00364` | PASS |
| 393 | Công thức không tồn tại | 404 / `00365` | PASS |
| 394 | Thực phẩm mới không tồn tại | 404 / `00367` | PASS |
| 395 | Cập nhật món, tên, mô tả và HTML | 200 / `00370`; dữ liệu đổi đúng | PASS |

#### `DELETE /it4788/recipe` — xoá công thức (4/4)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 396 | Thiếu `recipeId` | 400 / `00371` | PASS |
| 397 | `recipeId` sai định dạng | 400 / `00372` | PASS |
| 398 | Công thức không tồn tại | 404 / `00373` | PASS |
| 399 | Xoá thành công | 200 / `00376`; trả lại dữ liệu vừa xoá | PASS |

Ghi chú nhóm Công thức:

- Quyền: mọi thành viên trong nhóm được thêm / sửa / xoá công thức (docs/01 mục 5); công thức của nhóm khác coi như không tồn tại (`00365`, `00373`).
- Đặc tả gốc dùng `?foodId=` cho `GET /recipe`; nhóm hỗ trợ thêm `?foodName=` cho đồng nhất với các API thực phẩm khác ([tài liệu 02](02-GOP-Y-DAC-TA-API.md) mục 2.5). Không truyền tham số thì trả toàn bộ công thức của nhóm.
- `htmlContent` được trả đầy đủ trong danh sách để màn hình chi tiết render trực tiếp bằng `react-native-render-html`.

### Thông báo đẩy & cron (`tests/push-notification.test.js`, `tests/expiry-checker.test.js`) — 19/19

#### `utils/pushNotification.js` — dựng và gửi message (11/11)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| P1 | Token Expo hợp lệ / không hợp lệ | Chỉ nhận `ExponentPushToken[...]` và `ExpoPushToken[...]` | PASS |
| P2 | Tính số ngày còn lại | Tính theo ngày UTC; mục quá hạn trả 0 | PASS |
| P3 | Một món sắp hết hạn | Body `Sữa tươi sẽ hết hạn sau 2 ngày!`, data có `itemIds` | PASS |
| P4 | Nhiều món + token trùng/không hợp lệ | Một message/token hợp lệ, body tóm tắt danh sách | PASS |
| P5 | Không có token hợp lệ | Không tạo message | PASS |
| P6 | Không có message | Không gọi `fetch` | PASS |
| P7 | Gửi thành công | Gọi đúng Expo endpoint, header JSON, đếm `sent` | PASS |
| P8 | 101 message | Chia 2 lô 100 + 1 | PASS |
| P9 | Ticket lỗi (`DeviceNotRegistered`) | `failed = 1`, không ném lỗi | PASS |
| P10 | HTTP 503 | `failed = 1`, ghi lỗi | PASS |
| P11 | Lỗi mạng | `failed = 1`, không làm sập cron | PASS |

#### `jobs/expiryChecker.job.js` — quét và đánh dấu (8/8)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| P12 | Khoảng quét mặc định | Từ 00:00 hôm nay tới hết ngày thứ 3 (UTC) | PASS |
| P13 | `EXPIRY_NOTIFY_DAYS` | Đọc env; giá trị sai dùng mặc định 3 | PASS |
| P14 | Chọn mục cần nhắc | Bỏ mục quá hạn, quá 4 ngày, đã nhắc; nhận hôm nay → +3 ngày | PASS |
| P15 | Gửi theo nhóm | Mỗi nhóm một thông báo tóm tắt, mỗi token một message | PASS |
| P16 | Nhóm chưa có deviceToken | Không gửi, không đánh dấu, đếm `groupsSkippedNoToken` | PASS |
| P17 | Gửi thất bại | Giữ `isNotified = false`, đếm `itemsFailed` | PASS |
| P18 | Chạy lần hai | Không gửi lại mục đã nhắc | PASS |
| P19 | Không có mục nào | Không gọi Expo, summary toàn 0 | PASS |

### Nhóm API Báo cáo (`tests/report.test.js`) — 24/24

#### Xác thực & khoảng thời gian (7/7)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| R1 | Không có token | 401 / `00006` | PASS |
| R2 | Người dùng chưa vào nhóm | 403 / `00385` | PASS |
| R3 | `from` sai định dạng (`2026/01/01`) | 400 / `00386` | PASS |
| R4 | Ngày không tồn tại (`2026-02-31`) | 400 / `00386` | PASS |
| R5 | `from` > `to` | 400 / `00386` | PASS |
| R6 | Khoảng dài hơn 366 ngày | 400 / `00386` | PASS |
| R7 | Không truyền `from` / `to` | Mặc định 30 ngày, `to` = hôm nay theo giờ Việt Nam | PASS |

#### `GET /report/shopping` — mua sắm (8/8)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| R8 | Chưa có dữ liệu | Summary toàn 0, chuỗi 30 ngày, mảng gộp rỗng | PASS |
| R9 | 1 danh sách + 2 món, tick 1 | `lists=1`, `items=2`, `completedItems=1`, `completionRate=0.5` | PASS |
| R10 | Chuỗi theo ngày | Hôm nay `lists=1`, `itemsCreated=2`, `itemsCompleted=1` | PASS |
| R11 | Gộp theo danh mục / người được giao | Đúng danh mục thực phẩm và username được giao | PASS |
| R12 | Dữ liệu của nhóm khác | Không lẫn sang báo cáo nhóm mình | PASS |
| R13 | Khoảng thời gian trong quá khứ | Không tính dữ liệu hôm nay | PASS |
| R14 | Tick / bỏ tick | `Task.completedAt` được đặt rồi xoá về `null` | PASS |

#### `GET /report/consumption` — tiêu thụ (3/3)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| R15 | Xoá mục còn hạn, không gửi `reason` | Ghi `FridgeEvent(action=consumed)`, báo cáo đúng số lượng / đơn vị / danh mục | PASS |
| R16 | Xoá mục đã hết hạn | Không nằm trong báo cáo tiêu thụ | PASS |
| R17 | Sự kiện của nhóm khác | Không lẫn sang báo cáo nhóm mình | PASS |

#### `GET /report/waste` — lãng phí (4/4)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| R18 | Xoá mục hết hạn | `items=1`, `quantity=2`, `byReason=expired`, `wasteRate=1` | PASS |
| R19 | Vừa tiêu thụ vừa bỏ đi | `wasteRate = 2 / (2 + 2) = 0.5` | PASS |
| R20 | Client gửi `reason=consumed` cho mục quá hạn | Ưu tiên lý do client, không tính vào lãng phí | PASS |
| R21 | `reason` không hợp lệ | 400 / `00226` | PASS |

#### `GET /report/fridge` — ảnh chụp tủ lạnh (2/2)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| R22 | 3 mục: hôm nay / quá hạn / tương lai | `totalItems=3`, `totalQuantity=7`, `expiringSoon=1`, `expired=1`; trạng thái `expiringSoon` / `expired` / `fresh`; gộp theo vị trí | PASS |
| R23 | Tủ của nhóm khác | Không lẫn sang báo cáo nhóm mình | PASS |

#### `GET /report/overview` — tổng hợp (1/1)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| R24 | Có dữ liệu mua sắm + tiêu thụ | Trả đủ `range`, `shopping`, `consumption`, `waste`, `fridge` với số liệu khớp báo cáo riêng | PASS |

## 4 vấn đề đã khắc phục

| # | Trước | Sau |
|---|---|---|
| 1 | `verify-email` thiếu `token` trả `00053` ("thiếu mã xác nhận") | `validate()` có thêm `missingByField`; thiếu `token` → `00055` |
| 2 | Gửi lại mã cho tài khoản đã xác minh trả `00048` ("mã đã được gửi") dù không gửi email | Trả `00058` ("email đã xác minh") + `user`; không gửi email |
| 3 | Không có rate limit cho đăng ký/đăng nhập/gửi mã/xác minh | `middlewares/rateLimit.middleware.js` (in-memory, theo IP), cấu hình `AUTH_RATE_LIMIT_WINDOW_MINUTES` / `AUTH_RATE_LIMIT_MAX`, vượt ngưỡng → 429 / `00024` + `Retry-After` |
| 4 | Logout với access token hợp lệ của user đã bị xoá vẫn trả `00050` | Trả `00052` (`USER_NOT_FOUND`) khi `matchedCount = 0` |

Ghi chú triển khai:

- Rate limit là **in-memory**, phù hợp 1 instance backend. Nếu deploy nhiều instance cần chuyển sang Redis để dùng chung bộ đếm.
- Cửa sổ/ngưỡng đọc lại mỗi request nên có thể chỉnh bằng env mà không cần sửa code; ngưỡng mặc định 20 request / 15 phút / IP.
- Vì chung một bộ đếm cho 4 endpoint auth, một client spam login cũng sẽ tạm chặn đăng ký — đúng mục tiêu chống brute force nhưng nên cân nhắc tách ngưỡng riêng nếu cần.

## Còn tồn tại (chưa khắc phục)

- `.env` hiện không có `JWT_VERIFY_SECRET` / `JWT_RESET_SECRET`, nên verification token và reset token dùng chung secret với access token (vẫn an toàn nhờ claim `typ`). Nên bổ sung secret riêng cho production.
- Rate limit chưa có test cho trường hợp nhiều IP khác nhau (cần giả lập `X-Forwarded-For` + `trust proxy`).
- `DELETE /admin/category` và `DELETE /admin/unit` chưa kiểm tra thực phẩm đang tham chiếu: xoá danh mục/đơn vị sẽ để lại `Food` trỏ tới id không còn tồn tại. Cần chặn (trả mã phù hợp) hoặc chuyển thực phẩm sang danh mục/đơn vị mặc định.

## Vấn đề môi trường đã xử lý

- **Mongoose ≥ 9.10 + Jest 30**: driver `mongodb` 7.6+ nạp module `os` bằng dynamic `import()`,
  bị Jest chặn, khiến handshake thiếu metadata và Mongo trả
  `Missing required sub-document 'driver' in the client metadata document`.
  Đã xử lý bằng `mongoose.connect(uri, { runtimeAdapters: { os } })` trong `beforeAll`.
  Tham khảo: [mongoose#16596](https://github.com/Automattic/mongoose/issues/16596).
- Lần chạy đầu tiên cần mạng để `mongodb-memory-server` tải binary MongoDB; các lần sau dùng cache
  trong `server/node_modules/.cache/mongodb-memory-server/`.
