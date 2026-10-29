# Rà soát đặc tả API — Lỗi phát hiện & Đề xuất sửa đổi

**Môn học:** IT4788 – Phát triển ứng dụng đa nền tảng
**Đề tài:** Ứng dụng "Đi chợ tiện lợi"
**Tài liệu dành cho:** giảng viên hướng dẫn và nhóm phát triển
**Căn cứ:** Đề bài mục A — *"nếu các nhóm phát hiện các vấn đề / lỗi trong mô tả API này và đề xuất sửa đổi thì cũng được tính điểm cộng"*

---

## Tóm tắt

Nhóm đã rà soát toàn bộ **bảng 200+ mã response** và **bảng 50 endpoint** trong tài liệu đặc tả API. Kết quả phát hiện **16 vấn đề**, chia làm ba mức độ:

| Mức | Số lượng | Bản chất |
|---|---|---|
| **Nghiêm trọng** — API không thể hoạt động đúng như mô tả | 4 | Sai Content-Type khi upload file, Logout không có xác thực, thiếu trường trong body, tạo nhóm không có tên |
| **Trung bình** — gây khó khăn khi triển khai, cần thống nhất | 6 | Mã response trùng lặp, đặt tên tham số không nhất quán, DELETE mang body |
| **Thiếu sót** — đề bài yêu cầu nhưng đặc tả API không có | 6 | Tìm kiếm, gợi ý món ăn, thống kê, cập nhật device token, hoàn thành task, vị trí lưu trữ |

---

## Phần 1 — Lỗi nghiêm trọng

### 1.1 Upload ảnh nhưng Content-Type là `x-www-form-urlencoded` ❗

**Vị trí:** ba endpoint `Create food`, `Update food`, `Edit user`

Cả ba đều khai báo body chứa `'image': File` nhưng Content-Type ghi là `application/x-www-form-urlencoded`.

**Vấn đề:** `application/x-www-form-urlencoded` chỉ mã hoá được cặp khoá–giá trị dạng chuỗi (`key=value&key2=value2`). Nó **không thể truyền dữ liệu nhị phân của file**. Với định dạng này, server sẽ không bao giờ nhận được ảnh — đúng như mã lỗi `00158` "đăng tải ảnh thất bại" mô tả.

**Đề xuất sửa:**

| Endpoint | Content-Type hiện tại | Content-Type đúng |
|---|---|---|
| `POST /food` | `application/x-www-form-urlencoded` | **`multipart/form-data`** |
| `PUT /food` | `application/x-www-form-urlencoded` | **`multipart/form-data`** |
| `PUT /user` | `application/x-www-form-urlencoded` | **`multipart/form-data`** |

Phía server dùng `multer` để nhận file; phía React Native dùng `FormData` với `expo-image-picker`.

---

### 1.2 `Logout` khai báo "No Auth" ❗

**Vị trí:** `POST user/logout/`, cột Authorization ghi `No Auth`, Body ghi `No Body`.

**Vấn đề:** với cả hai điều kiện đó, server **không có bất kỳ thông tin nào** để biết đang đăng xuất ai. Không thể xoá `refreshToken` của người dùng khỏi database, nên refresh token cũ vẫn dùng được sau khi "đăng xuất" — đây là **lỗ hổng bảo mật**, phiên không thực sự bị huỷ.

Mâu thuẫn nội tại: mã `00050` "Đăng xuất thành công" và `00006` "Truy cập bị từ chối. Không có token được cung cấp." cho thấy endpoint này lẽ ra phải kiểm tra token.

**Đề xuất sửa:** đổi Authorization thành **`Bearer Token`**, hoặc tối thiểu thêm body `{ 'refreshToken': string }` để server biết token nào cần thu hồi.

---

### 1.3 `Create group` không có body nên nhóm không có tên ❗

**Vị trí:** `POST user/group/`, Body ghi `No Body`.

**Vấn đề:** đề bài mục B.1 nêu rõ *"Người dùng có thể tạo một **nhóm gia đình**"*, hàm ý nhóm phải có tên để phân biệt và hiển thị. Với `No Body`, hệ thống chỉ tạo được nhóm vô danh.

**Đề xuất sửa:** thêm body

