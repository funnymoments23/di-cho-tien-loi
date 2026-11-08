# Web quản trị — Đi chợ tiện lợi

Trang quản trị dành cho tài khoản `role = admin`, dùng **React 18 + Vite + TypeScript + Ant Design 5**.

## Chức năng

| Màn hình | Việc làm được | API |
|---|---|---|
| Đăng nhập | Đăng nhập bằng email/mật khẩu, chặn tài khoản không phải admin, tự refresh token | `POST /user/login`, `GET /user`, `POST /user/refresh-token` |
| Tổng quan | Số người dùng, danh mục, đơn vị, bản ghi nhật ký; 5 thao tác gần nhất; trạng thái kết nối API | `GET /admin/user`, `/admin/category`, `/admin/unit`, `/admin/logs` |
| Người dùng | Tìm theo tên/email/username, lọc vai trò – trạng thái – xác minh; sửa hồ sơ, vai trò, xác minh; khoá/mở khoá; xoá | `GET/PUT/DELETE /admin/user`, `PATCH /admin/user/:id/status` |
| Danh mục | Thêm, đổi tên, xoá danh mục thực phẩm dùng chung | `GET/POST/PUT /admin/category`, `DELETE /admin/category/:name` |
| Đơn vị đo | Thêm, đổi tên, xoá đơn vị đo dùng chung | `GET/POST/PUT /admin/unit`, `DELETE /admin/unit/:name` |
| Nhật ký | Lọc theo hành động, đối tượng, khoảng ngày, userId; phân trang | `GET /admin/logs` |

Các quy tắc phía server vẫn được giữ nguyên trên giao diện:

- Không tự đổi quyền, tự khoá hoặc tự xoá tài khoản đang đăng nhập (nút bị vô hiệu hoá).
- Không xoá danh mục/đơn vị đang được thực phẩm sử dụng — server trả lỗi và giao diện hiển thị nguyên văn thông điệp.
- Tài khoản bị khoá hoặc bị đổi quyền sẽ được đăng xuất khỏi web ở request kế tiếp.

## Chạy dự án

```bash
cd admin
npm install
copy .env.example .env      # Windows
# cp .env.example .env      # macOS / Linux
npm run dev                 # http://localhost:5173
```

`admin/.env`:

```env
# Địa chỉ backend đã gồm prefix /it4788.
VITE_API_URL=http://localhost:5000/it4788
```

Nếu `server/.env` dùng cổng khác (ví dụ `PORT=5001`) thì sửa `VITE_API_URL` tương ứng.

Tạo tài khoản admin ở backend:

```bash
cd ../server
npm run seed:admin
```

Tài khoản lấy theo `ADMIN_EMAIL` / `ADMIN_PASSWORD` trong `server/.env`.

## Build

```bash
npm run build      # kiểm tra TypeScript + đóng gói vào dist/
npm run preview    # xem bản build
npm run typecheck  # chỉ kiểm tra kiểu
```

Khi deploy, đặt biến môi trường `VITE_API_URL` trỏ tới backend production (ví dụ `https://<ten-service>.onrender.com/it4788`) rồi build lại. Vì Vite nhúng biến môi trường lúc build, đổi biến sau khi build sẽ không có tác dụng.

Vì ứng dụng dùng `BrowserRouter`, máy chủ tĩnh cần rewrite mọi đường dẫn về `index.html` (SPA fallback). Với Nginx: `try_files $uri $uri/ /index.html;`; với Render Static Site: rewrite `/*` → `/index.html`.

## Cấu trúc

```
admin/
├── src/
│   ├── api/            # axios client + các hàm gọi API
│   │   ├── client.ts   # interceptor Bearer token, tự refresh khi 00011/00012
│   │   ├── auth.api.ts
│   │   ├── adminUser.api.ts
│   │   ├── category.api.ts
│   │   ├── unit.api.ts
│   │   └── log.api.ts
│   ├── components/     # AppLayout, ProtectedRoute, PageHeader, LookupManager
│   ├── pages/          # Login, Dashboard, Users, Categories, Units, Logs
│   ├── store/          # AuthContext (phiên đăng nhập)
│   ├── types/          # kiểu dữ liệu dùng chung
│   ├── utils/          # token store, format ngày, lấy thông điệp lỗi
│   └── config/env.ts
├── .env.example
├── index.html
└── vite.config.ts
```

## Xử lý phiên đăng nhập

- Access token và refresh token lưu trong `localStorage` (khoá `dctl.admin.*`).
- Khi API trả `00011` / `00012`, interceptor gọi `POST /user/refresh-token` một lần rồi phát lại request cũ; nhiều request đồng thời dùng chung một lần refresh.
- Refresh thất bại, tài khoản bị khoá (`00403`) → xoá phiên và chuyển về trang đăng nhập kèm thông báo.
- Mở lại trang: gọi `GET /user` để xác minh token và kiểm tra lại `role === 'admin'`.
