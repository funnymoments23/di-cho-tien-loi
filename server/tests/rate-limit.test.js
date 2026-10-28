const request = require('supertest');

const app = require('../src/app');
const RC = require('../src/constants/responseCode');
const { authRateLimiter } = require('../src/middlewares/rateLimit.middleware');

const LOGIN = '/it4788/user/login';

// Gửi body rỗng: bị validate chặn ở 400 nên không cần kết nối DB,
// nhưng rate limiter chạy TRƯỚC validate nên vẫn đếm request.
const hitLogin = () => request(app).post(LOGIN).send({});

beforeEach(() => {
  authRateLimiter.reset();
  process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES = '15';
  process.env.AUTH_RATE_LIMIT_MAX = '3';
});

afterAll(() => {
  // Trả lại cấu hình tắt cho các file test khác.
  process.env.AUTH_RATE_LIMIT_MAX = '0';
});

describe('Rate limit các endpoint auth', () => {
  it('cho qua 3 request đầu, request thứ 4 trả 429 / 00024', async () => {
    for (let i = 0; i < 3; i += 1) {
      const res = await hitLogin();
      expect(res.status).toBe(400); // chưa bị chặn
      expect(res.body.code).toBe(RC.LOGIN_MISSING_FIELDS.code);
    }

    const blocked = await hitLogin();
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe(RC.TOO_MANY_REQUESTS.code);
    expect(blocked.headers['retry-after']).toMatch(/^\d+$/);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('áp dụng chung cho đăng ký, gửi mã và xác minh email', async () => {
    const endpoints = [
      { path: '/it4788/user', code: RC.REGISTER_MISSING_FIELDS.code },
      {
        path: '/it4788/user/send-verification-code',
        code: RC.SEND_CODE_MISSING_FIELDS.code,
      },
      { path: '/it4788/user/verify-email', code: RC.VERIFY_CODE_MISSING.code },
    ];

    for (const { path, code } of endpoints) {
      authRateLimiter.reset();
      process.env.AUTH_RATE_LIMIT_MAX = '1';

      expect((await request(app).post(path).send({})).body.code).toBe(code);

      const blocked = await request(app).post(path).send({});
      expect(blocked.status).toBe(429);
      expect(blocked.body.code).toBe(RC.TOO_MANY_REQUESTS.code);
    }
  });

  it('AUTH_RATE_LIMIT_MAX=0 tắt rate limit', async () => {
    process.env.AUTH_RATE_LIMIT_MAX = '0';

    for (let i = 0; i < 10; i += 1) {
      const res = await hitLogin();
      expect(res.status).toBe(400);
    }
  });
});
