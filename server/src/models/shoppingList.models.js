const mongoose = require('mongoose');

// Danh sách đi chợ của một nhóm gia đình, do trưởng nhóm tạo và phân công
// cho một thành viên (đề mục B.1, đặc tả API `shopping/`).
const shoppingListSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true, maxlength: 100 },
  groupId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  // Người được trưởng nhóm giao đi chợ.
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  note:       { type: String, default: null, trim: true, maxlength: 500 },
  // Ngày dự định đi chợ; cho phép null để tạo danh sách chưa chốt ngày.
  date:       { type: Date, default: null },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// GET /shopping/task: lấy danh sách đi chợ của đúng nhóm đang đăng nhập.
shoppingListSchema.index({ groupId: 1, date: 1 });
// Tra cứu danh sách được giao cho một thành viên.
shoppingListSchema.index({ assignedTo: 1 });

module.exports = mongoose.model('ShoppingList', shoppingListSchema);
