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
 * Gửi một mã 6 số tới email người dùng.
 *
 * Chưa cấu hình SMTP ở môi trường dev thì chỉ in mã ra console để test Postman,
 * không làm hỏng luồng đăng ký / quên mật khẩu. Ở production mà thiếu cấu hình
 * thì ném lỗi.
 *
 * @param {object} params
 * @param {string} params.to           email người nhận
 * @param {string} params.code         mã 6 số
 * @param {string} params.label        tên mã dùng trong console ("Mã xác minh", ...)
 * @param {string} params.subject      tiêu đề email
 * @param {string} params.intro        câu dẫn trước mã
 * @param {string} params.warning      câu nhắc ở cuối email
 * @param {number} params.ttlMinutes   thời hạn của mã để hiển thị
 */
const sendCodeEmail = async ({ to, code, label, subject, intro, warning, ttlMinutes }) => {
  const config = smtpConfig();
  if (!config) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Thiếu cấu hình SMTP_HOST / SMTP_USER / SMTP_PASS trong file .env');
    }
    console.warn(`[email] Chưa cấu hình SMTP. ${label} của ${to} là: ${code}`);
    return { delivered: false, devCode: code };
  }

  const from = process.env.MAIL_FROM || config.user;
  await getTransporter(config).sendMail({
    from: `"Đi chợ tiện lợi" <${from}>`,
    to,
    subject,
    text: `${intro} ${code}. Mã có hiệu lực trong ${ttlMinutes} phút.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
        <h2>Đi chợ tiện lợi</h2>
        <p>${intro}</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:16px 0">${code}</p>
        <p>Mã có hiệu lực trong <b>${ttlMinutes} phút</b>. ${warning}</p>
      </div>
    `,
  });

  return { delivered: true };
};

/** Mã xác minh email sau khi đăng ký. */
const sendVerificationCode = (email, code) =>
  sendCodeEmail({
    to: email,
    code,
    label: 'Mã xác minh',
    subject: 'Mã xác minh email của bạn',
    intro: 'Mã xác minh email của bạn là:',
    warning: 'Nếu bạn không đăng ký tài khoản, hãy bỏ qua email này.',
    ttlMinutes: 10,
  });

/** Mã đặt lại mật khẩu khi người dùng bấm "Quên mật khẩu". */
const sendPasswordResetCode = (email, code) =>
  sendCodeEmail({
    to: email,
    code,
    label: 'Mã đặt lại mật khẩu',
    subject: 'Mã đặt lại mật khẩu',
    intro: 'Bạn (hoặc ai đó) đã yêu cầu đặt lại mật khẩu. Mã xác nhận của bạn là:',
    warning:
      'Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này — mật khẩu hiện tại vẫn giữ nguyên.',
    ttlMinutes: 10,
  });

module.exports = { sendVerificationCode, sendPasswordResetCode };
