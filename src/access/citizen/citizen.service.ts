import { Injectable } from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { ApiError, ERROR_CODES } from '../../common/errors';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CITIZEN_SESSION_SECONDS,
  OTP_LOCK_MINUTES,
  OTP_MAX_WRONG,
  OTP_TTL_SECONDS,
} from '../access.config';
import { normalizeKenyanPhone } from '../phone';
import { ROLES } from '../roles';
import { SmsService } from '../sms.service';
import { TokenService } from '../token.service';

@Injectable()
export class CitizenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly tokens: TokenService,
  ) {}

  private hash(phone: string, code: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not set in the environment');
    return createHmac('sha256', secret)
      .update(`${phone}:${code}`)
      .digest('hex');
  }

  private cleanPhone(raw: string): string {
    const phone = normalizeKenyanPhone(raw);
    if (!phone) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        'Enter a Kenyan number, like 0712 345 678.',
        400,
      );
    }
    return phone;
  }

  private lockedError(): ApiError {
    return new ApiError(
      ERROR_CODES.OTP_LOCKED,
      `Too many wrong codes. Try again in ${OTP_LOCK_MINUTES} minutes.`,
      423,
    );
  }

  async requestOtp(rawPhone: string) {
    const phone = this.cleanPhone(rawPhone);
    const existing = await this.prisma.phoneOtp.findUnique({ where: { phone } });
    if (existing?.lockedUntil && existing.lockedUntil > new Date()) {
      throw this.lockedError();
    }

    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
    const codeHash = this.hash(phone, code);

    await this.prisma.phoneOtp.upsert({
      where: { phone },
      create: { phone, codeHash, expiresAt },
      update: { codeHash, expiresAt, failedAttempts: 0, lockedUntil: null },
    });

    await this.sms.send(
      phone,
      `NASAFISHA: your code is ${code}. It expires in ${OTP_TTL_SECONDS / 60} minutes.`,
    );
    return { phone, expiresInSeconds: OTP_TTL_SECONDS };
  }

  async verifyOtp(rawPhone: string, code: string) {
    const phone = this.cleanPhone(rawPhone);
    const record = await this.prisma.phoneOtp.findUnique({ where: { phone } });

    if (!record) {
      throw new ApiError(
        ERROR_CODES.OTP_EXPIRED,
        'Ask for a new code first.',
        400,
      );
    }
    if (record.lockedUntil && record.lockedUntil > new Date()) {
      throw this.lockedError();
    }
    if (record.expiresAt < new Date()) {
      throw new ApiError(
        ERROR_CODES.OTP_EXPIRED,
        'That code has expired. Ask for a new one.',
        400,
      );
    }

    const submittedHash = Buffer.from(this.hash(phone, code), 'hex');
    const storedHash = Buffer.from(record.codeHash, 'hex');
    if (
      submittedHash.length !== storedHash.length ||
      !timingSafeEqual(submittedHash, storedHash)
    ) {
      const failed = record.failedAttempts + 1;
      const lock = failed >= OTP_MAX_WRONG;
      await this.prisma.phoneOtp.update({
        where: { phone },
        data: {
          failedAttempts: failed,
          lockedUntil: lock
            ? new Date(Date.now() + OTP_LOCK_MINUTES * 60 * 1000)
            : null,
        },
      });
      if (lock) throw this.lockedError();
      throw new ApiError(
        ERROR_CODES.OTP_INVALID,
        `That code isn't right. ${OTP_MAX_WRONG - failed} tries left.`,
        400,
      );
    }

    await this.prisma.phoneOtp.delete({ where: { phone } });
    const account = await this.prisma.account.upsert({
      where: { phone },
      create: { phone, role: ROLES.CITIZEN, name: 'Resident' },
      update: {},
    });

    if (account.role !== ROLES.CITIZEN) {
      throw new ApiError(
        ERROR_CODES.INVALID_CREDENTIALS,
        'This account cannot sign in with a citizen code.',
        401,
      );
    }
    if (!account.isActive) {
      throw new ApiError(
        ERROR_CODES.ACCOUNT_INACTIVE,
        'This account is deactivated.',
        403,
      );
    }

    const user = { id: account.id, role: ROLES.CITIZEN, name: account.name };
    const token = await this.tokens.sign(user, CITIZEN_SESSION_SECONDS);
    return { token, user };
  }
}