```json
{ "groupName": "string" }
```

và bổ sung mã response cho trường hợp thiếu tên nhóm.

---

### 1.4 `Update task` thiếu trường `newQuantity` ❗

**Vị trí:** `PUT shopping/task/`, body khai báo `{ 'taskId': string, 'newFoodName': string }`.

**Vấn đề:** mâu thuẫn trực tiếp với bảng mã response:

- `00302` — "Vui lòng cung cấp ít nhất một trong các trường sau, **newFoodName, newQuantity**"
- `00304` — "Vui lòng cung cấp một **newQuantity** hợp lệ"

Hai mã này chứng tỏ API phải nhận `newQuantity`, nhưng bảng body đã bỏ sót. Nếu làm đúng theo bảng, người dùng sẽ **không thể sửa số lượng** một món cần mua.

**Đề xuất sửa:**

```json
{ "taskId": "string", "newFoodName": "string", "newQuantity": "string" }
```

---

## Phần 2 — Vấn đề mức trung bình

### 2.1 Mã response `00207` bị dùng cho hai thông báo khác nhau

| Mã | Message |
|---|---|
| `00207` | Định dạng ghi chú mới không hợp lệ! |
| `00207` | Định dạng tên thức ăn mới không hợp lệ! |

Client không thể phân biệt hai lỗi này. **Đề xuất:** đổi mã thứ hai thành `00207b` hoặc cấp một mã trống chưa dùng (ví dụ `00209`).

### 2.2 Bảy mã có hậu tố chữ "x" không hợp lệ

`00099x`, `00138x`, `00156x`, `00167x`, `00204x`, `00214x`, `00285x`

Mã response lẽ ra phải là chuỗi số 5 chữ số thống nhất. Hậu tố "x" nhiều khả năng là ghi chú của người soạn khi chèn mã bổ sung mà quên đánh số lại. **Đề xuất:** cấp cho mỗi mã này một số hiệu riêng trong dải còn trống.

### 2.3 Nhiều nhóm mã trùng nội dung hoàn toàn

| Nhóm mã trùng | Message chung |
|---|---|
| `00017`, `00019`, `00021` | Truy cập bị từ chối. Bạn không có quyền truy cập. |
| `00026`, `00029`, `00039` | Vui lòng cung cấp một địa chỉ email hợp lệ! |
| `00036`, `00042` | Không tìm thấy tài khoản với địa chỉ email này. |
| `00012`, `00055` | Token không hợp lệ. Token có thể đã hết hạn. |
| `00114`, `00115`, `00120`, `00121`, `00126`, `00127`, `00133`, `00134`, `00139`, `00140`, `00144`, `00145`, `00152`, `00154`, `00157`, `00159`, `00168` | server error |

Riêng "server error" chiếm **17 mã khác nhau** cho cùng một tình huống.

**Đề xuất:** gộp về một mã duy nhất cho mỗi loại (ví dụ `00008` đã có sẵn cho lỗi máy chủ nội bộ), và nếu cần truy vết thì thêm trường `detail` trong response thay vì sinh thêm mã.

### 2.4 `Delete fridge item` và `Update fridge item` dùng khoá định danh khác nhau

| Endpoint | Tham số định danh |
|---|---|
| `PUT fridge/` | `itemId` |
| `DELETE fridge/` | `foodName` |

Không nhất quán, và `foodName` kém an toàn hơn (tên có thể đổi, có thể trùng hoa/thường). **Đề xuất:** dùng `itemId` cho cả hai.

### 2.5 `Get recipes by food id` dùng `foodId` trong khi toàn hệ thống dùng `foodName`

Mọi API liên quan tới thực phẩm (`Create recipe`, `Create meal plan`, `Create fridge item`…) đều nhận `foodName`, riêng `GET recipe/?foodId` lại nhận id. Client sẽ phải gọi thêm một API chỉ để tra id. **Đề xuất:** thống nhất theo `foodName`, hoặc chuyển toàn bộ sang dùng id (an toàn hơn về lâu dài).

### 2.6 Các phương thức `DELETE` mang body

Bảy endpoint `DELETE` (`user/group/`, `admin/category/`, `admin/unit/`, `food/`, `fridge/`, `shopping/`, `shopping/task/`, `meal/`, `recipe/`) đều có Body Schema.

