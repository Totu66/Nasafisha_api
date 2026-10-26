import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiError, ERROR_CODES } from '../common/errors';
import { ROLES, type Role } from './roles';

export interface SessionUser {
  id: string;
  role: Role;
  name: string;
  zone?: string;
}

interface TokenPayload {
  sub: string;
  role: Role;
  name: string;
  zone?: string;
}

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  private secret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not set in the environment');
    return secret;
  }

  sign(user: SessionUser, expiresInSeconds: number): Promise<string> {
    return this.jwt.signAsync(
      {
        sub: user.id,
        role: user.role,
        name: user.name,
        zone: user.zone,
      },
      { secret: this.secret(), expiresIn: expiresInSeconds },
    );
  }

  async verify(token: string): Promise<SessionUser> {
    const secret = this.secret();
    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(token, {
        secret,
      });
    } catch {
      throw new ApiError(
        ERROR_CODES.UNAUTHORIZED,
        'Your session has ended. Sign in again.',
        401,
      );
    }

    if (
      !payload ||
      typeof payload.sub !== 'string' ||
      typeof payload.name !== 'string' ||
      !Object.values(ROLES).includes(payload.role)
    ) {
      throw new ApiError(
        ERROR_CODES.UNAUTHORIZED,
        'Your session has ended. Sign in again.',
        401,
      );
    }

    return {
      id: payload.sub,
      role: payload.role,
      name: payload.name,
      zone: payload.zone,
    };
  }
}
