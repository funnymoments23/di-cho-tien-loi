import { Typography } from 'antd';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  extra?: ReactNode;
}

/** Tiêu đề + mô tả ngắn + vùng nút hành động của mỗi trang. */
export default function PageHeader({ title, description, extra }: PageHeaderProps) {
  return (
    <div className="page-head">
      <div className="page-head-text">
        <Typography.Title level={3} className="page-title">
          {title}
        </Typography.Title>
        {description && (
          <Typography.Text type="secondary" className="page-description">
            {description}
          </Typography.Text>
        )}
      </div>
      {extra && <div className="page-head-extra">{extra}</div>}
    </div>
  );
}
