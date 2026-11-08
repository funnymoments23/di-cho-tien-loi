import {
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  ReloadOutlined,
  SearchOutlined,
  UnlockOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  App,
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import {
  deleteUserByAdmin,
  listUsers,
  updateUserByAdmin,
  updateUserStatus,
  type ListUsersParams,
} from '../api/adminUser.api';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../store/AuthContext';
import type { AdminUser, Paginated, UserRole } from '../types';
import { getErrorMessage } from '../utils/errors';
import { formatDateTime } from '../utils/format';

const DEFAULT_QUERY: ListUsersParams = {
  page: 1,
  limit: 10,
  sort: 'createdAt',
  order: 'desc',
};

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Quản trị viên' },
  { value: 'user', label: 'Người dùng' },
];

const GENDER_OPTIONS = [
  { value: 'female', label: 'Nữ' },
  { value: 'male', label: 'Nam' },
  { value: 'other', label: 'Khác' },
];

interface UserFormValues {
  name: string;
  email: string;
  username?: string;
  gender?: 'male' | 'female' | 'other';
  birthday?: Dayjs | null;
  language?: 'vi' | 'en';
  timezone?: string;
  role: UserRole;
  isVerified: boolean;
  avatar?: string;
}

export default function UsersPage() {
  const { message } = App.useApp();
  const { user: currentUser } = useAuth();

  const [query, setQuery] = useState<ListUsersParams>(DEFAULT_QUERY);
  const [keyword, setKeyword] = useState('');
  const [data, setData] = useState<Paginated<AdminUser>>({
    items: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);

  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form] = Form.useForm<UserFormValues>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listUsers(query));
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [message, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = (record: AdminUser) => {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue({
      name: record.name,
      email: record.email,
      username: record.username ?? undefined,
      gender: (record.gender as UserFormValues['gender']) ?? undefined,
      birthday: record.birthday ? dayjs(record.birthday) : null,
      language: record.language === 'en' ? 'en' : 'vi',
      timezone: record.timezone,
      role: record.role,
      isVerified: record.isVerified,
      avatar: record.avatar ?? '',
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    const values = (await form.validateFields().catch(() => null)) as UserFormValues | null;
    if (!values) return;

    setSaving(true);
    try {
      await updateUserByAdmin(editing.id, {
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        username: values.username?.trim() || undefined,
        gender: values.gender ?? null,
        birthday: values.birthday ? values.birthday.toISOString() : null,
        language: values.language,
        timezone: values.timezone?.trim() || undefined,
        role: values.role,
        isVerified: values.isVerified,
        avatar: values.avatar?.trim() ?? '',
      });
      message.success('Đã cập nhật tài khoản.');
      setEditing(null);
      await load();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (record: AdminUser) => {
    setStatusLoadingId(record.id);
    try {
      await updateUserStatus(record.id, !record.isActive);
      message.success(record.isActive ? 'Đã khoá tài khoản.' : 'Đã mở khoá tài khoản.');
      await load();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setStatusLoadingId(null);
    }
  };

  const handleDelete = async (record: AdminUser) => {
    setDeletingId(record.id);
    try {
      await deleteUserByAdmin(record.id);
      message.success(`Đã xoá tài khoản ${record.name}.`);
      await load();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const resetFilters = () => {
    setKeyword('');
    setQuery(DEFAULT_QUERY);
  };

  const columns: ColumnsType<AdminUser> = [
    {
      title: 'Người dùng',
      key: 'name',
      width: 230,
      render: (_value, record) => (
        <Space size={10}>
          <Avatar src={record.avatar || undefined} icon={<UserOutlined />} />
          <div className="user-cell">
            <Typography.Text strong>{record.name}</Typography.Text>
            <Typography.Text type="secondary" className="user-cell-sub">
              {record.username ? `@${record.username}` : 'Chưa có username'}
            </Typography.Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 220,
      ellipsis: true,
    },
    {
      title: 'Nhóm',
      dataIndex: 'groupName',
      key: 'groupName',
      width: 160,
      responsive: ['lg'],
      render: (groupName: string | null) =>
        groupName ? <Tag color="blue">{groupName}</Tag> : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Vai trò',
      dataIndex: 'role',
      key: 'role',
      width: 140,
      render: (role: UserRole) =>
        role === 'admin' ? (
          <Tag color="gold">Quản trị viên</Tag>
        ) : (
          <Tag>Người dùng</Tag>
        ),
    },
    {
      title: 'Xác minh',
      dataIndex: 'isVerified',
      key: 'isVerified',
      width: 140,
      responsive: ['lg'],
      render: (isVerified: boolean) =>
        isVerified ? <Tag color="green">Đã xác minh</Tag> : <Tag color="orange">Chưa xác minh</Tag>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 130,
      render: (isActive: boolean, record) =>
        isActive ? (
          <Tag color="green">Hoạt động</Tag>
        ) : (
          <Tooltip title={record.lockedAt ? `Khoá lúc ${formatDateTime(record.lockedAt)}` : undefined}>
            <Tag color="red">Đã khoá</Tag>
          </Tooltip>
        ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      responsive: ['xl'],
      render: (createdAt: string) => formatDateTime(createdAt),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 170,
      fixed: 'right',
      align: 'right',
      render: (_value, record) => {
        const isSelf = record.id === currentUser?.id;
        return (
          <Space size={2}>
            <Tooltip title="Sửa thông tin">
              <Button
                type="text"
                aria-label="Sửa thông tin"
                icon={<EditOutlined />}
                onClick={() => openEdit(record)}
              />
            </Tooltip>

            {isSelf ? (
              <Tooltip title="Không thể tự khoá tài khoản của mình">
                <Button type="text" disabled icon={<LockOutlined />} aria-label="Không thể tự khoá" />
              </Tooltip>
            ) : (
              <Popconfirm
                title={record.isActive ? 'Khoá tài khoản này?' : 'Mở khoá tài khoản này?'}
                description={
                  record.isActive
                    ? 'Người dùng sẽ bị đăng xuất và không thể đăng nhập cho tới khi được mở khoá.'
                    : 'Người dùng có thể đăng nhập và sử dụng hệ thống trở lại.'
                }
                okText={record.isActive ? 'Khoá' : 'Mở khoá'}
                cancelText="Huỷ"
                okButtonProps={{ danger: record.isActive }}
                onConfirm={() => handleToggleStatus(record)}
              >
                <Tooltip title={record.isActive ? 'Khoá tài khoản' : 'Mở khoá tài khoản'}>
                  <Button
                    type="text"
                    danger={record.isActive}
                    aria-label={record.isActive ? 'Khoá tài khoản' : 'Mở khoá tài khoản'}
                    icon={record.isActive ? <LockOutlined /> : <UnlockOutlined />}
                    loading={statusLoadingId === record.id}
                  />
                </Tooltip>
              </Popconfirm>
            )}

            {isSelf ? (
              <Tooltip title="Không thể tự xoá tài khoản của mình">
                <Button type="text" disabled danger icon={<DeleteOutlined />} aria-label="Không thể tự xoá" />
              </Tooltip>
            ) : (
              <Popconfirm
                title={`Xoá tài khoản ${record.name}?`}
                description="Tài khoản sẽ bị xoá vĩnh viễn và gỡ khỏi nhóm. Không thể hoàn tác."
                okText="Xoá"
                cancelText="Huỷ"
                okButtonProps={{ danger: true }}
                onConfirm={() => handleDelete(record)}
              >
                <Tooltip title="Xoá tài khoản">
                  <Button
                    type="text"
                    danger
                    aria-label="Xoá tài khoản"
                    icon={<DeleteOutlined />}
                    loading={deletingId === record.id}
                  />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Quản lý người dùng"
        description="Xem, sửa hồ sơ, phân quyền, khoá/mở khoá và xoá tài khoản trong hệ thống."
        extra={
          <Tooltip title="Tải lại danh sách">
            <Button
              icon={<ReloadOutlined />}
              aria-label="Tải lại danh sách"
              onClick={() => void load()}
              loading={loading}
            />
          </Tooltip>
        }
      />

      <Card className="table-card">
        <div className="table-toolbar table-toolbar-wrap">
          <Input.Search
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tìm theo tên, email, username..."
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={(value) =>
              setQuery((previous) => ({
                ...previous,
                keyword: value.trim() || undefined,
                page: 1,
              }))
            }
            className="table-search"
          />

          <Select
            allowClear
            placeholder="Vai trò"
            options={ROLE_OPTIONS}
            value={query.role}
            onChange={(value: UserRole | undefined) =>
              setQuery((previous) => ({ ...previous, role: value, page: 1 }))
            }
            className="filter-select"
          />

          <Select
            allowClear
            placeholder="Trạng thái"
            options={[
              { value: 'active', label: 'Hoạt động' },
              { value: 'locked', label: 'Đã khoá' },
            ]}
            value={query.status}
            onChange={(value: ListUsersParams['status']) =>
              setQuery((previous) => ({ ...previous, status: value, page: 1 }))
            }
            className="filter-select"
          />

          <Select
            allowClear
            placeholder="Xác minh"
            options={[
              { value: true, label: 'Đã xác minh' },
              { value: false, label: 'Chưa xác minh' },
            ]}
            value={query.isVerified}
            onChange={(value: boolean | undefined) =>
              setQuery((previous) => ({ ...previous, isVerified: value, page: 1 }))
            }
            className="filter-select"
          />

          <Button onClick={resetFilters}>Xoá bộ lọc</Button>
        </div>

        <Table<AdminUser>
          rowKey="id"
          columns={columns}
          dataSource={data.items}
          loading={loading}
          scroll={{ x: 900 }}
          pagination={{
            current: data.page,
            pageSize: data.limit,
            total: data.total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (total) => `${total} tài khoản`,
            onChange: (page, pageSize) =>
              setQuery((previous) => ({ ...previous, page, limit: pageSize })),
          }}
          locale={{ emptyText: 'Không tìm thấy tài khoản phù hợp.' }}
        />
      </Card>

      <Modal
        title="Sửa tài khoản"
        open={Boolean(editing)}
        width={760}
        okText="Lưu thay đổi"
        cancelText="Huỷ"
        confirmLoading={saving}
        onOk={handleSave}
        onCancel={() => setEditing(null)}
        forceRender
      >
        <Form<UserFormValues>
          form={form}
          layout="vertical"
          preserve={false}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label="Họ và tên"
                rules={[
                  { required: true, message: 'Vui lòng nhập họ tên.' },
                  { min: 3, message: 'Họ tên tối thiểu 3 ký tự.' },
                  { max: 30, message: 'Họ tên tối đa 30 ký tự.' },
                ]}
              >
                <Input placeholder="Nguyễn Văn A" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="username"
                label="Username"
                rules={[
                  { min: 3, message: 'Username tối thiểu 3 ký tự.' },
                  { max: 15, message: 'Username tối đa 15 ký tự.' },
                ]}
              >
                <Input placeholder="nguyenvana" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Vui lòng nhập email.' },
                  { type: 'email', message: 'Email không hợp lệ.' },
                ]}
              >
                <Input placeholder="user@example.com" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="gender" label="Giới tính">
                <Select allowClear placeholder="Chưa chọn" options={GENDER_OPTIONS} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="birthday" label="Ngày sinh">
                <DatePicker
                  className="full-width"
                  format="DD/MM/YYYY"
                  placeholder="Chọn ngày sinh"
                  disabledDate={(current) => current.isAfter(dayjs().endOf('day'))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="language" label="Ngôn ngữ">
                <Select
                  options={[
                    { value: 'vi', label: 'Tiếng Việt' },
                    { value: 'en', label: 'English' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="role"
                label="Vai trò"
                extra={
                  editing?.id === currentUser?.id
                    ? 'Không thể tự thay đổi quyền của chính mình.'
                    : undefined
                }
              >
                <Select
                  options={ROLE_OPTIONS}
                  disabled={editing?.id === currentUser?.id}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="timezone" label="Múi giờ">
                <Input placeholder="Asia/Ho_Chi_Minh" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="isVerified"
                label="Xác minh email"
                valuePropName="checked"
              >
                <Switch checkedChildren="Đã xác minh" unCheckedChildren="Chưa xác minh" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="avatar"
                label="Ảnh đại diện (URL)"
                rules={[{ max: 500, message: 'URL tối đa 500 ký tự.' }]}
              >
                <Input placeholder="https://res.cloudinary.com/..." />
              </Form.Item>
            </Col>
          </Row>

          {editing && (
            <Typography.Text type="secondary" className="modal-meta">
              Tạo lúc {formatDateTime(editing.createdAt)} · Cập nhật{' '}
              {formatDateTime(editing.updatedAt)}
              {editing.groupName ? ` · Nhóm: ${editing.groupName}` : ''}
            </Typography.Text>
          )}
        </Form>
      </Modal>
    </div>
  );
}
