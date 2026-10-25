require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/database');

(async () => {
  try {
    await connectDB();
    const res = await mongoose.connection.db.admin().ping();
    console.log('Ping:', res);
    console.log('KẾT NỐI THÀNH CÔNG');
    process.exit(0);
  } catch (err) {
    console.error('KẾT NỐI THẤT BẠI:', err.message);
    process.exit(1);
  }
})();
