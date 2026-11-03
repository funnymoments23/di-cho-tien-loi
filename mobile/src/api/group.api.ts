import { request } from './client';
import type { User } from '../types/api';
import type { GroupDetail, GroupInfo, GroupSummary } from '../types/models';

export type LeaveGroupResult = {
  left: boolean;
  groupDeleted: boolean;
  newAdminId: string | null;
};

export const groupApi = {
  detail: () => request<GroupDetail>({ url: '/user/group' }),

  info: () => request<GroupInfo>({ url: '/user/group/info' }),

  create: (groupName: string) =>
    request<GroupSummary>({
      method: 'POST',
      url: '/user/group',
      data: { groupName },
    }),

  addMember: (username: string) =>
    request<User>({
      method: 'POST',
      url: '/user/group/add',
      data: { username },
    }),

  removeMember: (username: string) =>
    request<User>({
      method: 'DELETE',
      url: `/user/group/${encodeURIComponent(username)}`,
    }),

  leave: () =>
    request<LeaveGroupResult>({
      method: 'POST',
      url: '/user/group/leave',
    }),
};
