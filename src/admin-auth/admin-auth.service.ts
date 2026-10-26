import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditService } from '../access/audit.service';
import { TokenService } from '../access/token.service';
import { ApiError, ERROR_CODES } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';

const ADMIN_ROLES = ['executive', 'operations_manager', 'county_ict_admin'];
const MAX_WRONG_PASSWORDS = 5;
const SESSION_SECONDS = 8 * 60 * 60;

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async login(emailRaw: string, password: string, deviceId?: string) {
    const email = emailRaw.trim().toLowerCase();
    const device = `device=${deviceId ?? 'unknown'}`;
    const account = await this.prisma.account.findUnique({ where: { email } });

    if (!account || !account.passwordHash || !ADMIN_ROLES.includes(account.role)) {
      await this.audit.log('ADMIN_LOGIN_FAILED', null, null, `${email}\n${device}`);
      throw new ApiError(ERROR_CODES.INVALID_CREDENTIALS, 'Email or password is wrong.', 401);
    }

    if (!account.isActive) {
      await this.audit.log('ADMIN_LOGIN_FAILED', account.id, account.id, `inactive ${device}`);
      throw new ApiError(ERROR_CODES.ACCOUNT_INACTIVE, 'This account is deactivated.', 403);
    }

    if (account.lockedAt) {
      await this.audit.log('ADMIN_LOGIN_BLOCKED', account.id, account.id, `locked ${device}`);
      throw new ApiError(
        ERROR_CODES.ACCOUNT_LOCKED,
        'Account locked. Contact the County ICT Administrator.',
        423,
      );
    }

    if (!(await argon2.verify(account.passwordHash, password))) {
      const count = account.failedPinCount + 1;
      const lock = count >= MAX_WRONG_PASSWORDS;

      await this.prisma.account.update({
        where: { id: account.id },
        data: { failedPinCount: count, lockedAt: lock ? new Date() : null },
      });

      await this.audit.log(
        lock ? 'ADMIN_ACCOUNT_LOCKED' : 'ADMIN_LOGIN_FAILED',
        account.id,
        account.id,
        device,
      );

      if (lock) {
        throw new ApiError(
          ERROR_CODES.ACCOUNT_LOCKED,
          'Account locked. Contact the County ICT Administrator.',
          423,
        );
      }

      throw new ApiError(
        ERROR_CODES.INVALID_CREDENTIALS,
        'Email or password is wrong.',
        401,
      );
    }

    if (account.failedPinCount > 0) {
      await this.prisma.account.update({
        where: { id: account.id },
        data: { failedPinCount: 0 },
      });
    }

    await this.audit.log('ADMIN_LOGIN_OK', account.id, account.id, device);

    const user = {
      id: account.id,
      role: account.role as 'executive' | 'operations_manager' | 'county_ict_admin',
      name: account.name,
      zone: account.zone ?? undefined,
    };

    const token = await this.tokens.sign(user, SESSION_SECONDS);
    return { token, user };
  }

  async unlock(actorId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 'Account not found.', 404);
    }

    await this.prisma.account.update({
      where: { id: accountId },
      data: { lockedAt: null, failedPinCount: 0 },
    });

    await this.audit.log('ACCOUNT_UNLOCKED', actorId, accountId);
  }
}
