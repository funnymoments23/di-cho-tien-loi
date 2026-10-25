const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Thiếu biến MONGODB_URI trong file .env');
  }
  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log(`MongoDB đã kết nối: ${conn.connection.host} / db: ${conn.connection.name}`);
  return conn;
};

module.exports = connectDB;
