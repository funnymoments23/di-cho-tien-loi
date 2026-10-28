// Biến môi trường riêng cho test.
// Phải nằm trong `setupFiles` để chạy TRƯỚC khi app/jwt.js được require:
// jwt.js đọc và cache secret ngay lần dùng đầu tiên.
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_VERIFY_SECRET = 'test-verify-secret';
// bcrypt 4 vòng cho nhanh; logic không đổi.
process.env.BCRYPT_ROUNDS = '4';
process.env.VERIFICATION_CODE_TTL_MINUTES = '10';
// Tắt rate limit cho bộ test chức năng; test riêng ở tests/rate-limit.test.js.
process.env.AUTH_RATE_LIMIT_MAX = '0';
