import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(action: {
    id: string;
    userId: string;
    action: string;
    payload?: unknown;
    createdAt?: Date;
  }) {
    return this.prisma.syncedAction.create({
      data: {
        actionId: action.id,
        userId: action.userId,
        action: action.action,
        payload: (action.payload ?? {}) as any,
        createdAt: action.createdAt ?? new Date(),
      },
    });
  }

  async flush(userId: string) {
    const rows = await this.prisma.syncedAction.findMany({
      where: { userId, status: 'queued' },
      orderBy: { createdAt: 'asc' },
    });

    for (const row of rows) {
      const duplicate = await this.prisma.syncedAction.findFirst({
        where: {
          actionId: row.actionId,
          userId: row.userId,
          status: 'processed',
        },
      });

      if (duplicate) {
        await this.prisma.syncedAction.update({
          where: { id: row.id },
          data: { status: 'ignored', reason: 'duplicate' },
        });
        continue;
      }

      try {
        await this.prisma.syncedAction.update({
          where: { id: row.id },
          data: { status: 'processed', syncedAt: new Date() },
        });
      } catch (error) {
        await this.prisma.syncedAction.update({
          where: { id: row.id },
          data: {
            status: 'conflict',
            reason: error instanceof Error ? error.message : 'sync-error',
          },
        });

        await this.prisma.syncConflict.create({
          data: {
            actionId: row.actionId,
            userId: row.userId,
            type: row.action,
            payload: row.payload as any,
            reason: error instanceof Error ? error.message : 'sync-error',
          },
        });
      }
    }

    return this.prisma.syncedAction.findMany({ where: { userId, status: 'queued' } });
  }
}
