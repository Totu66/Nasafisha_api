import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(
    action: string,
    actorId?: string | null,
    targetId?: string | null,
    detail?: string,
  ) {
    return this.prisma.auditLog.create({
      data: {
        action,
        actorId: actorId ?? null,
        targetId: targetId ?? null,
        detail: detail ?? null,
      },
    });
  }
}
