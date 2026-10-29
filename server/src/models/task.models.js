const mongoose = require('mongoose');

// Từng món cần mua trong một danh sách đi chợ (`shopping/task/`).
// Mỗi thực phẩm chỉ xuất hiện một lần trong cùng một danh sách (mã 00285x, 00309).
const taskSchema = new mongoose.Schema({
  listId:      { type: mongoose.Schema.Types.ObjectId, ref: 'ShoppingList', required: true },
  foodId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Food', required: true },
  quantity:    { type: Number, required: true, min: 0 },
  // Đã mua xong chưa — trường bổ sung vì đặc tả API thiếu
  // (đề mục B.1, docs/02 mục 3.5).
  isCompleted: { type: Boolean, default: false },
}, { timestamps: true });

// Ràng buộc 00285x/00309: một thực phẩm chỉ có một nhiệm vụ trong mỗi danh sách.
taskSchema.index({ listId: 1, foodId: 1 }, { unique: true });
// GET /shopping/task gom nhiệm vụ theo danh sách.
taskSchema.index({ listId: 1, createdAt: 1 });

module.exports = mongoose.model('Task', taskSchema);
