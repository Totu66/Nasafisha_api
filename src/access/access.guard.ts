import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ApiError, ERROR_CODES } from '../common/errors';
import { AuditService } from './audit.service';
import { ROLES_KEY, type Role } from './roles';
import { type SessionUser, TokenService } from './token.service';

type AuthenticatedRequest = Request & { user?: SessionUser };

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req =
      context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      throw new ApiError(ERROR_CODES.UNAUTHORIZED, 'Sign in first.', 401);
    }

    const user = await this.tokens.verify(token);
    req.user = user;

    const allowed = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (allowed?.length && !allowed.includes(user.role)) {
      await this.audit.log(
        'ROLE_REJECTED',
        user.id,
        null,
        `${req.method} ${req.path} as ${user.role}`,
      );
      throw new ApiError(
        ERROR_CODES.ROLE_FORBIDDEN,
        'You do not have permission to do this.',
        403,
      );
    }

    return true;
  }
}
