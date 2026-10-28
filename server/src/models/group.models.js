const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true, maxlength: 50 },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

// Truy vấn nhóm theo trưởng nhóm và theo thành viên (GET /user/group).
groupSchema.index({ adminId: 1 });
groupSchema.index({ members: 1 });

module.exports = mongoose.model('Group', groupSchema);
