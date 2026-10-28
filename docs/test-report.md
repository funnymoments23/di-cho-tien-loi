# Báo cáo kiểm thử — nhóm API Auth, Tài khoản, Nhóm, Danh mục, Đơn vị & Thực phẩm

- **Ngày chạy:** 28/10/2026 (bổ sung nhóm API Thực phẩm)
- **Phạm vi:** 6 endpoint Auth + 5 endpoint Tài khoản + 6 endpoint Nhóm + 4 endpoint Danh mục + 4 endpoint Đơn vị + 5 endpoint Thực phẩm (`server/src/routes/user.route.js`, `group.route.js`, `admin.route.js`, `food.route.js`) + endpoint health + rate limit
- **Công cụ:** Jest 30.5.2, Supertest 7.3.1, mongodb-memory-server 11.3.0
- **Môi trường:** Windows, Node.js v24.11.0, MongoDB in-memory 8.2.6
- **Kết quả:** **199/199 test PASS**, 7 test suite, ~13,5 giây (sau khi binary Mongo đã tải sẵn)

## Cách chạy

```bash
cd server
npm install          # lần đầu: tải thêm binary MongoDB (~77 MB) cho mongodb-memory-server
npm test             # jest --runInBand
```

Cấu hình: [`server/jest.config.js`](../server/jest.config.js), biến môi trường test ở
[`server/tests/setup-env.js`](../server/tests/setup-env.js), test suite ở
[`server/tests/auth.test.js`](../server/tests/auth.test.js),
[`server/tests/user.test.js`](../server/tests/user.test.js),
[`server/tests/group.test.js`](../server/tests/group.test.js),
[`server/tests/category.test.js`](../server/tests/category.test.js),
[`server/tests/unit.test.js`](../server/tests/unit.test.js),
[`server/tests/food.test.js`](../server/tests/food.test.js) và
[`server/tests/rate-limit.test.js`](../server/tests/rate-limit.test.js).

Đặc điểm bộ test:

- Dùng **MongoDB in-memory** nên không chạm vào DB thật, không cần `.env`, chạy được trên CI.
- **Mock `utils/email.js`** — không gửi email thật; mã 6 số lấy từ `mock.calls` để test luồng verify.
- `BCRYPT_ROUNDS=4` cho nhanh; JWT secret cố định trong `setup-env.js`.
- `User.deleteMany({})` + `Group.deleteMany({})` + `Category.deleteMany({})` + `Unit.deleteMany({})` + `Food.deleteMany({})` trước mỗi test → các test độc lập, không phụ thuộc thứ tự.
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
  Ảnh hiện lưu ở `server/uploads/avatars/` và phục vụ qua `/it4788/uploads/...`; khi deploy nên chuyển sang Cloudinary.
- Đổi mật khẩu **thu hồi refresh token** đang lưu để các phiên cũ không tiếp tục được; access token hiện tại vẫn dùng được tới khi hết hạn (1 giờ).
- `PUT /user/device-token` là API bổ sung (đặc tả gốc không có), chưa có mã response riêng nên dùng `00086`/`00025`.
- `DELETE /user` gỡ user khỏi nhóm trước khi xoá tài khoản: thành viên bị bỏ khỏi `members`, trưởng nhóm rời đi thì chuyển quyền cho thành viên còn lại (hoặc xoá nhóm nếu không còn ai). Các dữ liệu khác (danh sách mua sắm, tủ lạnh...) chưa dọn vì model chưa được xây dựng.

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
- `GET /food/search` hiện hỗ trợ `keyword` và `categoryName`; tham số `inFridge` trong [tài liệu 02](02-GOP-Y-DAC-TA-API.md) mục 3.1 sẽ bổ sung khi có model `FridgeItem`.

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

- `.env` hiện không có `JWT_VERIFY_SECRET`, nên verification token dùng chung secret với access token (vẫn an toàn nhờ claim `typ`). Nên bổ sung secret riêng cho production.
- Rate limit chưa có test cho trường hợp nhiều IP khác nhau (cần giả lập `X-Forwarded-For` + `trust proxy`).
- `DELETE /admin/category` và `DELETE /admin/unit` chưa kiểm tra thực phẩm đang tham chiếu: xoá danh mục/đơn vị sẽ để lại `Food` trỏ tới id không còn tồn tại. Cần chặn (trả mã phù hợp) hoặc chuyển thực phẩm sang danh mục/đơn vị mặc định.
- `GET /food/search` chưa lọc được `inFridge` vì nhóm API Tủ lạnh (model `FridgeItem`) chưa được xây dựng.

## Vấn đề môi trường đã xử lý

- **Mongoose ≥ 9.10 + Jest 30**: driver `mongodb` 7.6+ nạp module `os` bằng dynamic `import()`,
  bị Jest chặn, khiến handshake thiếu metadata và Mongo trả
  `Missing required sub-document 'driver' in the client metadata document`.
  Đã xử lý bằng `mongoose.connect(uri, { runtimeAdapters: { os } })` trong `beforeAll`.
  Tham khảo: [mongoose#16596](https://github.com/Automattic/mongoose/issues/16596).
- Lần chạy đầu tiên cần mạng để `mongodb-memory-server` tải binary MongoDB; các lần sau dùng cache
  trong `server/node_modules/.cache/mongodb-memory-server/`.
