import { HttpException } from '@nestjs/common';

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  ROLE_FORBIDDEN: 'ROLE_FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  EMAIL_FAILED: 'EMAIL_FAILED',
  SMS_FAILED: 'SMS_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  HTTPS_REQUIRED: 'HTTPS_REQUIRED',
  REQUEST_ERROR: 'REQUEST_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export class ApiError extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: number,
  ) {
    super({ code, message }, status);
  }
}
