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
- Model `User` ([user.models.js](../server/src/models/user.models.js)): email, mật khẩu, tên, username, avatar, giới tính, ngày sinh, ngôn ngữ, múi giờ, device token, xác minh email, refresh token, role (`user`/`admin`), `groupId`.
- **Nhóm API Auth** (`routes/user.route.js`): 6 endpoint chạy được trên Postman.
  - `POST /it4788/user` — đăng ký, gửi mã 6 số qua email (`00035`).
  - `POST /it4788/user/verify-email` — nhập `{ code, token }` (`00058`).
  - `POST /it4788/user/send-verification-code` — gửi lại mã (`00048`; tài khoản đã xác minh trả `00058`).
  - `POST /it4788/user/login` — trả `user` + access token 1h + refresh token 7 ngày (`00047`).
  - `POST /it4788/user/refresh-token` — rotate refresh token (`00065`).
  - `POST /it4788/user/logout` — yêu cầu Bearer token, thu hồi refresh token (`00050`).
  - Nền tảng: `utils/jwt.js` (2 secret, `typ` chống dùng lẫn token, lưu refresh token dạng SHA-256), `middlewares/auth.middleware.js`, `middlewares/validate.middleware.js` (Joi → mã lỗi của đề), `utils/email.js` (Nodemailer; thiếu SMTP ở dev thì in mã ra console).
  - Rate limit in-memory cho đăng ký / đăng nhập / gửi mã / xác minh email (`middlewares/rateLimit.middleware.js`), vượt ngưỡng trả `00024`.
- **Kiểm thử tự động nhóm API Auth**: 49 test (Jest + Supertest + MongoDB in-memory), chạy `npm test`.
- **Nhóm API Tài khoản** (`GET/PUT/DELETE /it4788/user`, `POST /it4788/user/change-password`, `PUT /it4788/user/device-token`) — xem chi tiết bên dưới.
  - `GET /user` — xem hồ sơ của chính mình (`00089`).
  - `PUT /user` — sửa `name`, `username`, `gender`, `birthday`, `language`, `timezone`, `avatar` (`00086`); nhận JSON hoặc `multipart/form-data` với ảnh ở field `image`; Joi loại bỏ `email`/`role`/`isVerified` nên không thể tự nâng quyền.
  - `DELETE /user` — xoá tài khoản (`00092`).
  - `POST /user/change-password` — kiểm tra mật khẩu cũ (`00072`), không trùng mật khẩu cũ (`00073`), thành công `00076` và thu hồi refresh token cũ.
  - `PUT /user/device-token` — cập nhật Expo push token (API bổ sung, xem [tài liệu 02](02-GOP-Y-DAC-TA-API.md) mục 3.4).
- **Nhóm API Nhóm gia đình** (`routes/group.route.js`): 6 endpoint.
  - `POST /user/group` — tạo nhóm với body `{ groupName }`, người tạo thành trưởng nhóm (`00095`; đã có nhóm `00093`, thiếu tên `00094`).
  - `GET /user/group` — xem nhóm và danh sách thành viên (`00098`; chưa vào nhóm `00096`).
  - `GET /user/group/info` — tên nhóm, trưởng nhóm, số thành viên (API bổ sung, mục 4.4 tài liệu 02).
  - `POST /user/group/add` — trưởng nhóm thêm thành viên bằng `username` (`00102`; thiếu username `00100`, không tồn tại/đã có nhóm `00099`, không phải trưởng nhóm `00101`).
  - `DELETE /user/group` — trưởng nhóm xoá thành viên bằng `username` (`00106`; thiếu username `00107`, không phải trưởng nhóm `00104`, người không thuộc nhóm `00103`, không xoá được trưởng nhóm `00105`).
  - `POST /user/group/leave` — thành viên tự rời nhóm; nếu trưởng nhóm rời thì tự chuyển quyền cho thành viên còn lại, người cuối cùng rời thì xoá nhóm (`00108`).
  - Nền tảng: model `Group` (`name`, `adminId`, `members`), middleware `groupAdmin`, serializer `toPublicGroup`; xoá tài khoản cũng gỡ user khỏi nhóm và chuyển quyền trưởng nhóm nếu cần.
