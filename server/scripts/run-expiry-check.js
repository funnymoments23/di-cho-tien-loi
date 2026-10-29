require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/database');
const { runExpiryCheck } = require('../src/jobs/expiryChecker.job');

// Chạy thủ công một lần (dùng để demo / kiểm tra trên môi trường thật):
//   npm run expiry:check
(async () => {
  try {
    await connectDB();
    const summary = await runExpiryCheck();
    console.log(JSON.stringify(summary, null, 2));
    await mongoose.disconnect();
  } catch (err) {
    console.error('Chạy kiểm tra hạn sử dụng thất bại:', err);
    process.exitCode = 1;
  }
})();
