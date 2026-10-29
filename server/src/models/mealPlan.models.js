const mongoose = require('mongoose');

// Kế hoạch bữa ăn của nhóm: mỗi document là một món được xếp vào
// bữa sáng / trưa / tối của một ngày cụ thể.
const mealPlanSchema = new mongoose.Schema({
  groupId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  foodId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Food', required: true },
  timestamp: { type: Date, required: true },
  // Tên bữa: sáng / trưa / tối (mã 00316). Service chuẩn hoá trước khi lưu.
  name:      { type: String, required: true, enum: ['sáng', 'trưa', 'tối'] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Xem lịch bữa ăn theo ngày / tuần (docs/01 mục 2.3).
mealPlanSchema.index({ groupId: 1, timestamp: 1 });

module.exports = mongoose.model('MealPlan', mealPlanSchema);
