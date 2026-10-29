// Khi chạy CLI mới nạp .env; test tự cấu hình DB in-memory và không cần file .env.
if (process.env.NODE_ENV !== 'test') require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../src/config/database');
const User = require('../src/models/user.models');

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Đọc và kiểm tra cấu hình tài khoản admin.
 * Có thể truyền override (dùng cho test), mặc định đọc từ biến môi trường.
 */
const readConfig = (overrides = {}) => {
  const email = String(overrides.email ?? process.env.ADMIN_EMAIL ?? '')
    .trim()
    .toLowerCase();
  const password = String(overrides.password ?? process.env.ADMIN_PASSWORD ?? '');
  const name = String(overrides.name ?? process.env.ADMIN_NAME ?? 'Quản trị viên').trim();
  // Không đặt mặc định ở đây: tài khoản đã tồn tại sẽ giữ username cũ nếu không truyền.
  const username = String(overrides.username ?? process.env.ADMIN_USERNAME ?? '').trim();

  if (!email) throw new Error('Thiếu ADMIN_EMAIL trong file .env');
  if (!EMAIL_PATTERN.test(email)) throw new Error(`ADMIN_EMAIL không hợp lệ: ${email}`);

  if (!password) throw new Error('Thiếu ADMIN_PASSWORD trong file .env');
  if (password.length < 6 || password.length > 20) {
    throw new Error('ADMIN_PASSWORD phải dài từ 6 đến 20 ký tự (theo validate của hệ thống).');
  }

  if (name.length < 3 || name.length > 30) {
    throw new Error('ADMIN_NAME phải dài từ 3 đến 30 ký tự.');
  }

  if (username && (username.length < 3 || username.length > 15)) {
    throw new Error('ADMIN_USERNAME phải dài từ 3 đến 15 ký tự.');
  }

  return { email, password, name, username };
};

/**
 * Tạo mới hoặc nâng quyền một tài khoản thành admin.
 *
 * - Nếu email đã tồn tại: cập nhật mật khẩu, tên, role = admin, isVerified = true,
 *   mở khoá tài khoản và đặt username nếu có truyền.
 * - Nếu chưa tồn tại: tạo tài khoản mới với username mặc định `admin`.
 * - Không xoá groupId/deviceToken/avatar của tài khoản đã có.
 *
 * @param {object} [overrides] { email, password, name, username }
 * @returns {Promise<{user: object, created: boolean}>}
 */
const seedAdmin = async (overrides = {}) => {
  const { email, password, name, username } = readConfig(overrides);

  const existing = await User.findOne({ email });
  const finalUsername = username || (existing ? existing.username : 'admin');

  if (finalUsername) {
    const owner = await User.findOne({ username: finalUsername }).select('_id');
    if (owner && (!existing || !owner._id.equals(existing._id))) {
      throw new Error(
        `Username "${finalUsername}" đã thuộc về tài khoản khác. Đặt ADMIN_USERNAME khác trong .env.`
      );
    }
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  if (existing) {
    existing.password = passwordHash;
    existing.name = name;
    existing.role = 'admin';
    existing.isVerified = true;
    existing.isActive = true;
    existing.lockedAt = null;
    if (username) existing.username = username;

    try {
      await existing.save();
    } catch (err) {
      if (err.code === 11000) {
        throw new Error(
          `Username "${finalUsername}" đã thuộc về tài khoản khác. Đặt ADMIN_USERNAME khác trong .env.`
        );
      }
      throw err;
    }

    return { user: existing, created: false };
  }

  try {
    const user = await User.create({
      email,
      password: passwordHash,
      name,
      username: finalUsername,
      role: 'admin',
      isVerified: true,
      isActive: true,
      language: 'vi',
      timezone: 'Asia/Ho_Chi_Minh',
    });
    return { user, created: true };
  } catch (err) {
    if (err.code === 11000) {
      throw new Error(
        `Email hoặc username đã tồn tại. Kiểm tra ADMIN_EMAIL / ADMIN_USERNAME trong .env.`
      );
    }
    throw err;
  }
};

const run = async () => {
  try {
    await connectDB();
    const { user, created } = await seedAdmin();
    console.log(
      `${created ? '✓ Đã tạo' : '✓ Đã cập nhật'} tài khoản admin: ${user.email} ` +
        `(username: ${user.username ?? 'chưa có'}, role: ${user.role})`
    );
    await mongoose.disconnect();
  } catch (err) {
    console.error('Tạo tài khoản admin thất bại:', err.message);
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  }
};

if (require.main === module) {
  run();
}

module.exports = { seedAdmin, readConfig };
