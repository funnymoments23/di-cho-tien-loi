const { v2: cloudinary } = require('cloudinary');

// Cấu hình một lần khi module được require (server.js đã nạp dotenv trước đó).
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const REQUIRED_ENV = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

/** Kiểm tra đã điền đủ 3 biến môi trường Cloudinary hay chưa. */
const isConfigured = () => REQUIRED_ENV.every((key) => Boolean(process.env[key]));

/**
 * Upload một Buffer (ảnh từ multer.memoryStorage) lên Cloudinary.
 *
 * @param {Buffer} buffer nội dung tệp
 * @param {object} [options] tùy chọn của cloudinary.uploader.upload_stream
 * @returns {Promise<object>} kết quả upload (secure_url, public_id, ...)
 */
const uploadBuffer = (buffer, options = {}) => {
  if (!isConfigured()) {
    return Promise.reject(
      new Error('Cloudinary chưa được cấu hình: thiếu CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET.')
    );
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
};

module.exports = { cloudinary, isConfigured, uploadBuffer };
