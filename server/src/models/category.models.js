const mongoose = require('mongoose');

// Danh mục thực phẩm dùng chung toàn hệ thống, do quản trị viên quản lý.
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 50 },
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
