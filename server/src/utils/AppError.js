class AppError extends Error {
    constructor(message, statusCode=500, code='00500') {
        super(message);
        this.name='AppError';
        this.statusCode=statusCode;
        this.code=code;
        this.isOperational=true;

        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports=AppError