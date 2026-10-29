const express = require('express');
const cors = require('cors');
const path = require('path');
const {notFound, errorHandler} = require('./middlewares/error.middleware')
const auditLog = require('./middlewares/audit.middleware');
const RC = require('./constants/responseCode');
const {sendSuccess} = require('./utils/response');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ghi nhật ký các thao tác ghi/sửa/xoá thành công trước khi vào router.
app.use(auditLog);

// Ảnh mới nằm trên Cloudinary; route này chỉ còn phục vụ ảnh cũ lưu trên đĩa
// trước khi chuyển sang Cloudinary (xem middlewares/upload.middleware.js).
app.use('/it4788/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Tất cả API nằm dưới prefix /it4788
app.get('/it4788/health', (req, res) => {
  sendSuccess(res, RC.HEALTH_OK);
});
app.use('/it4788', require('./routes'));

// 404: không khớp route nào -> notFound ném AppError, errorHandler trả response
app.use(notFound);
app.use(errorHandler);

module.exports = app;
