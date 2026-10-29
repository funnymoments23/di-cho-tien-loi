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
- **Nhóm API Đi chợ** (`routes/shopping.route.js`, 8 endpoint) — danh sách đi chợ của nhóm và các món cần mua; trưởng nhóm tạo/sửa/xoá, mọi thành viên xem và tick đã mua.
  - `POST /shopping` — trưởng nhóm tạo danh sách với `{ name, assignToUsername, note?, date? }` (`00249`; thiếu tên `00239`, thiếu người được giao `00240`, ghi chú/ngày sai định dạng `00241`/`00242`, không phải trưởng nhóm `00243`, username không tồn tại `00245`, người được giao thuộc nhóm khác `00246`).
  - `PUT /shopping` — sửa `{ listId, newName?, newAssignToUsername?, newNote?, newDate? }` (`00266`; thiếu `listId` `00251`, không có trường cập nhật `00252`, tên/người được giao/ghi chú/ngày mới sai `00253`–`00256`, không phải trưởng nhóm `00258`, danh sách không tồn tại `00260`, thuộc nhóm khác `00261`, người được giao mới không tồn tại `00262`, khác nhóm `00263`).
  - `DELETE /shopping` — xoá danh sách theo `{ listId }` và xoá luôn các món bên trong (`00275`; thiếu `listId` `00268`, không phải trưởng nhóm `00270`, không tìm thấy `00272`, thuộc nhóm khác `00273`).
  - `POST /shopping/task` — thêm mảng `{ listId, tasks: [{ foodName, quantity }] }` (`00287`; thiếu `listId` `00277`, thiếu mảng `00278`, mảng sai `00279`, không phải trưởng nhóm `00281`, danh sách không tồn tại `00283`, thuộc nhóm khác `00284`, thực phẩm không có `00285`, trùng món `00285x`).
  - `GET /shopping/task` (và `GET /shopping`) — danh sách đi chợ của nhóm kèm món, số món và số món đã mua (`00292`; chưa vào nhóm `00288`).
  - `PUT /shopping/task` — sửa `{ taskId, newFoodName?, newQuantity? }` (`00312`; thiếu `taskId` `00301`, không có trường cập nhật `00302`, tên/số lượng mới sai `00303`/`00304`, không phải trưởng nhóm `00307`, món/thực phẩm không tồn tại `00306`/`00308`, trùng món `00309`).
  - `DELETE /shopping/task` — xoá món theo `{ taskId }` (`00299`; thiếu `taskId` `00294`, không phải trưởng nhóm `00297`, không tìm thấy `00296`).
  - `PATCH /shopping/task/:taskId/complete` — API bổ sung đánh dấu đã mua với `{ isCompleted }` (`00312`; mọi thành viên trong nhóm đều tick được — [tài liệu 02](02-GOP-Y-DAC-TA-API.md) mục 3.5).
  - Nền tảng: model `ShoppingList` (`name`, `groupId`, `assignedTo`, `note`, `date`, `createdBy`) và `Task` (`listId`, `foodId`, `quantity`, `isCompleted`), unique `{ listId, foodId }`; serializer `toPublicShoppingList`/`toPublicTask`.
- **Nhóm API Bữa ăn** (`routes/meal.route.js`, 5 endpoint) — lịch bữa ăn sáng/trưa/tối của nhóm; chỉ trưởng nhóm lập/sửa/xoá.
  - `GET /meal` — lịch bữa ăn, lọc `?date=YYYY-MM-DD` hoặc `?from=&to=` (`00348`; chưa vào nhóm `00345`).
  - `GET /meal/suggestion` — gợi ý món từ thực phẩm còn hạn trong tủ, ưu tiên món sắp hết hạn (API bổ sung, [tài liệu 02](02-GOP-Y-DAC-TA-API.md) mục 3.2).
  - `POST /meal` — `{ foodName, timestamp, name }` (`00322`; thiếu trường `00313`, tên món/bữa sai `00314`/`00316`, ngày sai `00315`, thực phẩm không tồn tại `00317`, không phải trưởng nhóm `00319`).
  - `PUT /meal` — `{ planId, newFoodName?, newTimestamp?, newName? }` (`00344`; thiếu `planId` `00332`, không có trường cập nhật `00333`, trường mới sai `00334`–`00336`, không tìm thấy `00337`, không phải trưởng nhóm `00339`, thực phẩm mới không tồn tại `00341`).
  - `DELETE /meal` — `{ planId }` (`00330`; thiếu `planId` `00323`, sai định dạng `00324`, không tìm thấy `00325`, không phải trưởng nhóm `00327`).
  - Nền tảng: model `MealPlan` (`groupId`, `foodId`, `timestamp`, `name`), index `{ groupId, timestamp }`; tên bữa được chuẩn hoá về `sáng`/`trưa`/`tối`.
