require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/database');
const { startExpiryChecker } = require('./src/jobs/expiryChecker.job');

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server chạy tại http://localhost:${PORT}/it4788/`);
      startExpiryChecker();
    });
  } catch (err) {
    console.error('Không thể khởi động server:', err.message);
    process.exit(1);
  }
})();
