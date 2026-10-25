const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  name:     { type: String, required: true, trim: true },
  username: { type: String, unique: true, sparse: true, trim: true },
  avatar:   { type: String, default: null },
  language: { type: String, enum: ['vi', 'en'], default: 'vi' },
  timezone: { type: String, default: 'Asia/Ho_Chi_Minh' },
  deviceToken: { type: String, default: null },
  isVerified:  { type: Boolean, default: false },
  verificationCode:          { type: String, select: false },
  verificationCodeExpiresAt: { type: Date,   select: false },
  refreshToken: { type: String, select: false },
  role:    { type: String, enum: ['user', 'admin'], default: 'user' },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
