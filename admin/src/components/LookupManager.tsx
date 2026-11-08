import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Lookup } from '../types';
import { getErrorMessage } from '../utils/errors';
import PageHeader from './PageHeader';

export interface LookupApi {
  list: () => Promise<Lookup[]>;
  create: (name: string) => Promise<unknown>;
  rename: (name: string, newName: string) => Promise<unknown>;
  remove: (name: string) => Promise<unknown>;
}

interface LookupManagerProps {
  title: string;
  description: string;
  /** "danh mục" / "đơn vị đo" — dùng để ghép thông điệp. */
  itemLabel: string;
  maxLength?: number;
  api: LookupApi;
}

interface CreateFormValues {
  name: string;
}

interface RenameFormValues {
  newName: string;
}

/**
 * Màn hình quản lý danh mục / đơn vị đo.
 * Hai loại dữ liệu dùng chung một cấu trúc (id, name) nên dùng chung component.
 */
export default function LookupManager({
  title,
  description,
  itemLabel,
  maxLength = 50,
  api,
}: LookupManagerProps) {
  const { message } = App.useApp();
  const [items, setItems] = useState<Lookup[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm] = Form.useForm<CreateFormValues>();

  const [renameTarget, setRenameTarget] = useState<Lookup | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameForm] = Form.useForm<RenameFormValues>();

  const [deletingName, setDeletingName] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.list());
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [api, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredItems = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => item.name.toLowerCase().includes(term));
  }, [items, keyword]);

  const handleCreate = async () => {
    const values = (await createForm.validateFields().catch(() => null)) as
      | CreateFormValues
      | null;
    if (!values) return;

    setCreating(true);
    try {
      await api.create(values.name.trim());
      message.success(`Đã thêm ${itemLabel} "${values.name.trim()}".`);
      setCreateOpen(false);
      createForm.resetFields();
      await load();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const openRename = (item: Lookup) => {
    setRenameTarget(item);
    renameForm.setFieldsValue({ newName: item.name });
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const values = (await renameForm.validateFields().catch(() => null)) as
      | RenameFormValues
      | null;
    if (!values) return;

    setRenaming(true);
    try {
      await api.rename(renameTarget.name, values.newName.trim());
      message.success(`Đã đổi tên ${itemLabel} thành "${values.newName.trim()}".`);
      setRenameTarget(null);
      await load();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async (item: Lookup) => {
    setDeletingName(item.name);
    try {
      await api.remove(item.name);
      message.success(`Đã xoá ${itemLabel} "${item.name}".`);
      await load();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setDeletingName(null);
    }
  };

  const columns: ColumnsType<Lookup> = [
    {
      title: 'STT',
      key: 'index',
      width: 72,
      align: 'center',
      render: (_value, _record, index) => index + 1,
    },
    {
      title: 'Tên',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Typography.Text strong>{name}</Typography.Text>,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 180,
      align: 'right',
      render: (_value, record) => (
        <Space size={4}>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openRename(record)}
          >
            Sửa tên
          </Button>
          <Popconfirm
            title={`Xoá ${itemLabel} "${record.name}"?`}
            description={`Không thể hoàn tác. ${itemLabel === 'danh mục' ? 'Danh mục' : 'Đơn vị'} đang được thực phẩm sử dụng sẽ không xoá được.`}
            okText="Xoá"
            cancelText="Huỷ"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              loading={deletingName === record.name}
            >
              Xoá
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title={title}
        description={description}
        extra={
          <Space>
            <Tooltip title="Tải lại danh sách">
              <Button icon={<ReloadOutlined />} aria-label="Tải lại danh sách" onClick={() => void load()} loading={loading} />
            </Tooltip>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateOpen(true)}
            >
              Thêm {itemLabel}
            </Button>
          </Space>
        }
      />

      <Card className="table-card">
        <div className="table-toolbar">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder={`Tìm ${itemLabel}...`}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className="table-search"
          />
          <Typography.Text type="secondary">
            {filteredItems.length}/{items.length} {itemLabel}
          </Typography.Text>
        </div>

        <Table<Lookup>
          rowKey="id"
          columns={columns}
          dataSource={filteredItems}
          loading={loading}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (total) => `${total} ${itemLabel}`,
          }}
          locale={{ emptyText: `Chưa có ${itemLabel} nào.` }}
        />
      </Card>

      <Modal
        title={`Thêm ${itemLabel}`}
        open={createOpen}
        okText="Thêm"
        cancelText="Huỷ"
        confirmLoading={creating}
        onOk={handleCreate}
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        forceRender
      >
        <Form<CreateFormValues>
          form={createForm}
          layout="vertical"
          preserve={false}
        >
          <Form.Item
            name="name"
            label={`Tên ${itemLabel}`}
            rules={[
              { required: true, whitespace: true, message: `Vui lòng nhập tên ${itemLabel}.` },
              { max: maxLength, message: `Tên tối đa ${maxLength} ký tự.` },
            ]}
          >
            <Input placeholder={`Nhập tên ${itemLabel}`} maxLength={maxLength} autoFocus />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Đổi tên ${itemLabel}`}
        open={Boolean(renameTarget)}
        okText="Lưu"
        cancelText="Huỷ"
        confirmLoading={renaming}
        onOk={handleRename}
        onCancel={() => setRenameTarget(null)}
        forceRender
      >
        <Form<RenameFormValues>
          form={renameForm}
          layout="vertical"
          preserve={false}
        >
          <Form.Item label={`Tên ${itemLabel} hiện tại`}>
            <Input value={renameTarget?.name ?? ''} disabled />
          </Form.Item>
          <Form.Item
            name="newName"
            label={`Tên ${itemLabel} mới`}
            rules={[
              { required: true, whitespace: true, message: `Vui lòng nhập tên mới.` },
              { max: maxLength, message: `Tên tối đa ${maxLength} ký tự.` },
            ]}
          >
            <Input placeholder={`Nhập tên ${itemLabel} mới`} maxLength={maxLength} autoFocus />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
