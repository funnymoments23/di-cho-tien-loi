import { request } from './client';
import type { AuthData, User } from '../types/api';

export type RegisterPayload = {
  email: string;
  password: string;
  name: string;
  language?: 'vi' | 'en';
  timezone?: string;
  deviceId?: string;
};

export type RegisterData = {
  user: User;
  verificationToken: string;
  codeExpiresIn: number;
};

export type VerifyEmailData = {
  user: User;
  alreadyVerified?: boolean;
};

export type SendVerificationCodeData = {
  alreadyVerified: boolean;
  user?: User;
  verificationToken?: string;
  codeExpiresIn?: number;
};

export type ForgotPasswordData = {
  resetToken: string;
  codeExpiresIn: number;
};

export const authApi = {
  me: () => request<User>({ url: '/user' }),

  updateAvatar: (form: FormData) =>
    request<User>({
      method: 'PUT',
      url: '/user',
      data: form,
    }),

  login: (email: string, password: string) =>
    request<AuthData>({
      method: 'POST',
      url: '/user/login',
      data: { email, password },
    }),

  register: (payload: RegisterPayload) =>
    request<RegisterData>({
      method: 'POST',
      url: '/user',
      data: payload,
    }),

  verifyEmail: (code: string, token: string) =>
    request<VerifyEmailData>({
      method: 'POST',
      url: '/user/verify-email',
      data: { code, token },
    }),

  sendVerificationCode: (email: string) =>
    request<SendVerificationCodeData>({
      method: 'POST',
      url: '/user/send-verification-code',
      data: { email },
    }),

  forgotPassword: (email: string) =>
    request<ForgotPasswordData>({
      method: 'POST',
      url: '/user/forgot-password',
      data: { email },
    }),

  resetPassword: (code: string, token: string, newPassword: string) =>
    request<null>({
      method: 'POST',
      url: '/user/reset-password',
      data: { code, token, newPassword },
    }),

  changePassword: (oldPassword: string, newPassword: string) =>
    request<null>({
      method: 'POST',
      url: '/user/change-password',
      data: { oldPassword, newPassword },
    }),

  updateDeviceToken: (deviceToken: string) =>
    request<null>({
      method: 'PUT',
      url: '/user/device-token',
      data: { deviceToken },
    }),
};
