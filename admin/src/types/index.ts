/** Kiểu dữ liệu dùng chung của web quản trị. */

/** Khuôn response thống nhất của backend: { code, message, data }. */
export interface ApiResponse<T> {
  code: string;
  message: string;
  data: T;
}

/** Tài khoản trả về từ /user (không có trường nội bộ). */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  username: string | null;
  avatar: string | null;
  gender: string | null;
  birthday: string | null;
  language: string;
  timezone: string;
  role: UserRole;
  groupId: string | null;
  isVerified: boolean;
}

export type UserRole = 'user' | 'admin';

/** Tài khoản trong màn hình quản trị người dùng (GET /admin/user). */
export interface AdminUser extends PublicUser {
  groupName: string | null;
  isActive: boolean;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Danh mục / đơn vị đo: mỗi bản ghi chỉ có id và tên. */
export interface Lookup {
  id: string;
  name: string;
}

export type LogAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface LogEntry {
  id: string;
  action: LogAction;
  entity: string;
  entityId: string | null;
  detail: string | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    username: string | null;
  } | null;
  group: { id: string; name: string | null } | null;
  createdAt: string;
}

export interface LoginResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}
