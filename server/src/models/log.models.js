const mongoose = require('mongoose');

// Nhật ký thao tác nghiệp vụ (đề mục B.7 — "xem nhật ký hệ thống").
// Mỗi request ghi/sửa/xoá thành công được ghi một bản ghi để admin tra cứu.
const logSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      default: null,
    },
    action: {
      type: String,
      required: true,
      enum: ['CREATE', 'UPDATE', 'DELETE'],
    },
    // Tên thực thể: user, group, food, fridge, shopping, task, meal, recipe,
    // category, unit...
    entity: { type: String, required: true, trim: true, maxlength: 50 },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    // Mô tả ngắn, không chứa dữ liệu nhạy cảm (mật khẩu, token...).
    detail: { type: String, default: null, trim: true, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Admin xem nhật ký mới nhất, thường lọc theo nhóm / người dùng / loại thao tác.
logSchema.index({ createdAt: -1 });
logSchema.index({ groupId: 1, createdAt: -1 });
logSchema.index({ userId: 1, createdAt: -1 });
logSchema.index({ action: 1, entity: 1, createdAt: -1 });
logSchema.index({ entity: 1, createdAt: -1 });

module.exports = mongoose.model('Log', logSchema);
