const express = require('express');
const cors = require('cors');
const {notFound, errorHandler} = require('./middlewares/error.middleware')
const RC = require('./constants/responseCode');
const {sendSuccess} = require('./utils/response');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Tất cả API nằm dưới prefix /it4788. Khi có src/routes/index.js thì thay dòng health bằng:
// app.use('/it4788', require('./routes'));
app.get('/it4788/health', (req, res) => {
  sendSuccess(res, RC.HEALTH_OK);
});

// 404: không khớp route nào -> notFound ném AppError, errorHandler trả response
app.use(notFound);
app.use(errorHandler);

module.exports = app;
