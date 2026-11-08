import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  DatePicker,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { listLogs, type ListLogsParams } from '../api/log.api';
import PageHeader from '../components/PageHeader';
import type { LogAction, LogEntry, Paginated } from '../types';
import { getErrorMessage } from '../utils/errors';
import { formatDateTime } from '../utils/format';

const DEFAULT_QUERY: ListLogsParams = { page: 1, limit: 20 };

const ACTION_META: Record<LogAction, { color: string; label: string }> = {
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

const ENTITY_OPTIONS = Object.entries(ENTITY_LABEL).map(([value, label]) => ({
  value,
  label,
}));

export default function LogsPage() {
  const { message } = App.useApp();
  const [query, setQuery] = useState<ListLogsParams>(DEFAULT_QUERY);
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [userIdInput, setUserIdInput] = useState('');
  const [data, setData] = useState<Paginated<LogEntry>>({
    items: [],
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listLogs(query));
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [message, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      setRange([dates[0], dates[1]]);
      setQuery((previous) => ({
        ...previous,
        from: dates[0]?.format('YYYY-MM-DD'),
        to: dates[1]?.format('YYYY-MM-DD'),
        page: 1,
      }));
      return;
    }

    setRange(null);
    setQuery((previous) => ({
      ...previous,
      from: undefined,
      to: undefined,
      page: 1,
    }));
  };

  const resetFilters = () => {
    setRange(null);
    setUserIdInput('');
    setQuery(DEFAULT_QUERY);
  };

  const columns: ColumnsType<LogEntry> = [
    {
      title: 'Thời gian',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: 'Hành động',
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: (value: LogAction) => (
        <Tag color={ACTION_META[value]?.color ?? 'default'}>
          {ACTION_META[value]?.label ?? value}
        </Tag>
      ),
    },
    {
      title: 'Đối tượng',
      key: 'entity',
      width: 180,
      render: (_value, record) => (
        <div>
          <div>{ENTITY_LABEL[record.entity] ?? record.entity}</div>
          {record.entityId && (
            <Typography.Text type="secondary" className="small-text" ellipsis>
              {record.entityId}
            </Typography.Text>
          )}
        </div>
      ),
    },
    {
      title: 'Người thực hiện',
      key: 'user',
      width: 220,
      render: (_value, record) =>
        record.user ? (
          <div>
            <div>{record.user.name ?? record.user.username ?? '—'}</div>
            <Typography.Text type="secondary" className="small-text">
              {record.user.email}
            </Typography.Text>
          </div>
        ) : (
          <Typography.Text type="secondary">Hệ thống</Typography.Text>
        ),
    },
    {
      title: 'Nhóm',
      key: 'group',
      width: 160,
      render: (_value, record) => record.group?.name ?? '—',
    },
    {
      title: 'Chi tiết',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
      render: (detail: string | null) =>
        detail ? (
          <Tooltip title={detail}>
            <Typography.Text code>{detail}</Typography.Text>
          </Tooltip>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Nhật ký hệ thống"
        description="Theo dõi các thao tác tạo, cập nhật, xoá dữ liệu. Nhật ký được ghi tự động và không thể sửa."
        extra={
          <Tooltip title="Tải lại nhật ký">
            <Button icon={<ReloadOutlined />} aria-label="Tải lại nhật ký" onClick={() => void load()} loading={loading} />
          </Tooltip>
        }
      />

      <Card className="table-card">
        <div className="table-toolbar table-toolbar-wrap">
          <Select
            allowClear
            placeholder="Hành động"
            options={[
              { value: 'CREATE', label: 'Tạo' },
              { value: 'UPDATE', label: 'Cập nhật' },
              { value: 'DELETE', label: 'Xoá' },
            ]}
            value={query.action}
            onChange={(value: LogAction | undefined) =>
              setQuery((previous) => ({ ...previous, action: value, page: 1 }))
            }
            className="filter-select"
          />

          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Đối tượng"
            options={ENTITY_OPTIONS}
            value={query.entity}
            onChange={(value: string | undefined) =>
              setQuery((previous) => ({ ...previous, entity: value, page: 1 }))
            }
            className="filter-select"
          />

          <DatePicker.RangePicker
            value={range}
            format="DD/MM/YYYY"
            placeholder={['Từ ngày', 'Đến ngày']}
            onChange={handleRangeChange}
            allowClear
          />

          <Input.Search
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Mã người dùng (userId)"
            value={userIdInput}
            onChange={(event) => setUserIdInput(event.target.value)}
            onSearch={(value) =>
              setQuery((previous) => ({
                ...previous,
                userId: value.trim() || undefined,
                page: 1,
              }))
            }
            className="filter-input"
          />

          <Button onClick={resetFilters}>Xoá bộ lọc</Button>
        </div>

        <Table<LogEntry>
          rowKey="id"
          columns={columns}
          dataSource={data.items}
          loading={loading}
          scroll={{ x: 1000 }}
          pagination={{
            current: data.page,
            pageSize: data.limit,
            total: data.total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (total) => `${total} bản ghi`,
            onChange: (page, pageSize) =>
              setQuery((previous) => ({ ...previous, page, limit: pageSize })),
          }}
          locale={{ emptyText: 'Không có bản ghi nhật ký phù hợp.' }}
        />
      </Card>

      <Space className="page-footnote">
        <Typography.Text type="secondary">
          Gợi ý: lọc theo đối tượng và khoảng ngày để thu hẹp kết quả. Nhật ký chỉ
          ghi các request thành công.
        </Typography.Text>
      </Space>
    </div>
  );
}
