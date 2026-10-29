// Danh sách mã response theo "20261 - Mo ta API chu de bai tap lon IT4788".
// Mỗi mục: { code, status, message }. `code` là chuỗi 5 chữ số theo đề, `status` là HTTP status.
//
// Dùng với AppError:
//   throw new AppError(RC.LOGIN_WRONG_CREDENTIALS.message, RC.LOGIN_WRONG_CREDENTIALS.status, RC.LOGIN_WRONG_CREDENTIALS.code);
// hoặc trả thành công:
//   res.status(RC.LOGIN_SUCCESS.status).json({ code: RC.LOGIN_SUCCESS.code, message: RC.LOGIN_SUCCESS.message, data });
//
// Lưu ý: đề có vài mã trùng số nhưng khác message (00099, 00138, 00156, 00167, 00204, 00207, 00214, 00285)
// và nhiều mã "server error" chỉ khác vị trí xảy ra. Các mục này được tách thành hằng số riêng cùng `code`.

const def = (code, status, message) => Object.freeze({ code, status, message });

const OK = 200;
const CREATED = 201;
const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const CONFLICT = 409;
const TOO_MANY_REQUESTS = 429;
const SERVER_ERROR = 500;

const RESPONSE_CODE = Object.freeze({
    // ===== Hệ thống =====
    HEALTH_OK: def('00000', OK, 'Server đang chạy.'),
    ROUTE_NOT_FOUND: def('00404', NOT_FOUND, 'Không tìm thấy đường dẫn.'),
    INTERNAL_SERVER_ERROR: def('00500', SERVER_ERROR, 'Lỗi máy chủ.'),

    // ===== Chung / middleware xác thực =====
    SEND_CODE_MISSING_FIELDS: def('00005', BAD_REQUEST, 'Vui lòng cung cấp đầy đủ thông tin để gửi mã.'),
    NO_TOKEN: def('00006', UNAUTHORIZED, 'Truy cập bị từ chối. Không có token được cung cấp.'),
    INVALID_USER_ID: def('00007', BAD_REQUEST, 'ID người dùng không hợp lệ.'),
    SERVER_ERROR: def('00008', SERVER_ERROR, 'Đã xảy ra lỗi máy chủ nội bộ, vui lòng thử lại.'),
    VERIFIED_USER_NOT_FOUND: def('00009', NOT_FOUND, 'Không thể tìm thấy người dùng đã xác minh với mã và ID được cung cấp. Hãy đảm bảo rằng tài khoản đã được xác minh và kích hoạt.'),
    SESSION_EXPIRED: def('00011', UNAUTHORIZED, 'Phiên của bạn đã hết hạn, vui lòng đăng nhập lại.'),
    TOKEN_INVALID: def('00012', UNAUTHORIZED, 'Token không hợp lệ. Token có thể đã hết hạn.'),
    ACCESS_DENIED_17: def('00017', FORBIDDEN, 'Truy cập bị từ chối. Bạn không có quyền truy cập.'),
    ACCESS_DENIED_19: def('00019', FORBIDDEN, 'Truy cập bị từ chối. Bạn không có quyền truy cập.'),
    ACCESS_DENIED_21: def('00021', FORBIDDEN, 'Truy cập bị từ chối. Bạn không có quyền truy cập.'),
    ID_MISSING: def('00022', BAD_REQUEST, 'Không có ID được cung cấp trong tham số. Vui lòng nhập một ID.'),
    ID_INVALID_OBJECT_ID: def('00023', BAD_REQUEST, 'ID được cung cấp không phải là một đối tượng ID hợp lệ.'),
    TOO_MANY_REQUESTS: def('00024', TOO_MANY_REQUESTS, 'Quá nhiều yêu cầu.'),

    // ===== Đăng ký =====
    REGISTER_MISSING_FIELDS: def('00025', BAD_REQUEST, 'Vui lòng cung cấp tất cả các trường bắt buộc!'),
    REGISTER_INVALID_EMAIL: def('00026', BAD_REQUEST, 'Vui lòng cung cấp một địa chỉ email hợp lệ!'),
    REGISTER_INVALID_PASSWORD: def('00027', BAD_REQUEST, 'Vui lòng cung cấp mật khẩu dài hơn 6 ký tự và ngắn hơn 20 ký tự.'),
    REGISTER_INVALID_NAME: def('00028', BAD_REQUEST, 'Vui lòng cung cấp một tên dài hơn 3 ký tự và ngắn hơn 30 ký tự.'),
    REGISTER_INVALID_EMAIL_ALT: def('00029', BAD_REQUEST, 'Vui lòng cung cấp một địa chỉ email hợp lệ!'),
    REGISTER_EMAIL_EXISTS: def('00032', CONFLICT, 'Một tài khoản với địa chỉ email này đã tồn tại.'),
    REGISTER_SUCCESS: def('00035', CREATED, 'Bạn đã đăng ký thành công.'),
    EMAIL_ACCOUNT_NOT_FOUND: def('00036', NOT_FOUND, 'Không tìm thấy tài khoản với địa chỉ email này.'),

    // ===== Đăng nhập / xác thực =====
    LOGIN_MISSING_FIELDS: def('00038', BAD_REQUEST, 'Vui lòng cung cấp tất cả các trường bắt buộc!'),
    LOGIN_INVALID_EMAIL: def('00039', BAD_REQUEST, 'Vui lòng cung cấp một địa chỉ email hợp lệ!'),
    LOGIN_INVALID_PASSWORD: def('00040', BAD_REQUEST, 'Vui lòng cung cấp mật khẩu dài hơn 6 ký tự và ngắn hơn 20 ký tự.'),
    LOGIN_ACCOUNT_NOT_FOUND: def('00042', NOT_FOUND, 'Không tìm thấy tài khoản với địa chỉ email này.'),
    LOGIN_EMAIL_NOT_ACTIVATED: def('00043', FORBIDDEN, 'Email của bạn chưa được kích hoạt, vui lòng đăng ký trước.'),
    LOGIN_EMAIL_NOT_VERIFIED: def('00044', FORBIDDEN, 'Email của bạn chưa được xác minh, vui lòng xác minh email của bạn.'),
    LOGIN_WRONG_CREDENTIALS: def('00045', UNAUTHORIZED, 'Bạn đã nhập một email hoặc mật khẩu không hợp lệ.'),
    LOGIN_SUCCESS: def('00047', OK, 'Bạn đã đăng nhập thành công.'),
    SEND_CODE_SUCCESS: def('00048', OK, 'Mã đã được gửi đến email của bạn thành công.'),
    LOGOUT_SUCCESS: def('00050', OK, 'Đăng xuất thành công.'),
    USER_NOT_FOUND: def('00052', NOT_FOUND, 'Không thể tìm thấy người dùng.'),
    VERIFY_CODE_MISSING: def('00053', BAD_REQUEST, 'Vui lòng gửi một mã xác nhận.'),
    VERIFY_CODE_MISMATCH: def('00054', BAD_REQUEST, 'Mã bạn nhập không khớp với mã chúng tôi đã gửi đến email của bạn. Vui lòng kiểm tra lại.'),
    VERIFY_TOKEN_INVALID: def('00055', UNAUTHORIZED, 'Token không hợp lệ. Token có thể đã hết hạn.'),
    VERIFY_EMAIL_SUCCESS: def('00058', OK, 'Địa chỉ email của bạn đã được xác minh thành công.'),
    REFRESH_TOKEN_MISSING: def('00059', BAD_REQUEST, 'Vui lòng cung cấp token làm mới.'),
    REFRESH_TOKEN_USER_MISMATCH: def('00061', UNAUTHORIZED, 'Token được cung cấp không khớp với người dùng, vui lòng đăng nhập.'),
    REFRESH_TOKEN_EXPIRED: def('00062', UNAUTHORIZED, 'Token đã hết hạn, vui lòng đăng nhập.'),
    REFRESH_TOKEN_UNVERIFIABLE: def('00063', UNAUTHORIZED, 'Không thể xác minh token, vui lòng đăng nhập.'),
    REFRESH_TOKEN_SUCCESS: def('00065', OK, 'Token đã được làm mới thành công.'),

    // ===== Mật khẩu =====
    NEW_PASSWORD_INVALID: def('00066', BAD_REQUEST, 'Vui lòng cung cấp một mật khẩu dài hơn 6 và ngắn hơn 20 ký tự.'),
    NEW_PASSWORD_SUCCESS: def('00068', OK, 'Mật khẩu mới đã được tạo thành công.'),
    CHANGE_PASSWORD_INVALID_FORMAT: def('00069', BAD_REQUEST, 'Vui lòng cung cấp mật khẩu cũ và mới dài hơn 6 ký tự và ngắn hơn 20 ký tự.'),
    OLD_PASSWORD_MISMATCH: def('00072', BAD_REQUEST, 'Mật khẩu cũ của bạn không khớp với mật khẩu bạn nhập, vui lòng nhập mật khẩu đúng.'),
    NEW_PASSWORD_SAME_AS_OLD: def('00073', BAD_REQUEST, 'Mật khẩu mới của bạn không nên giống với mật khẩu cũ, vui lòng thử một mật khẩu khác.'),
    CHANGE_PASSWORD_SUCCESS: def('00076', OK, 'Mật khẩu của bạn đã được thay đổi thành công.'),

    // ===== Người dùng =====
    EDIT_USER_INVALID_NAME: def('00077', BAD_REQUEST, 'Vui lòng cung cấp một tên dài hơn 3 ký tự và ngắn hơn 30 ký tự.'),
    EDIT_USER_INVALID_GENDER: def('00078', BAD_REQUEST, 'Các tùy chọn giới tính hợp lệ, female-male-other, vui lòng cung cấp một trong số chúng.'),
    EDIT_USER_INVALID_LANGUAGE: def('00079', BAD_REQUEST, 'Các tùy chọn ngôn ngữ hợp lệ, tr-en, vui lòng cung cấp một trong số chúng.'),
    EDIT_USER_INVALID_BIRTHDAY: def('00080', BAD_REQUEST, 'Vui lòng cung cấp một ngày sinh hợp lệ.'),
    EDIT_USER_INVALID_USERNAME: def('00081', BAD_REQUEST, 'Vui lòng cung cấp một tên người dùng dài hơn 3 ký tự và ngắn hơn 15 ký tự.'),
    EDIT_USER_USERNAME_EXISTS: def('00084', CONFLICT, 'Đã có một người dùng với tên người dùng này, vui lòng nhập tên khác.'),
    EDIT_USER_SUCCESS: def('00086', OK, 'Thông tin hồ sơ của bạn đã được thay đổi thành công.'),
    GET_USER_SUCCESS: def('00089', OK, 'Thông tin người dùng đã được lấy thành công.'),
    DELETE_USER_SUCCESS: def('00092', OK, 'Tài khoản của bạn đã bị xóa thành công.'),

    // ===== Nhóm =====
    GROUP_CREATE_ALREADY_IN_GROUP: def('00093', CONFLICT, 'Không thể tạo nhóm, bạn đã thuộc về một nhóm rồi'),
    // Đặc tả gốc không có body cho POST /user/group; nhóm bổ sung tên nhóm (docs/02 mục 1.3)
    // nên cần thêm mã cho trường hợp thiếu/sai tên nhóm.
    GROUP_CREATE_MISSING_NAME: def('00094', BAD_REQUEST, 'Vui lòng cung cấp tên nhóm hợp lệ.'),
    GROUP_CREATE_SUCCESS: def('00095', CREATED, 'Tạo nhóm thành công'),
    GROUP_NOT_IN_GROUP: def('00096', FORBIDDEN, 'Bạn không thuộc về nhóm nào'),
    GROUP_GET_MEMBERS_SUCCESS: def('00098', OK, 'Thành công'),
    GROUP_GET_INFO_SUCCESS: def('00098', OK, 'Thành công'),
    GROUP_ADD_MEMBER_ALREADY_IN_GROUP: def('00099', CONFLICT, 'Người này đã thuộc về một nhóm'),
    GROUP_ADD_MEMBER_USER_NOT_FOUND: def('00099', NOT_FOUND, 'Không tồn tại user này'),
    GROUP_ADD_MEMBER_MISSING_USERNAME: def('00100', BAD_REQUEST, 'Thiếu username'),
    GROUP_ADD_MEMBER_NOT_ADMIN: def('00101', FORBIDDEN, 'Bạn không phải trưởng nhóm, không thể thêm thành viên.'),
    GROUP_ADD_MEMBER_SUCCESS: def('00102', OK, 'Người dùng thêm vào nhóm thành công'),
    GROUP_DELETE_MEMBER_NOT_IN_GROUP: def('00103', NOT_FOUND, 'Người này chưa vào nhóm nào'),
    GROUP_DELETE_MEMBER_NOT_ADMIN: def('00104', FORBIDDEN, 'Bạn không phải admin, không thể xóa'),
    GROUP_DELETE_MEMBER_IS_ADMIN: def('00105', BAD_REQUEST, 'Không thể xóa trưởng nhóm. Hãy chuyển quyền trưởng nhóm hoặc rời nhóm.'),
    GROUP_DELETE_MEMBER_SUCCESS: def('00106', OK, 'Xóa thành công'),
    GROUP_DELETE_MEMBER_MISSING_USERNAME: def('00107', BAD_REQUEST, 'Thiếu username'),
    GROUP_LEAVE_SUCCESS: def('00108', OK, 'Rời nhóm thành công'),
    LOGS_GET_SUCCESS: def('00109', OK, 'Lấy log hệ thống thành công'),

    // ===== Đơn vị đo (unit) =====
    UNIT_GET_SUCCESS: def('00110', OK, 'Lấy các unit thành công'),
    UNIT_CREATE_MISSING_NAME: def('00112', BAD_REQUEST, 'Thiếu thông tin tên của đơn vị'),
    UNIT_CREATE_EXISTS: def('00113', CONFLICT, 'Đã tồn tại đơn vị có tên này'),
    UNIT_CREATE_SERVER_ERROR_1: def('00114', SERVER_ERROR, 'server error'),
    UNIT_CREATE_SERVER_ERROR_2: def('00115', SERVER_ERROR, 'server error'),
    UNIT_CREATE_SUCCESS: def('00116', CREATED, 'Tạo đơn vị thành công'),
    UNIT_UPDATE_MISSING_FIELDS: def('00117', BAD_REQUEST, 'Thiếu thông tin name cũ, name mới'),
    UNIT_UPDATE_SAME_NAME: def('00118', BAD_REQUEST, 'Tên cũ trùng với tên mới'),
    UNIT_UPDATE_NOT_FOUND: def('00119', NOT_FOUND, 'Không tìm thấy đơn vị với tên cung cấp'),
    // Đặc tả không có mã riêng cho tên mới bị trùng khi sửa đơn vị; dùng chung mã 00113.
    UNIT_UPDATE_NEW_NAME_EXISTS: def('00113', CONFLICT, 'Đã tồn tại đơn vị có tên này'),
    UNIT_UPDATE_SERVER_ERROR_1: def('00120', SERVER_ERROR, 'server error'),
    UNIT_UPDATE_SERVER_ERROR_2: def('00121', SERVER_ERROR, 'server error'),
    UNIT_UPDATE_SUCCESS: def('00122', OK, 'Sửa đổi đơn vị thành công'),
    UNIT_DELETE_MISSING_NAME: def('00123', BAD_REQUEST, 'Thiếu thông tin tên của đơn vị'),
    UNIT_DELETE_NOT_FOUND: def('00125', NOT_FOUND, 'Không tìm thấy đơn vị với tên cung cấp'),
    UNIT_DELETE_SERVER_ERROR_1: def('00126', SERVER_ERROR, 'server error'),
    UNIT_DELETE_SERVER_ERROR_2: def('00127', SERVER_ERROR, 'server error'),
    UNIT_DELETE_SUCCESS: def('00128', OK, 'Xóa đơn vị thành công'),

    // ===== Danh mục (category) =====
    CATEGORY_GET_SUCCESS: def('00129', OK, 'Lấy các category thành công'),
    CATEGORY_CREATE_MISSING_NAME: def('00131', BAD_REQUEST, 'Thiếu thông tin tên của category'),
    CATEGORY_CREATE_EXISTS: def('00132', CONFLICT, 'Đã tồn tại category có tên này'),
    CATEGORY_CREATE_SERVER_ERROR_1: def('00133', SERVER_ERROR, 'server error'),
    CATEGORY_CREATE_SERVER_ERROR_2: def('00134', SERVER_ERROR, 'server error'),
    CATEGORY_CREATE_SUCCESS: def('00135', CREATED, 'Tạo category thành công'),
    CATEGORY_UPDATE_MISSING_FIELDS: def('00136', BAD_REQUEST, 'Thiếu thông tin name cũ, name mới'),
    CATEGORY_UPDATE_SAME_NAME: def('00137', BAD_REQUEST, 'Tên cũ trùng với tên mới'),
    CATEGORY_UPDATE_NOT_FOUND: def('00138', NOT_FOUND, 'Không tìm thấy category với tên cung cấp'),
    CATEGORY_UPDATE_NEW_NAME_EXISTS: def('00138', CONFLICT, 'Tên mới đã tồn tại'),
    CATEGORY_UPDATE_SERVER_ERROR_1: def('00139', SERVER_ERROR, 'server error'),
    CATEGORY_UPDATE_SERVER_ERROR_2: def('00140', SERVER_ERROR, 'server error'),
    CATEGORY_UPDATE_SUCCESS: def('00141', OK, 'Sửa đổi category thành công'),
    CATEGORY_DELETE_MISSING_NAME: def('00142', BAD_REQUEST, 'Thiếu thông tin tên của category'),
    CATEGORY_DELETE_NOT_FOUND: def('00143', NOT_FOUND, 'Không tìm thấy category với tên cung cấp'),
    CATEGORY_DELETE_SERVER_ERROR_1: def('00144', SERVER_ERROR, 'server error'),
    CATEGORY_DELETE_SERVER_ERROR_2: def('00145', SERVER_ERROR, 'server error'),
    CATEGORY_DELETE_SUCCESS: def('00146', OK, 'Xóa category thành công'),

    // ===== Thực phẩm (food) =====
    FOOD_CREATE_MISSING_FIELDS: def('00147', BAD_REQUEST, 'Vui lòng cung cấp tất cả các trường bắt buộc!'),
    FOOD_CREATE_INVALID_NAME: def('00148', BAD_REQUEST, 'Vui lòng cung cấp tên của thực phẩm hợp lệ!'),
    FOOD_CREATE_MISSING_CATEGORY: def('00149', BAD_REQUEST, 'Vui lòng cung cấp tên của category của thực phẩm'),
    FOOD_CREATE_MISSING_UNIT: def('00150', BAD_REQUEST, 'Vui lòng cung cấp tên đơn vị đo của thực phẩm'),
    FOOD_CREATE_EXISTS: def('00151', CONFLICT, 'Đã tồn tại thức ăn với tên này'),
    FOOD_CREATE_SERVER_ERROR_1: def('00152', SERVER_ERROR, 'server error'),
    FOOD_CREATE_UNIT_NOT_FOUND: def('00153', NOT_FOUND, 'Không tìm thấy đơn vị với tên cung cấp'),
    FOOD_CREATE_SERVER_ERROR_2: def('00154', SERVER_ERROR, 'server error'),
    FOOD_CREATE_CATEGORY_NOT_FOUND: def('00155', NOT_FOUND, 'Không tìm thấy category với tên cung cấp'),
    FOOD_CREATE_NOT_IN_GROUP: def('00156', FORBIDDEN, 'Hãy vào nhóm trước để tạo thực phẩm'),
    FOOD_CREATE_SERVER_ERROR_3: def('00157', SERVER_ERROR, 'server error'),
    FOOD_CREATE_UPLOAD_FAILED: def('00158', SERVER_ERROR, 'đăng tải ảnh thất bại'),
    FOOD_CREATE_SERVER_ERROR_4: def('00159', SERVER_ERROR, 'server error'),
    FOOD_CREATE_SUCCESS: def('00160', CREATED, 'Tạo thực phẩm thành công'),

    FOOD_UPDATE_MISSING_FIELDS: def('00161', BAD_REQUEST, 'Vui lòng cung cấp tất cả các trường bắt buộc!'),
    FOOD_UPDATE_INVALID_NAME: def('00162', BAD_REQUEST, 'Vui lòng cung cấp tên thực phẩm hợp lệ!'),
    FOOD_UPDATE_NEED_ONE_FIELD: def('00163', BAD_REQUEST, 'Vui lòng cung cấp ít nhất một trong các trường sau, newName, newCategory, newUnit'),
    FOOD_UPDATE_INVALID_CATEGORY: def('00164', BAD_REQUEST, 'Vui lòng cung cấp một danh mục mới hợp lệ cho thực phẩm'),
    FOOD_UPDATE_INVALID_UNIT: def('00165', BAD_REQUEST, 'Vui lòng cung cấp một đơn vị mới hợp lệ cho thực phẩm'),
    FOOD_UPDATE_INVALID_NEW_NAME: def('00166', BAD_REQUEST, 'Vui lòng cung cấp một tên mới hợp lệ cho thực phẩm'),
    FOOD_UPDATE_NOT_FOUND: def('00167', NOT_FOUND, 'Thực phẩm với tên đã cung cấp không tồn tại'),
    FOOD_UPDATE_NO_PERMISSION: def('00167', FORBIDDEN, 'Bạn không có quyền chỉnh sửa'),
    FOOD_UPDATE_SERVER_ERROR: def('00168', SERVER_ERROR, 'server error'),
    FOOD_UPDATE_UNIT_NOT_FOUND: def('00169', NOT_FOUND, 'Không tìm thấy đơn vị với tên đã cung cấp'),
    FOOD_UPDATE_CATEGORY_NOT_FOUND: def('00171', NOT_FOUND, 'Không tìm thấy danh mục với tên đã cung cấp'),
    FOOD_UPDATE_NAME_EXISTS: def('00173', CONFLICT, 'Một thực phẩm với tên này đã tồn tại'),
    FOOD_UPDATE_SUCCESS: def('00178', OK, 'Thành công'),

    FOOD_DELETE_MISSING_NAME: def('00179', BAD_REQUEST, 'Vui lòng cung cấp tên thực phẩm'),
    FOOD_DELETE_NOT_FOUND: def('00180', NOT_FOUND, 'Không tìm thấy thực phẩm với tên đã cung cấp'),
    FOOD_DELETE_NO_PERMISSION: def('00181', FORBIDDEN, 'Bạn không có quyền'),
    FOOD_DELETE_SUCCESS: def('00184', OK, 'Xóa thực phẩm thành công'),

    FOOD_GET_NOT_IN_GROUP: def('00185', FORBIDDEN, 'Bạn chưa vào nhóm nào'),
    FOOD_GET_SUCCESS: def('00188', OK, 'Lấy danh sách thực phẩm thành công'),

    // ===== Tủ lạnh (fridge) =====
    FRIDGE_CREATE_INVALID_FOOD_NAME: def('00190', BAD_REQUEST, 'Vui lòng cung cấp một tên thực phẩm hợp lệ!'),
    FRIDGE_CREATE_INVALID_USE_WITHIN: def('00191', BAD_REQUEST, "Vui lòng cung cấp một giá trị 'sử dụng trong khoảng' hợp lệ!"),
    FRIDGE_CREATE_INVALID_QUANTITY: def('00192', BAD_REQUEST, 'Vui lòng cung cấp một số lượng hợp lệ!'),
    FRIDGE_CREATE_INVALID_NOTE: def('00193', BAD_REQUEST, 'Định dạng ghi chú không hợp lệ!'),
    FRIDGE_CREATE_FOOD_NOT_FOUND: def('00194', NOT_FOUND, 'Thực phẩm không tồn tại.'),
    FRIDGE_CREATE_NOT_IN_GROUP: def('00196', FORBIDDEN, 'Người dùng không có quyền do không thuộc nhóm.'),
    FRIDGE_CREATE_FOOD_NOT_IN_GROUP: def('00198', FORBIDDEN, 'Thực phẩm không thuộc quyền quản trị của nhóm.'),
    FRIDGE_CREATE_EXISTS: def('00199', CONFLICT, 'Mục trong tủ lạnh cho thực phẩm đã tồn tại.'),
    FRIDGE_CREATE_SUCCESS: def('00202', CREATED, 'Mục trong tủ lạnh được tạo thành công.'),

    FRIDGE_UPDATE_MISSING_FIELDS: def('00203', BAD_REQUEST, 'Vui cung cấp tất cả các trường cần thiết'),
    FRIDGE_UPDATE_MISSING_ITEM_ID: def('00204', BAD_REQUEST, 'Vui lòng cung cấp id của item tủ lạnh'),
    FRIDGE_UPDATE_NEED_ONE_FIELD: def('00204', BAD_REQUEST, 'Vui lòng cung cấp ít nhất một trong các trường sau, newQuantity, newNote, newUseWithin'),
    FRIDGE_UPDATE_INVALID_USE_WITHIN: def('00205', BAD_REQUEST, "Vui lòng cung cấp một giá trị 'sử dụng trong' hợp lệ!"),
    FRIDGE_UPDATE_INVALID_QUANTITY: def('00206', BAD_REQUEST, 'Vui lòng cung cấp một lượng hợp lệ!'),
    FRIDGE_UPDATE_INVALID_NOTE: def('00207', BAD_REQUEST, 'Định dạng ghi chú mới không hợp lệ!'),
    FRIDGE_UPDATE_INVALID_FOOD_NAME: def('00207', BAD_REQUEST, 'Định dạng tên thức ăn mới không hợp lệ!'),
    FRIDGE_UPDATE_FOOD_NOT_FOUND: def('00208', NOT_FOUND, 'Thực phẩm không tồn tại.'),
    FRIDGE_UPDATE_NOT_IN_GROUP: def('00210', FORBIDDEN, 'Người dùng không thuộc bất kỳ nhóm nào'),
    FRIDGE_UPDATE_NOT_ADMIN: def('00212', FORBIDDEN, 'Tủ lạnh không thuộc quản trị viên nhóm.'),
    FRIDGE_UPDATE_ITEM_NOT_FOUND: def('00213', NOT_FOUND, 'Mục tủ lạnh không tồn tại.'),
    FRIDGE_UPDATE_NEW_FOOD_NOT_FOUND: def('00214', NOT_FOUND, 'Tên thực phẩm mới không tồn tại'),
    FRIDGE_UPDATE_SUCCESS: def('00216', OK, 'Cập nhật mục tủ lạnh thành công.'),

    FRIDGE_DELETE_MISSING_FOOD_NAME: def('00217', BAD_REQUEST, 'Vui lòng cung cấp tên thực phẩm'),
    FRIDGE_DELETE_FOOD_NOT_FOUND: def('00218', NOT_FOUND, 'Không tìm thấy thực phẩm với tên đã cung cấp'),
    FRIDGE_DELETE_NO_PERMISSION: def('00219', FORBIDDEN, 'Bạn không có quyền'),
    FRIDGE_DELETE_ITEM_NOT_CREATED: def('00221', NOT_FOUND, 'Mục trong tủ lạnh liên kết với thực phẩm này chưa được tạo'),
    FRIDGE_DELETE_SUCCESS: def('00224', OK, 'Xóa mục trong tủ lạnh thành công'),
    // Lý do xoá là trường bổ sung phục vụ báo cáo tiêu thụ / lãng phí (docs/02 mục 3.3).
    FRIDGE_DELETE_INVALID_REASON: def('00226', BAD_REQUEST, 'Lý do xóa không hợp lệ. Chỉ nhận consumed, expired hoặc discarded.'),

    FRIDGE_GET_NOT_IN_GROUP: def('00225', FORBIDDEN, 'Bạn chưa vào nhóm nào'),
    FRIDGE_GET_SUCCESS: def('00228', OK, 'Lấy danh sách đồ tủ lạnh thành công'),

    FRIDGE_ITEM_MISSING_FOOD_NAME: def('00229', BAD_REQUEST, 'Vui lòng cung cấp tên thực phẩm'),
    FRIDGE_ITEM_FOOD_NOT_FOUND: def('00230', NOT_FOUND, 'Không tìm thấy thực phẩm với tên đã cung cấp'),
    FRIDGE_ITEM_NO_PERMISSION: def('00232', FORBIDDEN, 'Bạn không có quyền'),
    FRIDGE_ITEM_NOT_CREATED: def('00234', NOT_FOUND, 'Mục trong tủ lạnh liên kết với thực phẩm này chưa được tạo'),
    FRIDGE_ITEM_GET_SUCCESS: def('00237', OK, 'Lấy item cụ thể thành công'),

    // ===== Danh sách mua sắm (shopping) =====
    SHOPPING_CREATE_MISSING_FIELDS: def('00238', BAD_REQUEST, 'Vui cung cấp tất cả các trường cần thiết'),
    SHOPPING_CREATE_MISSING_NAME: def('00239', BAD_REQUEST, 'Vui lòng cung cấp tên'),
    SHOPPING_CREATE_MISSING_ASSIGNEE: def('00240', BAD_REQUEST, 'Vui lòng cung cấp assignToUsername'),
    SHOPPING_CREATE_INVALID_NOTE: def('00241', BAD_REQUEST, 'Định dạng ghi chú không hợp lệ'),
    SHOPPING_CREATE_INVALID_DATE: def('00242', BAD_REQUEST, 'Định dạng ngày không hợp lệ'),
    SHOPPING_CREATE_UNAUTHORIZED: def('00243', FORBIDDEN, 'Truy cập không được ủy quyền. Bạn không có quyền.'),
    SHOPPING_CREATE_ASSIGNEE_NOT_FOUND: def('00245', NOT_FOUND, 'Tên người dùng được gán không tồn tại.'),
    SHOPPING_CREATE_CANNOT_ASSIGN: def('00246', FORBIDDEN, 'Truy cập không được ủy quyền. Bạn không có quyền gán danh sách mua sắm cho người dùng này.'),
    SHOPPING_CREATE_SUCCESS: def('00249', CREATED, 'Danh sách mua sắm đã được tạo thành công.'),

    SHOPPING_UPDATE_MISSING_FIELDS: def('00250', BAD_REQUEST, 'Vui cung cấp tất cả các trường cần thiết'),
    SHOPPING_UPDATE_MISSING_LIST_ID: def('00251', BAD_REQUEST, 'Vui lòng cung cấp id danh sách'),
    SHOPPING_UPDATE_NEED_ONE_FIELD: def('00252', BAD_REQUEST, 'Vui lòng cung cấp ít nhất một trong những trường sau, newName, newAssignToUsername, newNote,newDate'),
    SHOPPING_UPDATE_INVALID_NAME: def('00253', BAD_REQUEST, 'Định dạng tên mới không hợp lệ'),
    SHOPPING_UPDATE_INVALID_ASSIGNEE: def('00254', BAD_REQUEST, 'Định dạng tên người được giao mới không hợp lệ'),
    SHOPPING_UPDATE_INVALID_NOTE: def('00255', BAD_REQUEST, 'Định dạng ghi chú mới không hợp lệ'),
    SHOPPING_UPDATE_INVALID_DATE: def('00256', BAD_REQUEST, 'Định dạng ngày mới không hợp lệ'),
    SHOPPING_UPDATE_NOT_GROUP_ADMIN: def('00258', FORBIDDEN, 'Người dùng không phải là quản trị viên nhóm'),
    SHOPPING_UPDATE_LIST_NOT_FOUND: def('00260', NOT_FOUND, 'Không tìm thấy danh sách mua sắm'),
    SHOPPING_UPDATE_NOT_LIST_ADMIN: def('00261', FORBIDDEN, 'Người dùng không phải là quản trị viên của danh sách mua sắm này'),
    SHOPPING_UPDATE_USER_NOT_FOUND: def('00262', NOT_FOUND, 'Người dùng không tồn tại'),
    SHOPPING_UPDATE_CANNOT_ASSIGN: def('00263', FORBIDDEN, 'Người dùng không có quyền gán danh sách này cho tên người dùng'),
    SHOPPING_UPDATE_SUCCESS: def('00266', OK, 'Cập nhật danh sách mua sắm thành công'),

    SHOPPING_DELETE_MISSING_FIELDS: def('00267', BAD_REQUEST, 'Cung cấp các trường cần thiết'),
    SHOPPING_DELETE_MISSING_LIST_ID: def('00268', BAD_REQUEST, 'Vui lòng cung cấp id danh sách'),
    SHOPPING_DELETE_NOT_GROUP_ADMIN: def('00270', FORBIDDEN, 'Người dùng không phải là quản trị viên nhóm'),
    SHOPPING_DELETE_LIST_NOT_FOUND: def('00272', NOT_FOUND, 'Không tìm thấy danh sách mua sắm'),
    SHOPPING_DELETE_NOT_LIST_ADMIN: def('00273', FORBIDDEN, 'Người dùng không phải là quản trị viên của danh sách mua sắm này'),
    SHOPPING_DELETE_SUCCESS: def('00275', OK, 'Xóa danh sách mua sắm thành công'),

    // ===== Nhiệm vụ trong danh sách mua sắm (task) =====
    TASK_CREATE_MISSING_FIELDS: def('00276', BAD_REQUEST, 'Vui lòng cung cấp tất cả các trường bắt buộc'),
    TASK_CREATE_MISSING_LIST_ID: def('00277', BAD_REQUEST, 'Vui lòng cung cấp một ID của danh sách'),
    TASK_CREATE_MISSING_TASKS: def('00278', BAD_REQUEST, 'Vui lòng cung cấp một mảng nhiệm vụ'),
    TASK_CREATE_INVALID_TASKS: def('00279', BAD_REQUEST, 'Vui lòng cung cấp một mảng nhiệm vụ với các trường hợp lệ'),
    TASK_CREATE_NOT_GROUP_ADMIN: def('00281', FORBIDDEN, 'Người dùng không phải là quản trị viên của nhóm'),
    TASK_CREATE_LIST_NOT_FOUND: def('00283', NOT_FOUND, 'Không tìm thấy danh sách mua sắm'),
    TASK_CREATE_NOT_LIST_ADMIN: def('00284', FORBIDDEN, 'Người dùng không phải là quản trị viên của danh sách mua sắm này'),
    TASK_CREATE_FOOD_NOT_FOUND: def('00285', NOT_FOUND, 'Không tìm thấy một món ăn với tên cung cấp trong mảng'),
    TASK_CREATE_FOOD_ALREADY_IN_LIST: def('00285', CONFLICT, 'Loại thức ăn này đã có trong danh sách rồi'),
    TASK_CREATE_SUCCESS: def('00287', CREATED, 'Thêm nhiệm vụ thành công'),

    TASK_GET_NOT_IN_GROUP: def('00288', FORBIDDEN, 'Người dùng này chưa thuộc nhóm nào'),
    TASK_GET_SUCCESS: def('00292', OK, 'Lấy danh sách các shopping list thành công'),

    TASK_DELETE_MISSING_FIELDS: def('00293', BAD_REQUEST, 'Vui lòng cung cấp tất cả các trường bắt buộc'),
    TASK_DELETE_MISSING_TASK_ID: def('00294', BAD_REQUEST, 'Vui lòng cung cấp một ID nhiệm vụ trong trường taskId'),
    TASK_DELETE_NOT_FOUND: def('00296', NOT_FOUND, 'Không tìm thấy nhiệm vụ với ID đã cung cấp'),
    TASK_DELETE_NOT_GROUP_ADMIN: def('00297', FORBIDDEN, 'Người dùng không phải là quản trị viên nhóm'),
    TASK_DELETE_SUCCESS: def('00299', OK, 'Xóa nhiệm vụ thành công'),

    TASK_UPDATE_MISSING_FIELDS: def('00300', BAD_REQUEST, 'Vui lòng cung cấp tất cả các trường bắt buộc'),
    TASK_UPDATE_MISSING_TASK_ID: def('00301', BAD_REQUEST, 'Vui lòng cung cấp một ID nhiệm vụ trong trường taskId'),
    TASK_UPDATE_NEED_ONE_FIELD: def('00302', BAD_REQUEST, 'Vui lòng cung cấp ít nhất một trong các trường sau, newFoodName, newQuantity'),
    TASK_UPDATE_INVALID_FOOD_NAME: def('00303', BAD_REQUEST, 'Vui lòng cung cấp một newFoodName hợp lệ'),
    TASK_UPDATE_INVALID_QUANTITY: def('00304', BAD_REQUEST, 'Vui lòng cung cấp một newQuantity hợp lệ'),
    TASK_UPDATE_NOT_FOUND: def('00306', NOT_FOUND, 'Không tìm thấy nhiệm vụ với ID đã cung cấp'),
    TASK_UPDATE_NOT_GROUP_ADMIN: def('00307', FORBIDDEN, 'Người dùng không phải là quản trị viên nhóm'),
    TASK_UPDATE_FOOD_NOT_FOUND: def('00308', NOT_FOUND, 'Không tìm thấy nhiệm vụ với tên đã cung cấp'),
    TASK_UPDATE_FOOD_ALREADY_IN_LIST: def('00309', CONFLICT, 'Thực phẩm này đã tồn tại trong danh sách mua hàng hiện tại'),
    TASK_UPDATE_SUCCESS: def('00312', OK, 'Cập nhật nhiệm vụ thành công'),

    // ===== Kế hoạch bữa ăn (meal) =====
    MEAL_CREATE_MISSING_FIELDS: def('00313', BAD_REQUEST, 'Vui lòng cung cấp tất cả các trường bắt buộc'),
    MEAL_CREATE_INVALID_FOOD_NAME: def('00314', BAD_REQUEST, 'Vui lòng cung cấp một tên thực phẩm hợp lệ'),
    MEAL_CREATE_INVALID_TIMESTAMP: def('00315', BAD_REQUEST, 'Vui lòng cung cấp một dấu thời gian hợp lệ'),
    MEAL_CREATE_INVALID_NAME: def('00316', BAD_REQUEST, 'Vui lòng cung cấp một tên hợp lệ cho bữa ăn,sáng, trưa, tối'),
    MEAL_CREATE_FOOD_NOT_FOUND: def('00317', NOT_FOUND, 'Không tìm thấy thực phẩm với tên đã cung cấp'),
    MEAL_CREATE_NOT_GROUP_ADMIN: def('00319', FORBIDDEN, 'Người dùng không phải là quản trị viên nhóm'),
    MEAL_CREATE_SUCCESS: def('00322', CREATED, 'Thêm kế hoạch bữa ăn thành công'),

    MEAL_DELETE_MISSING_FIELDS: def('00323', BAD_REQUEST, 'Vui lòng cung cấp tất cả các trường bắt buộc'),
    MEAL_DELETE_INVALID_PLAN_ID: def('00324', BAD_REQUEST, 'Vui lòng cung cấp một ID kế hoạch hợp lệ'),
    MEAL_DELETE_NOT_FOUND: def('00325', NOT_FOUND, 'Không tìm thấy kế hoạch với ID đã cung cấp'),
    MEAL_DELETE_NOT_GROUP_ADMIN: def('00327', FORBIDDEN, 'Người dùng không phải là quản trị viên nhóm'),
    MEAL_DELETE_SUCCESS: def('00330', OK, 'Kế hoạch bữa ăn của bạn đã được xóa thành công'),

    MEAL_UPDATE_MISSING_FIELDS: def('00331', BAD_REQUEST, 'Vui lòng cung cấp tất cả các trường bắt buộc'),
    MEAL_UPDATE_MISSING_PLAN_ID: def('00332', BAD_REQUEST, 'Vui lòng cung cấp một ID kế hoạch!'),
    MEAL_UPDATE_NEED_ONE_FIELD: def('00333', BAD_REQUEST, 'Vui lòng cung cấp ít nhất một trong các trường sau, newFoodName, newTimestamp, newName'),
    MEAL_UPDATE_INVALID_FOOD_NAME: def('00334', BAD_REQUEST, 'Vui lòng cung cấp một tên thực phẩm mới hợp lệ!'),
    MEAL_UPDATE_INVALID_TIMESTAMP: def('00335', BAD_REQUEST, 'Vui lòng cung cấp một dấu thời gian hợp lệ!'),
    MEAL_UPDATE_INVALID_NAME: def('00336', BAD_REQUEST, 'Vui lòng cung cấp một tên hợp lệ, sáng, trưa, tối!'),
    MEAL_UPDATE_NOT_FOUND: def('00337', NOT_FOUND, 'Không tìm thấy kế hoạch với ID đã cung cấp'),
    MEAL_UPDATE_NOT_GROUP_ADMIN: def('00339', FORBIDDEN, 'Người dùng không phải là quản trị viên nhóm'),
    MEAL_UPDATE_NEW_FOOD_NOT_FOUND: def('00341', NOT_FOUND, 'Tên thực phẩm mới không tồn tại'),
    MEAL_UPDATE_SUCCESS: def('00344', OK, 'Cập nhật kế hoạch bữa ăn thành công'),

    MEAL_GET_NOT_IN_GROUP: def('00345', FORBIDDEN, 'Bạn chưa vào nhóm nào'),
    MEAL_GET_SUCCESS: def('00348', OK, 'Lấy danh sách thành công'),

    // ===== Công thức nấu ăn (recipe) =====
    RECIPE_CREATE_MISSING_FIELDS: def('00349', BAD_REQUEST, 'Vui lòng cung cấp tất cả các trường bắt buộc'),
    RECIPE_CREATE_INVALID_FOOD_NAME: def('00350', BAD_REQUEST, 'Vui lòng cung cấp một tên thực phẩm hợp lệ'),
    RECIPE_CREATE_INVALID_NAME: def('00351', BAD_REQUEST, 'Vui lòng cung cấp một tên công thức hợp lệ'),
    RECIPE_CREATE_INVALID_DESCRIPTION: def('00352', BAD_REQUEST, 'Vui lòng cung cấp một mô tả công thức hợp lệ'),
    RECIPE_CREATE_INVALID_HTML: def('00353', BAD_REQUEST, 'Vui lòng cung cấp nội dung HTML công thức hợp lệ'),
    RECIPE_CREATE_FOOD_NOT_FOUND: def('00354', NOT_FOUND, 'Không tìm thấy thực phẩm với tên đã cung cấp'),
    RECIPE_CREATE_SUCCESS: def('00357', CREATED, 'Thêm công thức nấu ăn thành công'),

    RECIPE_UPDATE_MISSING_FIELDS: def('00358', BAD_REQUEST, 'Vui lòng cung cấp tất cả các trường bắt buộc'),
    RECIPE_UPDATE_MISSING_RECIPE_ID: def('00359', BAD_REQUEST, 'Vui lòng cung cấp một ID công thức!'),
    RECIPE_UPDATE_NEED_ONE_FIELD: def('00360', BAD_REQUEST, 'Vui lòng cung cấp ít nhất một trong các trường sau, newFoodName, newDescription, newHtmlContent,newName'),
    RECIPE_UPDATE_INVALID_FOOD_NAME: def('00361', BAD_REQUEST, 'Vui lòng cung cấp một tên thực phẩm mới hợp lệ!'),
    RECIPE_UPDATE_INVALID_DESCRIPTION: def('00362', BAD_REQUEST, 'Vui lòng cung cấp một mô tả mới hợp lệ!'),
    RECIPE_UPDATE_INVALID_HTML: def('00363', BAD_REQUEST, 'Vui lòng cung cấp nội dung HTML mới hợp lệ!'),
    RECIPE_UPDATE_INVALID_NAME: def('00364', BAD_REQUEST, 'Vui lòng cung cấp một tên công thức mới hợp lệ!'),
    RECIPE_UPDATE_NOT_FOUND: def('00365', NOT_FOUND, 'Không tìm thấy công thức với ID đã cung cấp'),
    RECIPE_UPDATE_NEW_FOOD_NOT_FOUND: def('00367', NOT_FOUND, 'Tên thực phẩm mới không tồn tại'),
    RECIPE_UPDATE_SUCCESS: def('00370', OK, 'Cập nhật công thức nấu ăn thành công'),

    RECIPE_DELETE_MISSING_FIELDS: def('00371', BAD_REQUEST, 'Vui lòng cung cấp tất cả các trường bắt buộc'),
    RECIPE_DELETE_INVALID_RECIPE_ID: def('00372', BAD_REQUEST, 'Vui lòng cung cấp một ID công thức hợp lệ'),
    RECIPE_DELETE_NOT_FOUND: def('00373', NOT_FOUND, 'Không tìm thấy công thức với ID đã cung cấp'),
    RECIPE_DELETE_SUCCESS: def('00376', OK, 'Công thức của bạn đã được xóa thành công'),

    RECIPE_GET_SUCCESS: def('00378', OK, 'Lấy các công thức thành công'),

    // ===== Báo cáo / thống kê (report) =====
    // Dải 00380–00386 dành cho nhóm API bổ sung GET /report/* (docs/02 mục 3.3).
    REPORT_OVERVIEW_SUCCESS: def('00380', OK, 'Lấy báo cáo tổng hợp thành công'),
    REPORT_SHOPPING_SUCCESS: def('00381', OK, 'Lấy báo cáo mua sắm thành công'),
    REPORT_CONSUMPTION_SUCCESS: def('00382', OK, 'Lấy báo cáo tiêu thụ thành công'),
    REPORT_WASTE_SUCCESS: def('00383', OK, 'Lấy báo cáo lãng phí thành công'),
    REPORT_FRIDGE_SUCCESS: def('00384', OK, 'Lấy báo cáo tủ lạnh thành công'),
    REPORT_NOT_IN_GROUP: def('00385', FORBIDDEN, 'Bạn chưa vào nhóm nào'),
    REPORT_INVALID_DATE_RANGE: def(
      '00386',
      BAD_REQUEST,
      'Khoảng thời gian không hợp lệ. Vui lòng cung cấp ngày dạng YYYY-MM-DD, from <= to và tối đa 366 ngày.'
    ),
});

module.exports = RESPONSE_CODE;
