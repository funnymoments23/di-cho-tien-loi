const AppError = require("./AppError");

const sendSuccess = (res,rc,data=null)=>{
    return res.status(rc.status).json({
        code: rc.code,
        message: rc.message,
        data,
    })
};
const fail = (rc)=>new AppError(rc.message, rc.status, rc.code);

module.exports={sendSuccess, fail}