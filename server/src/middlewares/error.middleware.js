const AppError = require('../utils/AppError');
const RC = require('../constants/responseCode');

const fromRC = (rc) => new AppError(rc.message, rc.status, rc.code);

//404: route không hợp lê
const notFound = (req, res, next)=> {
    next(new AppError(`Không tìm thấy đường dẫn: ${req.originalUrl}`, 404, '00404'));
};
//Xử lí lỗi tập trung
const errorHandler = (err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        err = new AppError('Dữ liệu JSON không hợp lệ',404,'00404')
    }

    // Trùng khoá unique của MongoDB (thường do 2 request đăng ký cùng lúc).
    // err.code ở đây là mã lỗi số của Mongo, không phải mã response dạng chuỗi.
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern || err.keyValue || {})[0];
        err = fromRC(field === 'username' ? RC.EDIT_USER_USERNAME_EXISTS : RC.REGISTER_EMAIL_EXISTS);
    }

    // :id truyền vào không phải ObjectId hợp lệ.
    if (err.name === 'CastError') {
        err = fromRC(RC.ID_INVALID_OBJECT_ID);
    }

    const isKnown = err.isOperational === true;
    if (!isKnown) console.log(err);

    res.status(isKnown ? err.statusCode : 500).json({
    code: isKnown ? err.code : '00500',
    message: isKnown ? err.message : 'Lỗi máy chủ.',
    data: null,
  });
};

module.exports={notFound, errorHandler}