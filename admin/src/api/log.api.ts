import { request } from './client';
import type { LogAction, LogEntry, Paginated } from '../types';

export interface ListLogsParams {
  action?: LogAction;
  entity?: string;
  userId?: string;
  groupId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export const listLogs = (params: ListLogsParams): Promise<Paginated<LogEntry>> =>
  request<Paginated<LogEntry>>({ url: '/admin/logs', params });
