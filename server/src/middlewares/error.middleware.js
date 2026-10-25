const AppError = require('../utils/AppError');

//404: route không hợp lê
const notFound = (req, res, next)=> {
    next(new AppError(`Không tìm thấy đường dẫn: ${req.originalUrl}`, 404, '00404'));
};
//Xử lí lỗi tập trung
const errorHandler = (err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        err = new AppError('Dữ liệu JSON không hợp lệ',404,'00404')
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