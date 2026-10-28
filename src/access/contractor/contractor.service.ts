import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditService } from '../audit.service';
import { TokenService } from '../token.service';
import { ApiError, ERROR_CODES } from '../../common/errors';
import { PrismaService } from '../../prisma/prisma.service';

const SESSION_SECONDS = 8 * 60 * 60; // 8 hours

@Injectable()
export class ContractorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async login(emailRaw: string, password: string, deviceId?: string) {
    const email = emailRaw.trim().toLowerCase();
    const device = `device=${deviceId ?? 'unknown'}`;
    const account = await this.prisma.account.findUnique({ where: { email } });

    if (!account || !account.passwordHash || account.role !== 'contractor') {
      await this.audit.log(
        'CONTRACTOR_LOGIN_FAILED',
        null,
        null,
        `${email}\n${device}`,
      );
      throw new ApiError(
        ERROR_CODES.INVALID_CREDENTIALS,
        'Email or password is wrong.',
        401,
      );
    }

    if (!account.isActive) {
      await this.audit.log(
        'CONTRACTOR_LOGIN_FAILED',
        account.id,
        account.id,
        `inactive ${device}`,
      );
      throw new ApiError(
        ERROR_CODES.ACCOUNT_INACTIVE,
        'This contractor account is deactivated.',
        403,
      );
    }

    if (account.lockedAt) {
      await this.audit.log(
        'CONTRACTOR_LOGIN_BLOCKED',
        account.id,
        account.id,
        `locked ${device}`,
      );
      throw new ApiError(
        ERROR_CODES.ACCOUNT_LOCKED,
        'Account locked. Contact the administrator.',
        423,
      );
    }

    if (!(await argon2.verify(account.passwordHash, password))) {
      await this.audit.log(
        'CONTRACTOR_LOGIN_FAILED',
        account.id,
        account.id,
        device,
      );
      throw new ApiError(
        ERROR_CODES.INVALID_CREDENTIALS,
        'Email or password is wrong.',
        401,
      );
    }

    await this.audit.log('CONTRACTOR_LOGIN_OK', account.id, account.id, device);

    const user = {
      id: account.id,
      role: 'contractor' as const,
      name: account.name,
      zone: account.zone ?? undefined,
    };

    const token = await this.tokens.sign(user, SESSION_SECONDS);
    return {
      token,
      user: {
        id: account.id,
        role: 'contractor',
        name: account.name,
        email: account.email,
        zone: account.zone,
        assignedZone: account.zone,
        companyName: account.crewLabel,
      },
    };
  }
}
