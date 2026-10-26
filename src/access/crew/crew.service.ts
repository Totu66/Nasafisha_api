import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ApiError, ERROR_CODES } from '../../common/errors';
import { PrismaService } from '../../prisma/prisma.service';
import { CREW_SESSION_SECONDS, PIN_MAX_WRONG } from '../access.config';
import { AuditService } from '../audit.service';
import { ROLES } from '../roles';
import { TokenService } from '../token.service';

const FIELD_ROLES: string[] = [ROLES.FIELD_CREW, ROLES.FIELD_SUPERVISOR];

@Injectable()
export class CrewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async login(employeeIdRaw: string, pin: string, deviceId?: string) {
    const employeeId = employeeIdRaw.trim().toUpperCase();
    const device = `device=${deviceId ?? 'unknown'}`;
    const account = await this.prisma.account.findUnique({
      where: { employeeId },
    });

    if (
      !account ||
      !account.pinHash ||
      !FIELD_ROLES.includes(account.role)
    ) {
      await this.audit.log('LOGIN_FAILED', null, null, `${employeeId} ${device}`);
      throw new ApiError(
        ERROR_CODES.INVALID_CREDENTIALS,
        'Employee ID or PIN is wrong.',
        401,
      );
    }
    if (!account.isActive) {
      await this.audit.log('LOGIN_FAILED', account.id, account.id, `inactive ${device}`);
      throw new ApiError(
        ERROR_CODES.ACCOUNT_INACTIVE,
        'This account is deactivated.',
        403,
      );
    }
    if (account.lockedAt) {
      await this.audit.log('LOGIN_BLOCKED', account.id, account.id, `locked ${device}`);
      throw new ApiError(
        ERROR_CODES.ACCOUNT_LOCKED,
        'Account locked. Ask your supervisor to reset your PIN.',
        423,
      );
    }

    const pinOk = await argon2.verify(account.pinHash, pin);
    if (!pinOk) {
      const count = account.failedPinCount + 1;
      if (count >= PIN_MAX_WRONG) {
        await this.prisma.account.update({
          where: { id: account.id },
          data: { failedPinCount: count, lockedAt: new Date() },
        });
        await this.prisma.supervisorNotice.create({
          data: {
            accountId: account.id,
            zone: account.zone,
            message: `${account.name} (${account.employeeId}) is locked out after ${PIN_MAX_WRONG} wrong PINs.`,
          },
        });
        await this.audit.log('ACCOUNT_LOCKED', account.id, account.id, device);
        throw new ApiError(
          ERROR_CODES.ACCOUNT_LOCKED,
          'Account locked. Ask your supervisor to reset your PIN.',
          423,
        );
      }

      await this.prisma.account.update({
        where: { id: account.id },
        data: { failedPinCount: count },
      });
      await this.audit.log(
        'LOGIN_FAILED',
        account.id,
        account.id,
        `wrong pin ${device}`,
      );
      throw new ApiError(
        ERROR_CODES.INVALID_CREDENTIALS,
        `Employee ID or PIN is wrong. ${PIN_MAX_WRONG - count} tries left.`,
        401,
      );
    }

    if (account.failedPinCount > 0) {
      await this.prisma.account.update({
        where: { id: account.id },
        data: { failedPinCount: 0 },
      });
    }
    await this.audit.log('LOGIN_OK', account.id, account.id, device);

    const user = {
      id: account.id,
      role: account.role as typeof ROLES.FIELD_CREW | typeof ROLES.FIELD_SUPERVISOR,
      name: account.name,
      zone: account.zone ?? undefined,
    };
    const token = await this.tokens.sign(user, CREW_SESSION_SECONDS);
    return { token, user };
  }

  async listCrewAccounts() {
    const rows = await this.prisma.account.findMany({
      where: { role: ROLES.FIELD_CREW },
      orderBy: { name: 'asc' },
    });
    return rows.map((account) => ({
      id: account.id,
      name: account.name,
      employeeId: account.employeeId,
      crewLabel: account.crewLabel ?? '',
      isLocked: account.lockedAt !== null,
      lockedAt: account.lockedAt?.toISOString(),
    }));
  }

  async resetPin(supervisorId: string, accountId: string, pin: string) {
    const target = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!target || target.role !== ROLES.FIELD_CREW) {
      throw new ApiError(
        ERROR_CODES.NOT_FOUND,
        'Crew account not found.',
        404,
      );
    }

    await this.prisma.account.update({
      where: { id: accountId },
      data: {
        pinHash: await argon2.hash(pin),
        failedPinCount: 0,
        lockedAt: null,
      },
    });
    await this.audit.log('PIN_RESET', supervisorId, accountId);
  }
}
