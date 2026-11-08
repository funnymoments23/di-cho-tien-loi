import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ExperimentOutlined,
  HistoryOutlined,
  ReloadOutlined,
  RightOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listUsers } from '../api/adminUser.api';
import { listCategories } from '../api/category.api';
import { listLogs } from '../api/log.api';
import { listUnits } from '../api/unit.api';
import PageHeader from '../components/PageHeader';
import { API_URL } from '../config/env';
import { useAuth } from '../store/AuthContext';
import type { LogEntry } from '../types';
import { getErrorMessage } from '../utils/errors';
import { formatDateTime } from '../utils/format';

interface DashboardStats {
  users: number;
  categories: number;
  units: number;
  logs: number;
}

const ACTION_TAG: Record<string, { color: string; label: string }> = {
  CREATE: { color: 'green', label: 'Tạo' },
  UPDATE: { color: 'blue', label: 'Cập nhật' },
  DELETE: { color: 'red', label: 'Xoá' },
};

const ENTITY_LABEL: Record<string, string> = {
  user: 'Người dùng',
  group: 'Nhóm',
  category: 'Danh mục',
  unit: 'Đơn vị',
  food: 'Thực phẩm',
  fridge: 'Tủ lạnh',
  shopping: 'Đi chợ',
  task: 'Món cần mua',
  meal: 'Bữa ăn',
  recipe: 'Công thức',
};

const StatsEmpty: DashboardStats = { users: 0, categories: 0, units: 0, logs: 0 };

export default function DashboardPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [stats, setStats] = useState<DashboardStats>(StatsEmpty);
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const results = await Promise.allSettled([
      listUsers({ page: 1, limit: 1 }),
      listCategories(),
      listUnits(),
      listLogs({ page: 1, limit: 1 }),
      listLogs({ page: 1, limit: 5 }),
    ]);

    const [usersResult, categoriesResult, unitsResult, logsResult, recentResult] = results;
    const failed = results.find((result) => result.status === 'rejected');

    setStats({
      users: usersResult.status === 'fulfilled' ? usersResult.value.total : 0,
      categories: categoriesResult.status === 'fulfilled' ? categoriesResult.value.length : 0,
      units: unitsResult.status === 'fulfilled' ? unitsResult.value.length : 0,
      logs: logsResult.status === 'fulfilled' ? logsResult.value.total : 0,
    });
    setRecentLogs(recentResult.status === 'fulfilled' ? recentResult.value.items : []);

    if (failed && failed.status === 'rejected') {
      const text = getErrorMessage(failed.reason);
      setError(text);
      message.error(text);
    }

    setLoading(false);
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  const recentColumns: ColumnsType<LogEntry> = [
    {
      title: 'Thời gian',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: 'Hành động',
      dataIndex: 'action',
      key: 'action',
      width: 110,
      render: (value: string) => {
        const meta = ACTION_TAG[value];
        return <Tag color={meta?.color ?? 'default'}>{meta?.label ?? value}</Tag>;
      },
    },
    {
      title: 'Đối tượng',
      dataIndex: 'entity',
      key: 'entity',
      render: (value: string) => ENTITY_LABEL[value] ?? value,
    },
    {
      title: 'Người thực hiện',
      key: 'user',
      render: (_value, record) =>
        record.user ? (
          <div>
            <div>{record.user.name ?? record.user.username ?? '—'}</div>
            <Typography.Text type="secondary" className="small-text">
              {record.user.email}
            </Typography.Text>
          </div>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title={`Xin chào, ${user?.name ?? 'Quản trị viên'}!`}
        description="Tổng quan nhanh về dữ liệu hệ thống Đi chợ tiện lợi."
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
            Làm mới
          </Button>
        }
      />

      {error && (
        <Alert
          type="error"
          showIcon
          closable
          message="Không tải được đầy đủ số liệu"
          description={error}
          className="page-alert"
          onClose={() => setError(null)}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card hoverable className="stat-card" onClick={() => navigate('/users')}>
            <Statistic
              title="Người dùng"
              value={stats.users}
              loading={loading}
              prefix={<TeamOutlined className="stat-icon stat-green" />}
            />
            <div className="stat-link">
              Quản lý tài khoản <RightOutlined />
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card hoverable className="stat-card" onClick={() => navigate('/categories')}>
            <Statistic
              title="Danh mục thực phẩm"
              value={stats.categories}
              loading={loading}
              prefix={<AppstoreOutlined className="stat-icon stat-blue" />}
            />
            <div className="stat-link">
              Quản lý danh mục <RightOutlined />
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card hoverable className="stat-card" onClick={() => navigate('/units')}>
            <Statistic
              title="Đơn vị đo"
              value={stats.units}
              loading={loading}
              prefix={<ExperimentOutlined className="stat-icon stat-orange" />}
            />
            <div className="stat-link">
              Quản lý đơn vị <RightOutlined />
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card hoverable className="stat-card" onClick={() => navigate('/logs')}>
            <Statistic
              title="Bản ghi nhật ký"
              value={stats.logs}
              loading={loading}
              prefix={<HistoryOutlined className="stat-icon stat-purple" />}
            />
            <div className="stat-link">
              Xem nhật ký <RightOutlined />
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="dashboard-row">
        <Col xs={24} xl={16}>
          <Card
            title="Thao tác gần đây"
            className="dashboard-card"
            extra={
              <Button type="link" onClick={() => navigate('/logs')}>
                Xem tất cả
              </Button>
            }
          >
            <Table<LogEntry>
              rowKey="id"
              size="small"
              columns={recentColumns}
              dataSource={recentLogs}
              loading={loading}
              pagination={false}
              locale={{ emptyText: 'Chưa có thao tác nào được ghi nhận.' }}
            />
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card title="Thông tin hệ thống" className="dashboard-card">
            <Space direction="vertical" size={14} className="full-width">
              <div className="info-row">
                <Typography.Text type="secondary">Máy chủ API</Typography.Text>
                <Typography.Text code copyable={{ text: API_URL }}>
                  {API_URL}
                </Typography.Text>
              </div>
              <div className="info-row">
                <Typography.Text type="secondary">Trạng thái kết nối</Typography.Text>
                {error ? (
                  <Tag color="red">Lỗi kết nối</Tag>
                ) : (
                  <Tag color="green" icon={<CheckCircleOutlined />}>
                    Hoạt động
                  </Tag>
                )}
              </div>
              <div className="info-row">
                <Typography.Text type="secondary">Tài khoản</Typography.Text>
                <Typography.Text>{user?.email}</Typography.Text>
              </div>
              <div className="info-row">
                <Typography.Text type="secondary">Vai trò</Typography.Text>
                <Tag color="gold">Quản trị viên</Tag>
              </div>
            </Space>

            <div className="quick-actions">
              <Typography.Text strong>Lối tắt</Typography.Text>
              <Space wrap>
                <Button onClick={() => navigate('/users')}>Người dùng</Button>
                <Button onClick={() => navigate('/categories')}>Danh mục</Button>
                <Button onClick={() => navigate('/units')}>Đơn vị</Button>
                <Button onClick={() => navigate('/logs')}>Nhật ký</Button>
              </Space>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
