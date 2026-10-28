const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const AppError = require('../utils/AppError');
const RC = require('../constants/responseCode');

// Ảnh lưu trên đĩa của server, phục vụ qua /it4788/uploads.
// Khi triển khai thật có thể thay storage này bằng Cloudinary (xem docs/01).
const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');
const AVATAR_DIR = path.join(UPLOAD_ROOT, 'avatars');
const FOOD_DIR = path.join(UPLOAD_ROOT, 'foods');
[AVATAR_DIR, FOOD_DIR].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new AppError('Chỉ chấp nhận tệp ảnh.', 400, RC.FOOD_CREATE_UPLOAD_FAILED.code));
  }
  cb(null, true);
};

/**
 * Tạo middleware nhận 1 ảnh ở field `image` (multipart/form-data), lưu vào `directory`.
 *
 * @param {string} directory  thư mục đích trên đĩa
 * @param {string} publicDir  tên thư mục con dưới /it4788/uploads
 * @param {object} [options]
 * @param {string} [options.bodyField] tên trường trong req.body sẽ nhận đường dẫn ảnh
 *                                     (để middleware validate phía sau nhìn thấy).
 */
const createImageUploader = (directory, publicDir, { bodyField } = {}) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, directory),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ALLOWED_EXT.includes(ext) ? ext : '.jpg';
      cb(null, `${req.user?.id || 'user'}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${safeExt}`);
    },
  });

  const instance = multer({
    storage,
    limits: { fileSize: MAX_SIZE_BYTES },
    fileFilter,
  });

  return (req, res, next) => {
    instance.single('image')(req, res, (err) => {
      if (err) {
        if (err instanceof AppError) return next(err);
        const message =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'Ảnh vượt quá dung lượng cho phép (5MB).'
            : RC.FOOD_CREATE_UPLOAD_FAILED.message;
        return next(new AppError(message, 400, RC.FOOD_CREATE_UPLOAD_FAILED.code));
      }

      // Ghi đường dẫn vào body trước bước validate để body chỉ có ảnh vẫn hợp lệ.
      if (req.file && bodyField) {
        req.body[bodyField] = `/it4788/uploads/${publicDir}/${req.file.filename}`;
      }

      next();
    });
  };
};

/** Ảnh đại diện người dùng; controller tự gán req.body.avatar (giữ tương thích cũ). */
const uploadAvatar = createImageUploader(AVATAR_DIR, 'avatars');

/** Ảnh thực phẩm; tự gán req.body.image để validate nhận ra trường ảnh. */
const uploadFoodImage = createImageUploader(FOOD_DIR, 'foods', { bodyField: 'image' });

module.exports = { uploadAvatar, uploadFoodImage, AVATAR_DIR, FOOD_DIR };
