const mongoose = require('mongoose');

// Thực phẩm đang có trong tủ lạnh của từng nhóm gia đình.
// Mỗi thực phẩm chỉ có một mục trong tủ của một nhóm (mã 00199);
// `expiryDate` là "useWithin" trong đặc tả API.
const fridgeItemSchema = new mongoose.Schema({
  foodId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Food', required: true },
  groupId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  quantity:   { type: Number, required: true, min: 0 },
  expiryDate: { type: Date, required: true },
  // Vị trí trong tủ: ngăn mát / ngăn đá / cánh tủ / ngoài tủ (đề mục B.3,
  // trường bổ sung vì đặc tả API thiếu — xem docs/02 mục 3.6).
  location:   { type: String, default: null, trim: true, maxlength: 50 },
  note:       { type: String, default: null, trim: true, maxlength: 500 },
  // Đã gửi thông báo sắp hết hạn chưa, tránh nhắc lặp mỗi ngày.
  isNotified: { type: Boolean, default: false },
}, { timestamps: true });

// Ràng buộc 00199: một thực phẩm chỉ có một mục trong tủ của một nhóm.
fridgeItemSchema.index({ groupId: 1, foodId: 1 }, { unique: true });
// Cron job quét theo hạn sử dụng.
fridgeItemSchema.index({ expiryDate: 1 });

module.exports = mongoose.model('FridgeItem', fridgeItemSchema);
