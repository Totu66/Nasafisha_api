import { Injectable } from '@nestjs/common';
import { ApiError, ERROR_CODES } from '../../common/errors';
import { PrismaService } from '../../prisma/prisma.service';
import { CITIZEN_SESSION_SECONDS } from '../access.config';
import { EmailService } from '../email.service';
import { ROLES } from '../roles';
import { TokenService } from '../token.service';

@Injectable()
export class CitizenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly tokens: TokenService,
  ) {}

  private cleanEmail(raw: string): string {
    const email = raw.trim().toLowerCase();
    if (!email) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        'Enter a valid email address.',
        400,
      );
    }
    return email;
  }

  async requestOtp(rawEmail: string) {
    const email = this.cleanEmail(rawEmail);
    await this.email.sendCode(email);
    return { email };
  }

  async verifyOtp(rawEmail: string, code: string) {
    const email = await this.email.verifyCode(
      this.cleanEmail(rawEmail),
      code,
    );
    const account = await this.prisma.account.upsert({
      where: { email },
      create: { email, role: ROLES.CITIZEN, name: 'Resident' },
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
