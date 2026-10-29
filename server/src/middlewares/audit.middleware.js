const { logAction } = require('../utils/logger');

// Chỉ các request làm thay đổi dữ liệu mới được ghi nhật ký.
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Các endpoint xác thực / không phải thao tác nghiệp vụ trên dữ liệu.
// - Đăng ký, đăng nhập, quên mật khẩu... không có req.user.
// - Logout là thao tác phiên, không đưa vào logs.
const SKIPPED_POST_PATHS = new Set([
  '/user',
  '/user/login',
  '/user/verify-email',
  '/user/send-verification-code',
  '/user/refresh-token',
  '/user/logout',
  '/user/forgot-password',
  '/user/reset-password',
]);
// Cập nhật push token do app gọi mỗi lần khởi động, không ghi để tránh nhiễu log.
const SKIPPED_ANY_PATHS = new Set(['/user/device-token']);

const shouldSkip = (method, path) =>
  SKIPPED_ANY_PATHS.has(path) || (method === 'POST' && SKIPPED_POST_PATHS.has(path));

/** Bỏ query string và prefix /it4788 để lấy path nghiệp vụ. */
const businessPath = (req) => {
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  const withoutPrefix = path.replace(/^\/it4788(?=\/|$)/, '');
  return withoutPrefix || '/';
};

const resolveEntity = (path) => {
  if (path.startsWith('/admin/')) {
    const segment = path.split('/')[2];
    return segment && segment !== 'logs' ? segment : null;
  }
  if (path.startsWith('/user/group')) return 'group';
  if (path === '/user' || path.startsWith('/user/')) return 'user';
  if (path.startsWith('/shopping/task')) return 'task';
  const segment = path.split('/')[1];
  return segment || null;
};

const resolveAction = (method, path) => {
  // Thêm/xoá thành viên hoặc rời nhóm là cập nhật nhóm, không phải tạo/xoá nhóm.
  if (
    path === '/user/group/add' ||
    path === '/user/group/leave' ||
    (path === '/user/group' && method === 'DELETE')
  ) {
    return 'UPDATE';
  }
  // Đổi mật khẩu là cập nhật tài khoản.
  if (path === '/user/change-password') return 'UPDATE';

  if (method === 'POST') return 'CREATE';
  if (method === 'PUT' || method === 'PATCH') return 'UPDATE';
  if (method === 'DELETE') return 'DELETE';
  return null;
};

const firstId = (data) => {
  if (!data) return null;
  if (Array.isArray(data)) return data[0]?.id ?? data[0]?._id ?? null;
  return data.id ?? data._id ?? null;
};

/**
 * Ghi nhật ký cho mọi request ghi/sửa/xoá thành công (HTTP < 400).
 *
 * Đặt trước router để bọc `res.json`; tại thời điểm response, auth middleware
 * đã chạy xong nên đọc được `req.user`. Nhật ký được ghi xong mới trả response
 * để test và admin thấy ngay, nhưng lỗi ghi log không làm hỏng response.
 */
const auditLog = (req, res, next) => {
  const method = String(req.method || '').toUpperCase();
  if (!MUTATING_METHODS.has(method)) return next();

  const path = businessPath(req);
  if (shouldSkip(method, path)) return next();

  const originalJson = res.json.bind(res);

  res.json = (body) => {
    const userId = req.user?.id;
    if (!userId || res.statusCode >= 400) return originalJson(body);

    const action = resolveAction(method, path);
    const entity = resolveEntity(path);
    if (!action || !entity) return originalJson(body);

    const data = body?.data;
    let entityId = firstId(data);

    if (entity === 'group' && action !== 'CREATE') {
      // add/remove/leave trả về user hoặc object không có id nhóm.
      entityId = req.user.groupId || entityId;
    }
    if (entity === 'user' && !entityId) entityId = userId;

    let groupId = req.user.groupId || data?.groupId || null;
    if (path.startsWith('/admin/')) {
      // Thao tác quản trị là phạm vi hệ thống; chỉ gắn nhóm nếu response có.
      groupId = data?.groupId || null;
    }
    if (entity === 'group' && action === 'CREATE') {
      groupId = entityId;
    }

    const detail = `${method} ${path}${body?.code ? ` → ${body.code}` : ''}`;

    logAction({ userId, groupId, action, entity, entityId, detail })
      .catch(() => {})
      .finally(() => originalJson(body));

    return res;
  };

  next();
};

module.exports = auditLog;
module.exports.businessPath = businessPath;
module.exports.resolveEntity = resolveEntity;
module.exports.resolveAction = resolveAction;
