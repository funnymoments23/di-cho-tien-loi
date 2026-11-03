// Tạo một tài khoản test đã xác minh email và chưa thuộc nhóm nào.
// Chạy: npm run seed:user
// Có thể override bằng SEED_USER_EMAIL / SEED_USER_PASSWORD / SEED_USER_NAME / SEED_USER_USERNAME.
if (process.env.NODE_ENV !== 'test') require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../src/config/database');
const User = require('../src/models/user.models');

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const readConfig = (overrides = {}) => {
  const email = String(overrides.email ?? process.env.SEED_USER_EMAIL ?? 'user1@example.com')
    .trim()
    .toLowerCase();
  const password = String(overrides.password ?? process.env.SEED_USER_PASSWORD ?? '123456');
  const name = String(overrides.name ?? process.env.SEED_USER_NAME ?? 'Người dùng test').trim();
  const username = String(
    overrides.username ?? process.env.SEED_USER_USERNAME ?? 'user1'
  ).trim();

  if (!email) throw new Error('Thiếu SEED_USER_EMAIL');
  if (!EMAIL_PATTERN.test(email)) throw new Error(`Email không hợp lệ: ${email}`);
  if (password.length < 6 || password.length > 20) {
    throw new Error('SEED_USER_PASSWORD phải dài từ 6 đến 20 ký tự.');
  }
  if (name.length < 3 || name.length > 30) {
    throw new Error('SEED_USER_NAME phải dài từ 3 đến 30 ký tự.');
  }
  if (username.length < 3 || username.length > 15) {
    throw new Error('SEED_USER_USERNAME phải dài từ 3 đến 15 ký tự.');
  }

  return { email, password, name, username };
};

const seedUser = async (overrides = {}) => {
  const { email, password, name, username } = readConfig(overrides);

  const emailOwner = await User.findOne({ email }).select('_id');
  if (emailOwner) {
    throw new Error(`Email "${email}" đã tồn tại. Đặt SEED_USER_EMAIL khác.`);
  }

  const usernameOwner = await User.findOne({ username }).select('_id');
  if (usernameOwner) {
    throw new Error(`Username "${username}" đã tồn tại. Đặt SEED_USER_USERNAME khác.`);
  }

  const user = await User.create({
    email,
    password: await bcrypt.hash(password, BCRYPT_ROUNDS),
    name,
    username,
    role: 'user',
    isVerified: true,
    isActive: true,
    groupId: null,
    language: 'vi',
    timezone: 'Asia/Ho_Chi_Minh',
  });

  return { user, password };
};

const run = async () => {
  try {
    await connectDB();
    const { user, password } = await seedUser();
    console.log('✓ Đã tạo user test chưa có nhóm:');
    console.log(`  Email:    ${user.email}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Password: ${password}`);
    console.log(`  GroupId:  ${user.groupId ?? 'null'}`);
    console.log(`  Verified: ${user.isVerified}`);
    await mongoose.disconnect();
  } catch (err) {
    console.error('Tạo user test thất bại:', err.message);
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  }
};

if (require.main === module) {
  run();
}

module.exports = { seedUser, readConfig };
