import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="full-screen-center">
      <Result
        status="404"
        title="404"
        subTitle="Trang bạn tìm không tồn tại."
        extra={
          <Button type="primary" onClick={() => navigate('/')}>
            Về trang tổng quan
          </Button>
        }
      />
    </div>
  );
}
