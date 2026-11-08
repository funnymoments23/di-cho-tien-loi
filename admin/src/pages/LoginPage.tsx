import { Alert, Button, Form, Input, Typography } from 'antd';
import {
  AppstoreOutlined,
  HistoryOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  ShoppingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ApiError, SESSION_EXPIRED_FLAG } from '../api/client';
import { useAuth } from '../store/AuthContext';
import { getErrorMessage } from '../utils/errors';

interface LoginForm {
  email: string;
  password: string;
}

const SESSION_EXPIRED_MESSAGE =
  'Phiên đăng nhập đã hết hạn hoặc tài khoản đã bị khoá. Vui lòng đăng nhập lại.';

export default function LoginPage() {
  const { user, initializing, login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_EXPIRED_FLAG)) {
      sessionStorage.removeItem(SESSION_EXPIRED_FLAG);
      setNotice(SESSION_EXPIRED_MESSAGE);
    }
  }, []);

  const handleSubmit = async (values: LoginForm) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await login(values.email.trim(), values.password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === '00017') {
        setError(err.message);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  if (initializing) return <div className="full-screen-center" />;
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="login-page">
      <div className="login-panel login-panel-brand">
        <div className="login-brand">
          <span className="login-brand-icon">
            <ShoppingOutlined />
          </span>
          <Typography.Title level={1} className="login-brand-name">
            Đi chợ tiện lợi
          </Typography.Title>
          <Typography.Paragraph className="login-brand-desc">
            Quản lý người dùng, danh mục thực phẩm, đơn vị đo và theo dõi toàn bộ
            thao tác trong hệ thống.
          </Typography.Paragraph>
        </div>
        <div className="login-brand-points">
          <div>
            <TeamOutlined />
            <span>Quản lý tài khoản &amp; phân quyền</span>
          </div>
          <div>
            <AppstoreOutlined />
            <span>Danh mục và đơn vị dùng chung</span>
          </div>
          <div>
            <HistoryOutlined />
            <span>Nhật ký thao tác đầy đủ</span>
          </div>
        </div>
      </div>

      <div className="login-panel login-panel-form">
        <div className="login-card">
          <div className="login-card-head">
            <SafetyCertificateOutlined className="login-card-icon" />
            <Typography.Title level={2} className="login-title">
              Đăng nhập quản trị
            </Typography.Title>
            <Typography.Text type="secondary">
              Dành cho tài khoản có quyền quản trị hệ thống.
            </Typography.Text>
          </div>

          {notice && (
            <Alert
              type="warning"
              showIcon
              closable
              message={notice}
              onClose={() => setNotice(null)}
              className="login-alert"
            />
          )}
          {error && (
            <Alert
              type="error"
              showIcon
              closable
              message={error}
              onClose={() => setError(null)}
              className="login-alert"
            />
          )}

          <Form<LoginForm>
            layout="vertical"
            requiredMark={false}
            onFinish={handleSubmit}
            initialValues={{ email: '', password: '' }}
            size="large"
          >
            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: 'Vui lòng nhập email.' },
                { type: 'email', message: 'Email không hợp lệ.' },
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="admin@example.com"
                autoComplete="username"
                autoFocus
              />
            </Form.Item>

            <Form.Item
              label="Mật khẩu"
              name="password"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu.' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
              />
            </Form.Item>

            <Button type="primary" htmlType="submit" block loading={loading}>
              Đăng nhập
            </Button>
          </Form>

          <Typography.Paragraph type="secondary" className="login-hint">
            Tài khoản admin được tạo bằng lệnh <code>npm run seed:admin</code>{' '}
            trong thư mục <code>server/</code>.
          </Typography.Paragraph>
        </div>
      </div>
    </div>
  );
}
