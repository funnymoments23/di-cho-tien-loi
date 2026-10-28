const mongoose = require('mongoose');

// Danh mục thực phẩm của từng nhóm gia đình.
// Tên chỉ cần duy nhất trong phạm vi một nhóm: hai nhóm khác nhau có thể
// cùng có món "Thịt bò" mà không ảnh hưởng nhau.
const foodSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true, maxlength: 100 },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  unitId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
  image:      { type: String, default: null },
  groupId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Ràng buộc 00151: không trùng tên thực phẩm trong cùng một nhóm.
foodSchema.index({ groupId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Food', foodSchema);
