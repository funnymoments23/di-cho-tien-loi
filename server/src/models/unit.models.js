const mongoose = require('mongoose');

// Đơn vị đo dùng chung toàn hệ thống, do quản trị viên quản lý.
const unitSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 50 },
}, { timestamps: true });

module.exports = mongoose.model('Unit', unitSchema);
