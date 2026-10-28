# Báo cáo kiểm thử — nhóm API Auth

- **Ngày chạy:** 28/10/2026
- **Phạm vi:** 6 endpoint Auth + endpoint health (`server/src/routes/user.route.js`)
- **Công cụ:** Jest 30.5.2, Supertest 7.3.1, mongodb-memory-server 11.3.0
- **Môi trường:** Windows, Node.js v24.11.0, MongoDB in-memory 8.2.6
- **Kết quả:** **45/45 test PASS**, 1 test suite, ~2,1 giây (sau khi binary Mongo đã tải sẵn)

## Cách chạy

```bash
cd server
npm install          # lần đầu: tải thêm binary MongoDB (~77 MB) cho mongodb-memory-server
npm test             # jest --runInBand
```

Cấu hình: [`server/jest.config.js`](../server/jest.config.js), biến môi trường test ở
[`server/tests/setup-env.js`](../server/tests/setup-env.js), test suite ở
[`server/tests/auth.test.js`](../server/tests/auth.test.js).

Đặc điểm bộ test:

- Dùng **MongoDB in-memory** nên không chạm vào DB thật, không cần `.env`, chạy được trên CI.
- **Mock `utils/email.js`** — không gửi email thật; mã 6 số lấy từ `mock.calls` để test luồng verify.
- `BCRYPT_ROUNDS=4` cho nhanh; JWT secret cố định trong `setup-env.js`.
- `User.deleteMany({})` trước mỗi test → các test độc lập, không phụ thuộc thứ tự.

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
| 12 | Tài khoản đã xác minh | 200, `alreadyVerified=true`, **không gửi email** | PASS |
| 13 | Tài khoản chưa xác minh | 200 / `00048`, `alreadyVerified=false`; mã + token mới verify được | PASS |

### `POST /it4788/user/verify-email` — xác minh email (9/9)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 14 | Thiếu `code` | 400 / `00053` | PASS |
| 15 | `code="abc123"` | 400 / `00054` | PASS |
| 16 | Thiếu `token` | 400 / `00053` (xem ghi chú 1) | PASS |
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

### `POST /it4788/user/logout` — đăng xuất (6/6)

| # | Case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 40 | Không có header `Authorization` | 401 / `00006` | PASS |
| 41 | Header sai scheme (`Token ...`) | 401 / `00006` | PASS |
| 42 | Access token rác | 401 / `00012` | PASS |
| 43 | Access token hết hạn | 401 / `00011` | PASS |
| 44 | Dùng refresh token làm Bearer token | 401 / `00012` | PASS |
| 45 | Logout hợp lệ | 200 / `00050`; refresh token bị thu hồi (`null` trong DB), dùng lại trả `00063` | PASS |

## Ghi chú & phát hiện

1. **`verify-email` thiếu `token` trả `00053` thay vì `00055`.** `validate()` dùng một `fallback`
   chung cho mọi trường thiếu, nên thiếu `token` bị coi là "thiếu mã xác nhận". Test đang ghi nhận
   đúng hành vi hiện tại; nếu muốn đúng đặc tả, cần cho `validate()` map riêng mã lỗi cho trường hợp
   thiếu từng field (ví dụ `missingByField`).
2. **`send-verification-code` với tài khoản đã xác minh** trả `00048` ("Mã đã được gửi đến email…")
   kèm `alreadyVerified: true`, trong khi thực tế không gửi email nào. Nên có message/mã riêng để
   client không hiển thị sai.
3. **Chưa có rate limit** cho login/register (đề có mã `00024 – Too many requests`). Chưa test vì
   chưa triển khai.
4. **Logout không kiểm tra user còn tồn tại**: access token hợp lệ của user đã bị xoá vẫn trả `00050`.
   Không nghiêm trọng nhưng nên biết.
5. `.env` hiện không có `JWT_VERIFY_SECRET`, nên verification token dùng chung secret với access token
   (code vẫn an toàn nhờ claim `typ`). Nên bổ sung secret riêng cho production.

## Vấn đề môi trường đã xử lý

- **Mongoose ≥ 9.10 + Jest 30**: driver `mongodb` 7.6+ nạp module `os` bằng dynamic `import()`,
  bị Jest chặn, khiến handshake thiếu metadata và Mongo trả
  `Missing required sub-document 'driver' in the client metadata document`.
  Đã xử lý bằng `mongoose.connect(uri, { runtimeAdapters: { os } })` trong `beforeAll`.
  Tham khảo: [mongoose#16596](https://github.com/Automattic/mongoose/issues/16596).
- Lần chạy đầu tiên cần mạng để `mongodb-memory-server` tải binary MongoDB; các lần sau dùng cache
  trong `server/node_modules/.cache/mongodb-memory-server/`.
