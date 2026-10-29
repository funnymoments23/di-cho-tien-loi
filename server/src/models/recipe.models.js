const mongoose = require('mongoose');

// Công thức nấu ăn gắn với một thực phẩm của nhóm.
// `htmlContent` là nội dung chi tiết dạng HTML để app render bằng
// react-native-render-html (docs/01 mục 2.2).
const recipeSchema = new mongoose.Schema({
  foodId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Food', required: true },
  // Thực phẩm đã thuộc một nhóm; lưu thêm groupId để lọc công thức theo nhóm
  // mà không phải join qua foods mỗi lần.
  groupId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  name:        { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  htmlContent: { type: String, required: true },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Lấy công thức theo món ăn (GET /recipe?foodId=...) và theo nhóm.
recipeSchema.index({ groupId: 1, foodId: 1 });
recipeSchema.index({ groupId: 1, name: 1 });

module.exports = mongoose.model('Recipe', recipeSchema);
