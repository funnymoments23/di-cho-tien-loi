const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const AppError = require('../utils/AppError');
const RC = require('../constants/responseCode');

// Ảnh đại diện lưu trên đĩa của server, phục vụ qua /it4788/uploads.
// Khi triển khai thật có thể thay storage này bằng Cloudinary (xem docs/01).
const AVATAR_DIR = path.join(__dirname, '..', '..', 'uploads', 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXT.includes(ext) ? ext : '.jpg';
    cb(null, `${req.user?.id || 'user'}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new AppError('Chỉ chấp nhận tệp ảnh.', 400, RC.FOOD_CREATE_UPLOAD_FAILED.code));
    }
    cb(null, true);
  },
});

/**
 * Nhận 1 ảnh ở field `image` (multipart/form-data).
 * Mọi lỗi của multer (sai loại tệp, quá 5MB...) trả 400 / 00158 "đăng tải ảnh thất bại".
 * Request JSON thường đi qua middleware này mà không bị ảnh hưởng.
 */
const uploadAvatar = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof AppError) return next(err);
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Ảnh vượt quá dung lượng cho phép (5MB).'
        : RC.FOOD_CREATE_UPLOAD_FAILED.message;
    next(new AppError(message, 400, RC.FOOD_CREATE_UPLOAD_FAILED.code));
  });
};

module.exports = { uploadAvatar, AVATAR_DIR };