Theo RFC 7231, `DELETE` **có thể** mang body nhưng ngữ nghĩa không được định nghĩa; nhiều thư viện HTTP (kể cả `fetch` trên một số nền tảng) và nhiều proxy/CDN sẽ **loại bỏ body của DELETE**. Đây là nguồn lỗi rất khó chẩn đoán trên thiết bị thật.

**Đề xuất:** chuyển định danh sang path param hoặc query string:

```
DELETE /food/:id
DELETE /fridge/:itemId
DELETE /shopping/task/:taskId
```

---

## Phần 3 — Chức năng đề bài yêu cầu nhưng đặc tả API không có

Sáu chức năng dưới đây được nêu rõ trong phần "Chức năng chính" của đề nhưng **không có endpoint nào phục vụ**. Nhóm sẽ tự phát triển bổ sung.

### 3.1 Tìm kiếm món ăn / thực phẩm — *đề mục B.5*

> "Người dùng có thể tìm kiếm các món ăn hoặc thực phẩm có trong hệ thống hoặc trong tủ lạnh."

**API đề xuất:**

```
GET /food/search?keyword=<từ khoá>&categoryName=<danh mục>&inFridge=<true|false>
Authorization: Bearer Token
```

### 3.2 Gợi ý món ăn từ nguyên liệu sẵn có — *đề mục B.2 và B.5*

> "Ứng dụng có thể gợi ý các món ăn dựa trên những thực phẩm đang có sẵn trong tủ lạnh."

Đây là chức năng **nổi bật nhất của đề tài** nhưng hoàn toàn không có API.

**API đề xuất:**

```
GET /meal/suggestion
Authorization: Bearer Token
```

**Thuật toán:** lấy danh sách `foodId` đang có trong tủ lạnh của nhóm → tìm các `recipe` có `foodId` nằm trong danh sách đó → xếp hạng theo số nguyên liệu khớp và theo độ gần hạn sử dụng (ưu tiên món dùng được nguyên liệu sắp hết hạn, đúng tinh thần "tối ưu hoá việc tiêu thụ thực phẩm trước khi hết hạn" ở mục A của đề).

### 3.3 Thống kê báo cáo — *đề mục B.6*

> "Hệ thống cung cấp các báo cáo về những món đồ đã mua, những thực phẩm đã tiêu thụ trong một khoảng thời gian nhất định."

**API đề xuất:**

```
GET /report/shopping?from=<ngày>&to=<ngày>     # thống kê mua sắm
GET /report/consumption?from=<ngày>&to=<ngày>  # thống kê tiêu thụ
GET /report/waste?from=<ngày>&to=<ngày>        # thống kê thực phẩm bị hết hạn (lãng phí)
```

> **Trạng thái triển khai (phương án B — ghi nhận sự kiện tối thiểu):** nhóm đã làm 5 endpoint `GET /report/overview`, `/shopping`, `/consumption`, `/waste`, `/fridge`.
> - `Task` được bổ sung `completedAt` để biết món nào được mua trong khoảng thời gian.
> - Thêm model `FridgeEvent`: mỗi lần xoá một mục khỏi tủ ghi lại `consumed` / `expired` / `discarded`, kèm tên thực phẩm, danh mục, đơn vị và số lượng tại thời điểm xoá — nhờ vậy báo cáo không mất dữ liệu khi thực phẩm bị đổi tên hoặc bị xoá.
> - `DELETE /fridge` nhận thêm `reason` tuỳ chọn (`consumed` / `expired` / `discarded`); client cũ chỉ gửi `foodName` vẫn chạy, server suy ra lý do theo hạn sử dụng.
> - Báo cáo mặc định 30 ngày gần nhất, tối đa 366 ngày, tính ngày theo giờ Việt Nam; phạm vi là nhóm của người đang đăng nhập.

### 3.4 Cập nhật device token cho push notification

Đặc tả chỉ nhận `deviceId` **một lần duy nhất lúc đăng ký**. Trên thực tế, Expo push token **thay đổi** khi người dùng cài lại app, đổi máy hoặc hệ điều hành cấp lại token. Không có API cập nhật thì **push notification sẽ ngừng hoạt động** với phần lớn người dùng sau một thời gian — làm hỏng chức năng "nhắc nhở trước 3 ngày" vốn là điểm nhấn của đề.

