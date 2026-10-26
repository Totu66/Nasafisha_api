import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { POSITION_RETENTION_DAYS, STALE_MINUTES } from './fleet.config';

@Injectable()
export class StaleService {
  private readonly logger = new Logger(StaleService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('* * * * *')
  async flagStale() {
    const limit = new Date(Date.now() - STALE_MINUTES * 60_000);
    const silent = await this.prisma.vehicle.findMany({
      where: { isStale: false, lastReportedAt: { lt: limit } },
    });

    const toFlag = silent.filter(
      (v) => !v.staleAckedAt || (v.lastReportedAt && v.staleAckedAt < v.lastReportedAt),
    );

    if (toFlag.length) {
      await this.prisma.vehicle.updateMany({
        where: { id: { in: toFlag.map((v) => v.id) } },
        data: { isStale: true },
      });

      this.logger.warn(`Stale vehicles: ${toFlag.map((v) => v.plate).join(', ')}`);
    }
  }

  @Cron('0 3 * * *')
  async purgeOld() {
    const cutoff = new Date(Date.now() - POSITION_RETENTION_DAYS * 86_400_000);
    const { count } = await this.prisma.positionLog.deleteMany({
      where: { recordedAt: { lt: cutoff } },
    });

    await this.prisma.rejectedPosition.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 30 * 86_400_000) } },
    });

    if (count) this.logger.log(`Deleted ${count} old GPS records`);
  }
}