- **Nhóm API Danh mục** (`routes/admin.route.js`, 4 endpoint) — danh mục dùng chung toàn hệ thống, do admin quản lý.
  - `GET /admin/category` — lấy danh sách danh mục (`00129`); mọi tài khoản đã đăng nhập đều xem được.
  - `POST /admin/category` — tạo danh mục với body `{ name }` (`00135`; thiếu tên `00131`, trùng tên `00132`).
  - `PUT /admin/category` — đổi tên với body `{ name, newName }` (`00141`; thiếu trường `00136`, trùng tên cũ `00137`, không tìm thấy `00138`, tên mới đã tồn tại `00138`).
  - `DELETE /admin/category` — xoá theo body `{ name }` (`00146`; thiếu tên `00142`, không tìm thấy `00143`).
- **Nhóm API Đơn vị đo** (`routes/admin.route.js`, 4 endpoint) — đơn vị đo dùng chung toàn hệ thống, do admin quản lý.
  - `GET /admin/unit` — lấy danh sách đơn vị (`00110`).
  - `POST /admin/unit` — tạo đơn vị với body `{ name }` (`00116`; thiếu tên `00112`, trùng tên `00113`).
  - `PUT /admin/unit` — đổi tên với body `{ name, newName }` (`00122`; thiếu trường `00117`, trùng tên cũ `00118`, không tìm thấy `00119`, tên mới đã tồn tại `00113`).
  - `DELETE /admin/unit` — xoá theo body `{ name }` (`00128`; thiếu tên `00123`, không tìm thấy `00125`).
  - Nền tảng: model `Category`/`Unit` (tên unique, trim, tối đa 50 ký tự), middleware `admin.middleware.js` (role `admin`, từ chối `00017`), serializer `toPublicLookup`.
- **Nhóm API Thực phẩm** (`routes/food.route.js`, 5 endpoint) — danh mục thực phẩm riêng của từng nhóm, tên duy nhất trong phạm vi nhóm.
  - `GET /food` — danh sách thực phẩm của nhóm, kèm `categoryName`/`unitName` (`00188`; chưa vào nhóm `00185`).
  - `GET /food/search` — tìm theo `keyword` (không phân biệt hoa/thường) và/hoặc `categoryName` (`00188`).
  - `POST /food` — tạo với body `{ foodName, categoryName, unitName }`, nhận JSON hoặc `multipart/form-data` với ảnh ở field `image` (`00160`; thiếu trường `00147`, tên không hợp lệ `00148`, thiếu danh mục `00149`, thiếu đơn vị `00150`, trùng tên `00151`, đơn vị không tồn tại `00153`, danh mục không tồn tại `00155`, chưa vào nhóm `00156`, ảnh lỗi `00158`).
  - `PUT /food` — sửa bằng `{ foodName, newName?, newCategory?, newUnit?, image? }` (`00178`; thiếu `foodName` `00161`, tên không hợp lệ `00162`, không có trường cập nhật `00163`, danh mục/đơn vị/tên mới không hợp lệ `00164`–`00166`, không tìm thấy hoặc không có quyền `00167`, đơn vị mới không tồn tại `00169`, danh mục mới không tồn tại `00171`, tên mới trùng `00173`).
  - `DELETE /food` — xoá theo body `{ foodName }` (`00184`; thiếu tên `00179`, không tìm thấy `00180`, không có quyền `00181`).
  - Quyền: mọi thành viên được tạo; chỉ người tạo hoặc trưởng nhóm được sửa/xoá. Ảnh lưu ở `server/uploads/foods/`, phục vụ qua `/it4788/uploads/foods/`.
