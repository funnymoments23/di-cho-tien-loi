const multer = require('multer');
const AppError = require('../utils/AppError');
const RC = require('../constants/responseCode');
const { uploadBuffer, isConfigured } = require('../config/cloudinary');

// Ảnh được giữ trong RAM (tối đa 5MB) rồi đẩy thẳng lên Cloudinary,
// không ghi xuống đĩa server để không mất ảnh khi deploy lại.
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const DEFAULT_FOLDER = 'di-cho-tien-loi';

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    return cb(new AppError('Chỉ chấp nhận tệp ảnh.', 400, RC.FOOD_CREATE_UPLOAD_FAILED.code));
  }
  cb(null, true);
};

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter,
});

/**
 * Tạo middleware nhận 1 ảnh ở field `image` (multipart/form-data),
 * upload lên Cloudinary và ghi URL trả về vào `req.file.url`.
 *
 * @param {string} folder  thư mục con trên Cloudinary (avatars, foods, ...)
 * @param {object} [options]
 * @param {string} [options.bodyField] tên trường trong req.body sẽ nhận URL ảnh
 *                                     (để middleware validate phía sau nhìn thấy).
 * @param {Array}  [options.transformation] cấu hình resize/crop của Cloudinary.
 */
const createImageUploader = (folder, { bodyField, transformation } = {}) => {
  return (req, res, next) => {
    memoryUpload.single('image')(req, res, async (err) => {
      if (err) {
        if (err instanceof AppError) return next(err);
        const message =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'Ảnh vượt quá dung lượng cho phép (5MB).'
            : RC.FOOD_CREATE_UPLOAD_FAILED.message;
        return next(new AppError(message, 400, RC.FOOD_CREATE_UPLOAD_FAILED.code));
      }

      if (!req.file) return next();

      try {
        const result = await uploadBuffer(req.file.buffer, {
          folder: `${process.env.CLOUDINARY_FOLDER || DEFAULT_FOLDER}/${folder}`,
          resource_type: 'image',
          transformation,
        });

        req.file.url = result.secure_url;
        req.file.publicId = result.public_id;

        // Ghi URL vào body trước bước validate để body chỉ có ảnh vẫn hợp lệ.
        if (bodyField) req.body[bodyField] = result.secure_url;

        next();
      } catch (uploadError) {
        if (process.env.NODE_ENV !== 'test') {
          console.error('Upload ảnh lên Cloudinary thất bại:', uploadError.message);
        }
        next(new AppError(RC.FOOD_CREATE_UPLOAD_FAILED.message, 502, RC.FOOD_CREATE_UPLOAD_FAILED.code));
      }
    });
  };
};

/** Ảnh đại diện người dùng; gán URL vào req.body.avatar. */
const uploadAvatar = createImageUploader('avatars', {
  bodyField: 'avatar',
  transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }],
});

/** Ảnh thực phẩm; gán URL vào req.body.image. */
const uploadFoodImage = createImageUploader('foods', {
  bodyField: 'image',
  transformation: [{ width: 1000, crop: 'limit' }],
});

// Cảnh báo sớm khi chạy dev mà chưa cấu hình Cloudinary.
if (!isConfigured() && process.env.NODE_ENV !== 'test') {
  console.warn('Cloudinary chưa được cấu hình: upload ảnh sẽ thất bại cho đến khi điền CLOUDINARY_* trong .env');
}

module.exports = { uploadAvatar, uploadFoodImage };
