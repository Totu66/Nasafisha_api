import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AccessGuard } from './access.guard';
import { ROLES_KEY, type Role } from './roles';
import type { SessionUser } from './token.service';

export const RequireRole = (...roles: Role[]) =>
  applyDecorators(SetMetadata(ROLES_KEY, roles), UseGuards(AccessGuard));

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser => {
    const request = ctx.switchToHttp().getRequest<
      Request & { user: SessionUser }
    >();
    return request.user;
  },
);