- **Nhóm API Công thức** (`routes/recipe.route.js`, 4 endpoint) — công thức nấu ăn gắn với thực phẩm của nhóm; mọi thành viên quản lý.
  - `GET /recipe` — danh sách công thức, lọc `?foodId=` (đặc tả) hoặc `?foodName=` (`00378`; chưa vào nhóm `00096`).
  - `POST /recipe` — `{ foodName, name, description, htmlContent }` (`00357`; thiếu trường `00349`, tên/mô tả/HTML sai `00351`–`00353`, thực phẩm không tồn tại `00354`).
  - `PUT /recipe` — `{ recipeId, newFoodName?, newName?, newDescription?, newHtmlContent? }` (`00370`; thiếu `recipeId` `00359`, không có trường cập nhật `00360`, trường mới sai `00361`–`00364`, không tìm thấy `00365`, thực phẩm mới không tồn tại `00367`).
  - `DELETE /recipe` — `{ recipeId }` (`00376`; thiếu `recipeId` `00371`, sai định dạng `00372`, không tìm thấy `00373`).
  - Nền tảng: model `Recipe` (`foodId`, `groupId`, `name`, `description`, `htmlContent`), serializer `toPublicRecipe`; xoá thực phẩm hoặc xoá nhóm cũng dọn kế hoạch bữa ăn / công thức liên quan.
- **Nhóm API Báo cáo** (`routes/report.route.js`, 5 endpoint) — thống kê theo đề mục B.6, ghi nhận dữ liệu theo hướng "sự kiện tối thiểu" (phương án B).
  - `GET /report/overview?from=&to=` — gộp số liệu mua sắm / tiêu thụ / lãng phí / tủ lạnh trong một request (`00380`; chưa vào nhóm `00385`, khoảng ngày sai `00386`).
  - `GET /report/shopping?from=&to=` — số danh sách, số món, số món đã mua, tỉ lệ hoàn thành, chuỗi theo ngày, theo danh mục và người được giao (`00381`).
  - `GET /report/consumption?from=&to=` — thực phẩm dùng hết trước hạn, theo ngày / thực phẩm / danh mục (`00382`).
  - `GET /report/waste?from=&to=` — thực phẩm hết hạn hoặc bị bỏ, tỉ lệ lãng phí trên tổng lượng đã xử lý (`00383`).
  - `GET /report/fridge` — ảnh chụp tủ hiện tại: tổng món, sắp hết hạn, đã hết hạn, theo vị trí / danh mục (`00384`).
  - Nền tảng: thêm `Task.completedAt` (đặt khi tick, xoá khi bỏ tick) và model `FridgeEvent` ghi lại mỗi lần xoá mục khỏi tủ với `action` `consumed` / `expired` / `discarded`. `DELETE /fridge` nhận thêm `reason` tuỳ chọn (`00226`); không gửi thì suy ra theo hạn sử dụng (còn hạn → tiêu thụ, quá hạn → lãng phí).
  - Quy ước báo cáo: `from` / `to` dạng `YYYY-MM-DD`, mặc định 30 ngày gần nhất, tối đa 366 ngày, tính ngày theo giờ Việt Nam; mọi số liệu giới hạn trong nhóm của người đang đăng nhập. Lịch sử tiêu thụ / lãng phí chỉ có từ thời điểm bật tính năng — dữ liệu xoá trước đó không tái tạo được.
- **Nhắc thực phẩm sắp hết hạn** (`jobs/expiryChecker.job.js`, `utils/pushNotification.js`) — cron chạy 08:00 mỗi ngày (giờ Việt Nam).
  - Quét `fridgeitems` có `isNotified = false` và `expiryDate` trong 3 ngày tới (đổi bằng `EXPIRY_NOTIFY_DAYS`).
  - Gom theo nhóm, gửi một thông báo tóm tắt qua Expo Push tới mọi `deviceToken` của thành viên; chia lô 100 message/request.
  - Chỉ đánh dấu `isNotified = true` khi gửi thành công ít nhất một thiết bị; nhóm chưa có token hoặc lỗi mạng sẽ được thử lại lần sau. Sửa `useWithin` đặt lại cờ để nhắc lại.
  - Chạy thử thủ công: `npm run expiry:check`; cấu hình `EXPO_PUSH_URL`, `EXPO_ACCESS_TOKEN`, `EXPIRY_CRON_SCHEDULE`, `EXPIRY_CRON_TIMEZONE`, `EXPIRY_NOTIFY_DAYS` trong `.env`.
- **Kiểm thử tự động**: 442 test (Auth + Tài khoản + Nhóm + Danh mục + Đơn vị + Thực phẩm + Tủ lạnh + Đi chợ + Bữa ăn + Công thức + Báo cáo + rate limit + cron/push), hiện **442/442 pass** — xem [báo cáo kiểm thử](test-report.md).

### Chưa làm

- API quên mật khẩu.
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
npm test        # 442 test API Auth + Tài khoản + Nhóm + Danh mục + Đơn vị + Thực phẩm + Tủ lạnh + Đi chợ + Bữa ăn + Công thức + Báo cáo + rate limit + cron/push, dùng MongoDB in-memory, không cần .env
```

## Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [01 – Kế hoạch & Kiến trúc](01-KE-HOACH-KIEN-TRUC.md) | Kiến trúc hệ thống, thiết kế database, cấu trúc thư mục, danh sách màn hình, lộ trình 8 tuần, phân công |
| [02 – Rà soát đặc tả API](02-GOP-Y-DAC-TA-API.md) | 16 lỗi phát hiện trong mô tả API của đề và đề xuất sửa đổi (phần tính điểm cộng) |
| [Báo cáo kiểm thử](test-report.md) | 442 test API Auth + Tài khoản + Nhóm + Danh mục + Đơn vị + Thực phẩm + Tủ lạnh + Đi chợ + Bữa ăn + Công thức + Báo cáo + cron/push: ma trận case, kết quả, phát hiện và cách chạy |

## Bắt đầu

Xem mục 10 của [tài liệu 01](docs/01-KE-HOACH-KIEN-TRUC.md).
