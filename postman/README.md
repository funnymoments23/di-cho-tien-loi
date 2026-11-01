# Postman collection — Đi chợ tiện lợi

Bộ request Postman cho toàn bộ API backend (Express + MongoDB) của dự án.

| File | Mô tả |
|---|---|
| `DiChoTienLoi.postman_collection.json` | 76 request, chia 11 thư mục theo module |
| `DiChoTienLoi.postman_environment.json` | Biến môi trường: `baseUrl`, tài khoản test, id, token… |

## 1. Import

1. Mở Postman → **Import** → chọn cả hai file JSON ở trên.
2. Góc phải trên chọn environment **Đi chợ tiện lợi — Local**.
3. Sửa biến `baseUrl` cho khớp `PORT` trong `server/.env`:

   ```
   http://localhost:5001/it4788
   ```

   (`server/.env.example` ghi 5000, nhưng file `.env` hiện tại dùng 5001.)

## 2. Chuẩn bị dữ liệu

```bash
cd server
node scripts/seed-sample-data.js   # tạo sẵn danh mục "Thịt", đơn vị "kg", thực phẩm mẫu
node scripts/seed-admin.js         # tạo tài khoản admin từ ADMIN_* trong .env (cho thư mục 10)
npm run dev
```

Tài khoản test phải **đã xác minh email** thì `POST /user/login` mới thành công
(nếu chưa, chạy lần lượt *Đăng ký → Xác minh email* hoặc dùng tài khoản do
`seed-sample-data.js` tạo).

## 3. Thứ tự chạy đề xuất

Chạy theo thư mục 00 → 10. Các request tạo mới có script tự lưu id/token vào biến,
nên không phải copy tay.

```
00. Health          → kiểm tra server sống
01. Auth            → Đăng ký → Xác minh email → Đăng nhập  (token tự lưu)
02. Tài khoản       → xem / sửa hồ sơ
03. Nhóm            → Tạo nhóm  (groupId tự lưu) — nhiều API sau yêu cầu đã vào nhóm
04. Thực phẩm       → Tạo thực phẩm  (foodId tự lưu)
05. Tủ lạnh         → Thêm vào tủ  (fridgeItemId tự lưu)
06. Đi chợ          → Tạo danh sách → Thêm món → Tick đã mua
07. Bữa ăn          → Xếp món → Gợi ý món từ tủ
08. Công thức       → Tạo công thức cho thực phẩm
09. Báo cáo         → 4 báo cáo + ảnh chụp tủ
10. Quản trị        → cần đăng nhập bằng tài khoản admin
```

Các request **xoá** và **đổi mật khẩu** nên chạy sau cùng vì làm thay đổi dữ liệu/token.

## 4. Biến tự động lưu

| Request | Biến được lưu |
|---|---|
| Đăng ký | `verificationToken` |
| Đăng nhập | `accessToken`, `refreshToken`, `userId` |
| Làm mới token | `accessToken`, `refreshToken` |
| Quên mật khẩu | `resetToken` |
| Tạo nhóm | `groupId` |
| Tạo thực phẩm | `foodId` |
| Thêm vào tủ | `fridgeItemId` |
| Tạo danh sách đi chợ | `listId` |
| Thêm món | `taskId` |
| Xếp món vào bữa | `mealPlanId` |
| Tạo công thức | `recipeId` |

Các biến còn lại (`email`, `password`, `code`, `username`, `foodName`,
`categoryName`, `unitName`…) sửa trực tiếp trong environment.

## 5. Quy ước của API

- Response luôn có dạng:

  ```json
  { "code": "00188", "message": "...", "data": ... }
  ```

  Mã thành công/lỗi chính được ghi trong phần **Description** của từng request.
- Mọi API (trừ health, đăng ký, đăng nhập, refresh, quên/đặt lại mật khẩu,
  gửi/xác minh mã) đều cần header `Authorization: Bearer {{accessToken}}`.
  Collection đã đặt auth ở cấp collection; các API công khai được override `No Auth`.
- `GET` có `page`/`limit` trả `data = { items, total, page, limit, totalPages }`;
  không gửi `page`/`limit` thì `data` là mảng (giữ tương thích client cũ).
- Một số API có hai biến thể: xoá bằng **body** (đặc tả gốc) và xoá bằng
  **path param** (khuyến nghị). Cả hai đều có trong collection.
- `POST/PUT /food` và `PUT /user` nhận JSON hoặc `multipart/form-data`
  (field file là `image`). Muốn thử upload: tab **Body** → **form-data**.

## 6. Chạy tự động (tuỳ chọn)

```bash
npx newman run postman/DiChoTienLoi.postman_collection.json \
  -e postman/DiChoTienLoi.postman_environment.json \
  --folder "04. Thực phẩm"
```

Cần đăng nhập trước để có `accessToken` trong environment (newman không lưu biến
giữa các lần chạy trừ khi dùng `--export-environment`).
