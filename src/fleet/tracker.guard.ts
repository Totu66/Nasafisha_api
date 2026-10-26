import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ApiError, ERROR_CODES } from '../common/errors';

@Injectable()
export class TrackerKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const key = process.env.TRACKER_API_KEY;

    if (!key || req.headers['x-tracker-key'] !== key) {
      throw new ApiError(ERROR_CODES.UNAUTHORIZED, 'Invalid tracker key.', 401);
    }

    return true;
  }
}
