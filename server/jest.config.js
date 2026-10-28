/** Cấu hình Jest cho test backend (chỉ chạy trong thư mục server/). */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setup-env.js'],
  clearMocks: true,
  testTimeout: 60000,
  verbose: true,
};
