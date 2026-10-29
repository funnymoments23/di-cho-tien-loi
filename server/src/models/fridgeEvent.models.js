const mongoose = require('mongoose');

// Lịch sử một mục rời khỏi tủ lạnh — nguồn dữ liệu cho báo cáo tiêu thụ / lãng phí
// (đề mục B.6, docs/02 mục 3.3). Chỉ ghi khi xoá mục khỏi tủ; `FridgeItem` vẫn là
// ảnh chụp hiện tại nên không thể tái tạo lịch sử nếu thiếu bảng này.
//
// Các trường tên thực phẩm / danh mục / đơn vị được lưu lại (denormalize) để báo
// cáo vẫn đúng khi thực phẩm bị đổi tên hoặc bị xoá sau đó.
const fridgeEventSchema = new mongoose.Schema(
  {
    groupId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
    // Có thể trỏ tới thực phẩm đã bị xoá; báo cáo dùng các trường tên bên dưới.
    foodId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Food', default: null },
    foodName:     { type: String, required: true, trim: true, maxlength: 100 },
    categoryName: { type: String, default: null, trim: true, maxlength: 50 },
    unitName:     { type: String, default: null, trim: true, maxlength: 50 },
    quantity:     { type: Number, required: true, min: 0 },
    // Hạn sử dụng của mục tại thời điểm xoá, phục vụ phân tích lãng phí.
    expiryDate:   { type: Date, required: true },
    location:     { type: String, default: null, trim: true, maxlength: 50 },
    /**
     * consumed  — dùng hết trước hạn (tiêu thụ)
     * expired   — bỏ vì đã hết hạn (lãng phí)
     * discarded — bỏ dù còn hạn (lãng phí, lý do khác)
     */
    action:       {
      type: String,
      required: true,
      enum: ['consumed', 'expired', 'discarded'],
    },
    actedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Báo cáo tiêu thụ / lãng phí luôn lọc theo nhóm + khoảng thời gian + loại hành động.
fridgeEventSchema.index({ groupId: 1, createdAt: -1 });
fridgeEventSchema.index({ groupId: 1, action: 1, createdAt: -1 });
// Thống kê theo thực phẩm.
fridgeEventSchema.index({ groupId: 1, foodId: 1, createdAt: -1 });

module.exports = mongoose.model('FridgeEvent', fridgeEventSchema);
