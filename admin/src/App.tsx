import { App as AntApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import CategoriesPage from './pages/CategoriesPage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import LogsPage from './pages/LogsPage';
import NotFoundPage from './pages/NotFoundPage';
import UnitsPage from './pages/UnitsPage';
import UsersPage from './pages/UsersPage';
import { AuthProvider } from './store/AuthContext';

export default function App() {
  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          colorPrimary: '#16a34a',
          colorInfo: '#16a34a',
          colorSuccess: '#16a34a',
          borderRadius: 10,
          fontFamily:
            "'Be Vietnam Pro', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        },
        components: {
          Layout: {
            headerBg: '#ffffff',
            siderBg: '#ffffff',
            bodyBg: '#f5f7f6',
            footerBg: '#f5f7f6',
          },
          Menu: {
            itemSelectedBg: '#dcfce7',
            itemSelectedColor: '#15803d',
            itemBorderRadius: 8,
            itemHeight: 44,
          },
          Table: {
            headerBg: '#f8fafc',
            headerColor: '#334155',
          },
          Card: {
            boxShadowTertiary: '0 1px 2px rgba(15, 23, 42, 0.04)',
          },
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="units" element={<UnitsPage />} />
                <Route path="logs" element={<LogsPage />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}
