# Đi chợ tiện lợi

Bài tập lớn môn **IT4788 – Phát triển ứng dụng đa nền tảng**.

Ứng dụng di động đa nền tảng giúp quản lý danh sách đi chợ, theo dõi thực phẩm trong tủ lạnh,
nhắc nhở trước khi hết hạn, lên kế hoạch bữa ăn và lưu công thức nấu ăn — chia sẻ trong nhóm gia đình.

## Công nghệ

| Phần | Công nghệ |
|---|---|
| Mobile app | React Native + Expo + TypeScript |
| Backend | Node.js + Express + MongoDB (Mongoose) |
| Web admin | React + Vite + Ant Design |
| Lưu ảnh | Cloudinary |
| Push notification | Expo Push Notification Service |

## Cấu trúc kho mã

```
di-cho-tien-loi/
├── docs/        # tài liệu thiết kế
├── server/      # backend Node.js + Express      (đang làm)
├── mobile/      # ứng dụng React Native + Expo   (chưa khởi tạo)
└── admin/       # trang quản trị web             (chưa khởi tạo)
```

## Tiến độ

### Đã làm — backend (`server/`)

- Khởi tạo project Node.js (Express 5, Mongoose, Joi, JWT, bcryptjs, multer, node-cron, nodemailer).
- Kết nối MongoDB qua `MONGODB_URI` ([database.js](../server/src/config/database.js)); script kiểm tra kết nối `scripts/test-db.js`.
- Dựng `app.js` với CORS, parse JSON/urlencoded; endpoint `GET /it4788/health`.
- Khuôn response thống nhất `{ code, message, data }`:
  - `constants/responseCode.js`: bảng mã response (code 5 chữ số, HTTP status, message) theo đề.
  - `utils/response.js` (`sendSuccess`, `fail`) và `utils/AppError.js`.
  - `middlewares/error.middleware.js`: xử lý 404 và lỗi tập trung (kể cả JSON sai định dạng).
- Model `User` ([user.models.js](../server/src/models/user.models.js)): email, mật khẩu, tên, avatar, ngôn ngữ, múi giờ, device token, xác minh email, refresh token, role (`user`/`admin`), `groupId`.
- **Nhóm API Auth** (`routes/user.route.js`): 6 endpoint chạy được trên Postman.
  - `POST /it4788/user` — đăng ký, gửi mã 6 số qua email (`00035`).
  - `POST /it4788/user/verify-email` — nhập `{ code, token }` (`00058`).
  - `POST /it4788/user/send-verification-code` — gửi lại mã (`00048`).
  - `POST /it4788/user/login` — trả `user` + access token 1h + refresh token 7 ngày (`00047`).
  - `POST /it4788/user/refresh-token` — rotate refresh token (`00065`).
  - `POST /it4788/user/logout` — yêu cầu Bearer token, thu hồi refresh token (`00050`).
  - Nền tảng: `utils/jwt.js` (2 secret, `typ` chống dùng lẫn token, lưu refresh token dạng SHA-256), `middlewares/auth.middleware.js`, `middlewares/validate.middleware.js` (Joi → mã lỗi của đề), `utils/email.js` (Nodemailer; thiếu SMTP ở dev thì in mã ra console).

### Chưa làm

- Các model còn lại (Group, Food, ShoppingList, Recipe, MealPlan...), routes/controllers cho các nhóm API còn lại.
- API tài khoản (`GET/PUT/DELETE /user`, `change-password`), API nhóm, và các API bổ sung.
- Ứng dụng mobile và trang admin.

### Chạy server

```bash
cd server
npm install
# tạo server/.env gồm PORT và MONGODB_URI
npm run dev     # http://localhost:5000/it4788/health
```

## Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [01 – Kế hoạch & Kiến trúc](docs/01-KE-HOACH-KIEN-TRUC.md) | Kiến trúc hệ thống, thiết kế database, cấu trúc thư mục, danh sách màn hình, lộ trình 8 tuần, phân công |
| [02 – Rà soát đặc tả API](docs/02-GOP-Y-DAC-TA-API.md) | 16 lỗi phát hiện trong mô tả API của đề và đề xuất sửa đổi (phần tính điểm cộng) |

## Bắt đầu

Xem mục 10 của [tài liệu 01](docs/01-KE-HOACH-KIEN-TRUC.md).