**API đề xuất:**

```
PUT /user/device-token
Body: { "deviceToken": "string" }
```

### 3.5 Đánh dấu món đã mua xong

Đề mục B.1 nói danh sách mua sắm giúp *"đảm bảo không quên hoặc trùng lặp các món đồ cần mua"*. Nhưng `tasks` không có trường trạng thái và không có API đánh dấu hoàn thành — người đi chợ không thể tick từng món.

**API đề xuất:**

```
PATCH /shopping/task/:taskId/complete
Body: { "isCompleted": true }
```

### 3.6 Vị trí lưu trữ trong tủ lạnh

Đề mục B.3 ghi rõ: *"nhập thông tin về các thực phẩm đã mua, bao gồm tên món ăn, số lượng, ngày hết hạn và **vị trí lưu trữ trong tủ lạnh**"*.

Body của `Create fridge item` chỉ có `foodName`, `useWithin`, `quantity` — **thiếu hẳn trường vị trí**.

**Đề xuất:** thêm trường `location` (ngăn mát / ngăn đá / cánh tủ / ngoài tủ).

---

## Phần 4 — Góp ý nhỏ

### 4.1 Tuỳ chọn ngôn ngữ `tr-en` không phù hợp

Mã `00079`: *"Các tùy chọn ngôn ngữ hợp lệ, **tr-en**, vui lòng cung cấp một trong số chúng."*

`tr` là mã ngôn ngữ **tiếng Thổ Nhĩ Kỳ** (ISO 639-1). Đây nhiều khả năng là dấu vết của một template API nước ngoài được tái sử dụng. Với ứng dụng tiếng Việt, đề xuất đổi thành **`vi-en`**.

### 4.2 Kiểu dữ liệu `useWithin` nên là ngày, không nên là chuỗi

Đề gọi đây là "ngày hết hạn" (mục B.3) và hệ thống phải tính "còn 3 ngày nữa hết hạn" để gửi thông báo. Để chuỗi (`string`) sẽ buộc server phải phân tích cú pháp mỗi lần so sánh và dễ sai định dạng. **Đề xuất:** dùng kiểu `Date` (ISO 8601), hoặc đổi tên thành `expiryDate` cho rõ nghĩa.

### 4.3 Chưa làm rõ quan hệ giữa base URL và path

Base URL là `https://ABC.def/it4788/` nhưng bảng endpoint ghi path dạng `user/login/`. Cần nói rõ đường dẫn đầy đủ là `https://ABC.def/it4788/user/login/` — hiện tài liệu không nêu, dễ gây nhầm giữa các nhóm.

### 4.4 Thiếu API rời nhóm và xem thông tin nhóm

Có `Create group`, `Add member`, `Delete member`, `Get group members` nhưng không có:
- `POST /user/group/leave` — thành viên tự rời nhóm
- `GET /user/group/info` — xem tên nhóm, ai là trưởng nhóm

Hiện thành viên muốn ra khỏi nhóm bắt buộc phải nhờ trưởng nhóm xoá (mã `00104`), không tự xử lý được.

---

## Kết luận

Đặc tả API đã cung cấp một khung tương đối đầy đủ cho các nghiệp vụ CRUD cơ bản. Tuy nhiên để ứng dụng đáp ứng **đúng và đủ** phần "Chức năng chính" của đề bài, nhóm cần:

1. **Sửa 4 lỗi nghiêm trọng** ở Phần 1 — nếu không, upload ảnh và đăng xuất sẽ không hoạt động đúng.
2. **Thống nhất 6 điểm** ở Phần 2 để đảm bảo tính đồng nhất của API.
3. **Phát triển thêm 6 nhóm API** ở Phần 3 — đặc biệt là *gợi ý món ăn* và *thống kê báo cáo*, vốn là hai chức năng đặc trưng nhất của đề tài.

Toàn bộ các API bổ sung sẽ được nhóm triển khai theo đúng chuẩn response `{ code, message, data }` của đặc tả gốc, và cập nhật vào Postman collection dùng chung.
