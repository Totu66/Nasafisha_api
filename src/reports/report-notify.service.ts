import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportNotifyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async received(report: { id: string; reference: string; citizenId: string }) {
    await this.notifications.status(report, 'submitted');
  }

  async incident(incidentId: string, kind: 'in_progress' | 'resolved') {
    const reports = await this.prisma.report.findMany({
      where: { incidentId },
      select: { id: true, reference: true, citizenId: true },
    });

    await Promise.allSettled(reports.map((r) => this.notifications.status(r, kind)));
  }
}
