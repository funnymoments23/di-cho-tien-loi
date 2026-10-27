const nodemailer = require('nodemailer');

let transporter = null;

const smtpConfig = () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT) || 587;
  return { host, port, user, pass };
};

const getTransporter = (config) => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
    });
  }
  return transporter;
};

/**
 * Gửi mã xác minh 6 số tới email người dùng.
 *
 * Chưa cấu hình SMTP ở môi trường dev thì chỉ in mã ra console để test Postman,
 * không làm hỏng luồng đăng ký. Ở production mà thiếu cấu hình thì ném lỗi.
 */
const sendVerificationCode = async (email, code) => {
  const config = smtpConfig();
  if (!config) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Thiếu cấu hình SMTP_HOST / SMTP_USER / SMTP_PASS trong file .env');
    }
    console.warn(`[email] Chưa cấu hình SMTP. Mã xác minh của ${email} là: ${code}`);
    return { delivered: false, devCode: code };
  }

  const from = process.env.MAIL_FROM || config.user;
  await getTransporter(config).sendMail({
    from: `"Đi chợ tiện lợi" <${from}>`,
    to: email,
    subject: 'Mã xác minh email của bạn',
    text: `Mã xác minh của bạn là ${code}. Mã có hiệu lực trong 10 phút.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
        <h2>Đi chợ tiện lợi</h2>
        <p>Mã xác minh email của bạn là:</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:16px 0">${code}</p>
        <p>Mã có hiệu lực trong <b>10 phút</b>. Nếu bạn không đăng ký tài khoản, hãy bỏ qua email này.</p>
      </div>
    `,
  });

  return { delivered: true };
};

module.exports = { sendVerificationCode };