- **Nhóm API Tủ lạnh** (`routes/fridge.route.js`, 5 endpoint) — thực phẩm đang có trong tủ của nhóm, mỗi thực phẩm chỉ một mục trong tủ.
  - `GET /fridge` — danh sách đồ trong tủ kèm tên/danh mục/đơn vị của thực phẩm, sắp xếp theo hạn sử dụng gần nhất (`00228`; chưa vào nhóm `00225`).
  - `GET /fridge/item?foodName=` — xem một mục theo tên thực phẩm (`00237`; thiếu tên `00229`, thực phẩm không tồn tại `00230`, thuộc nhóm khác `00232`, chưa có trong tủ `00234`).
  - `POST /fridge` — thêm với body `{ foodName, quantity, useWithin, location?, note? }` (`00202`; tên không hợp lệ `00190`, hạn không hợp lệ `00191`, số lượng không hợp lệ `00192`, ghi chú không hợp lệ `00193`, thực phẩm không tồn tại `00194`, chưa vào nhóm `00196`, thực phẩm thuộc nhóm khác `00198`, đã có trong tủ `00199`).
  - `PUT /fridge` — sửa bằng `{ itemId, newFoodName?, newUseWithin?, newQuantity?, newNote?, newLocation? }` (`00216`; thiếu `itemId`/không có trường cập nhật `00204`, hạn/số lượng/ghi chú/tên mới không hợp lệ `00205`–`00207`, chưa vào nhóm `00210`, mục thuộc nhóm khác `00212`, mục không tồn tại `00213`, tên mới không tồn tại `00214`).
  - `DELETE /fridge` — xoá theo body `{ foodName }` (`00224`; thiếu tên `00217`, thực phẩm không tồn tại `00218`, không có quyền `00219`, chưa có trong tủ `00221`).
  - Trường `location` (ngăn mát / ngăn đá / cánh tủ / ngoài tủ) là bổ sung theo đề mục B.3 ([tài liệu 02](02-GOP-Y-DAC-TA-API.md) mục 3.6). Đổi `useWithin` sẽ đặt lại `isNotified` để cron nhắc hết hạn gửi lại. Xoá thực phẩm cũng xoá mục tủ lạnh tham chiếu.
  - `GET /food/search` đã hỗ trợ thêm `inFridge=true|false`.
- **Kiểm thử tự động**: 252 test (Auth + Tài khoản + Nhóm + Danh mục + Đơn vị + Thực phẩm + Tủ lạnh + rate limit), hiện **252/252 pass** — xem [báo cáo kiểm thử](test-report.md).

### Chưa làm

- Các model còn lại (ShoppingList, Task, Recipe, MealPlan...), routes/controllers cho các nhóm API còn lại (Đi chợ, Bữa ăn, Công thức).
- API quên mật khẩu và các API bổ sung khác.
- Upload ảnh (đại diện, thực phẩm) hiện lưu trên đĩa server (`server/uploads/`, đã gitignore); khi deploy cần chuyển sang Cloudinary để không mất ảnh.
- Ứng dụng mobile và trang admin.

### Chạy server

```bash
cd server
npm install
# tạo server/.env gồm PORT và MONGODB_URI
npm run dev     # http://localhost:5000/it4788/health
```

### Chạy test

```bash
cd server
npm test        # 252 test API Auth + Tài khoản + Nhóm + Danh mục + Đơn vị + Thực phẩm + Tủ lạnh + rate limit, dùng MongoDB in-memory, không cần .env
```

## Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [01 – Kế hoạch & Kiến trúc](01-KE-HOACH-KIEN-TRUC.md) | Kiến trúc hệ thống, thiết kế database, cấu trúc thư mục, danh sách màn hình, lộ trình 8 tuần, phân công |
| [02 – Rà soát đặc tả API](02-GOP-Y-DAC-TA-API.md) | 16 lỗi phát hiện trong mô tả API của đề và đề xuất sửa đổi (phần tính điểm cộng) |
| [Báo cáo kiểm thử](test-report.md) | 252 test API Auth + Tài khoản + Nhóm + Danh mục + Đơn vị + Thực phẩm + Tủ lạnh: ma trận case, kết quả, phát hiện và cách chạy |

## Bắt đầu

Xem mục 10 của [tài liệu 01](docs/01-KE-HOACH-KIEN-TRUC.md).
