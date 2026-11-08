import {
  AppstoreOutlined,
  DashboardOutlined,
  DownOutlined,
  ExperimentOutlined,
  HistoryOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ShoppingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  App as AntApp,
  Avatar,
  Button,
  Dropdown,
  Layout,
  Menu,
  Space,
  Typography,
} from 'antd';
import type { MenuProps } from 'antd';
import { useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

const { Header, Sider, Content, Footer } = Layout;

interface NavItem {
  key: string;
  icon: ReactNode;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: '/', icon: <DashboardOutlined />, label: 'Tổng quan' },
  { key: '/users', icon: <TeamOutlined />, label: 'Người dùng' },
  { key: '/categories', icon: <AppstoreOutlined />, label: 'Danh mục' },
  { key: '/units', icon: <ExperimentOutlined />, label: 'Đơn vị đo' },
  { key: '/logs', icon: <HistoryOutlined />, label: 'Nhật ký hệ thống' },
];

const getSelectedKey = (pathname: string): string => {
  const match = NAV_ITEMS.map((item) => item.key).find(
    (key) => key !== '/' && (pathname === key || pathname.startsWith(`${key}/`))
  );
  return match ?? '/';
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = AntApp.useApp();
  const [collapsed, setCollapsed] = useState(false);

  const selectedKey = getSelectedKey(location.pathname);
  const currentTitle =
    NAV_ITEMS.find((item) => item.key === selectedKey)?.label ?? 'Quản trị';

  const handleLogout = async () => {
    await logout();
    message.success('Bạn đã đăng xuất.');
    navigate('/login', { replace: true });
  };

  const userMenu: MenuProps = {
    items: [
      {
        key: 'account',
        disabled: true,
        label: (
          <div className="account-menu-info">
            <Typography.Text strong>{user?.name ?? 'Quản trị viên'}</Typography.Text>
            <Typography.Text type="secondary" className="account-menu-email">
              {user?.email}
            </Typography.Text>
          </div>
        ),
      },
      { type: 'divider' },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Đăng xuất',
        danger: true,
        onClick: handleLogout,
      },
    ],
  };

  return (
    <Layout className="app-shell">
      <Sider
        className="app-sider"
        theme="light"
        width={244}
        collapsedWidth={0}
        collapsible
        collapsed={collapsed}
        trigger={null}
        breakpoint="lg"
        onBreakpoint={(broken) => setCollapsed(broken)}
      >
        <div className="brand">
          <span className="brand-icon">
            <ShoppingOutlined />
          </span>
          <div className="brand-text">
            <div className="brand-name">Đi chợ tiện lợi</div>
            <div className="brand-sub">Quản trị hệ thống</div>
          </div>
        </div>

        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={NAV_ITEMS.map(({ key, icon, label }) => ({ key, icon, label }))}
          onClick={({ key }) => {
            navigate(key);
            if (window.innerWidth < 992) setCollapsed(true);
          }}
          className="app-menu"
        />
      </Sider>

      <Layout>
        <Header className="app-header">
          <Space size={12}>
            <Button
              type="text"
              aria-label={collapsed ? 'Mở menu' : 'Đóng menu'}
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((value) => !value)}
            />
            <Typography.Text className="header-title">{currentTitle}</Typography.Text>
          </Space>

          <Dropdown menu={userMenu} trigger={['click']} placement="bottomRight">
            <Button type="text" className="user-button">
              <Avatar src={user?.avatar || undefined} icon={<UserOutlined />} size={32} />
              <span className="user-name">{user?.name ?? 'Quản trị viên'}</span>
              <DownOutlined className="user-caret" />
            </Button>
          </Dropdown>
        </Header>

        <Content className="app-content">
          <Outlet />
        </Content>

        <Footer className="app-footer">
          Đi chợ tiện lợi · IT4788 · {new Date().getFullYear()}
        </Footer>
      </Layout>
    </Layout>
  );
}
