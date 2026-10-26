import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const startOfWeek = (d = new Date()) => {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

const DAY_MS = 86_400_000;
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async week(from: Date, to: Date, zone?: string) {
    const ticketZone = zone ? { incident: { zone } } : {};

    const created = await this.prisma.ticket.findMany({
      where: { createdAt: { gte: from, lt: to }, ...ticketZone },
      select: { status: true },
    });

    const closed = await this.prisma.ticket.findMany({
      where: { closedAt: { gte: from, lt: to }, ...ticketZone },
      select: { createdAt: true, closedAt: true },
    });

    const missed = await this.prisma.incident.count({
      where: {
        issueType: 'missed_collection',
        createdAt: { gte: from, lt: to },
        ...(zone ? { zone } : {}),
      },
    });

    const resolved = created.filter((t) => t.status === 'resolved').length;
    const collectionRate = created.length ? resolved / created.length : 1;

    const hours = closed.map((t) =>
      Math.max(0, (t.closedAt as Date).getTime() - t.createdAt.getTime()) / 3_600_000,
    );
    const avgResolutionHours = hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : 0;

    const audits = await this.prisma.routeAudit.findMany({
      where: {
        auditedAt: { gte: from, lt: to },
        ...(zone ? { route: { zone } } : {}),
      },
      select: { routeId: true },
    });

    const routeIds = audits.map((a) => a.routeId);
    const flagged = routeIds.length
      ? await this.prisma.deviationAlert.findMany({
          where: { routeId: { in: routeIds } },
          select: { routeId: true },
        })
      : [];
    const flaggedCount = new Set(flagged.map((a) => a.routeId)).size;
    const routeAdherence = routeIds.length
      ? Math.round(((routeIds.length - flaggedCount) / routeIds.length) * 100)
      : 100;

    return {
      missed,
      collectionRate,
      avgResolutionHours,
      routeAdherence,
      ticketsOpened: created.length,
    };
  }

  score(m: { collectionRate: number; avgResolutionHours: number; routeAdherence: number }): number {
    const speed = Math.max(
      0,
      Math.min(100, 100 - Math.max(0, m.avgResolutionHours - 24) * (100 / 72)),
    );

    return Math.round(
      0.4 * m.collectionRate * 100 + 0.3 * speed + 0.3 * m.routeAdherence,
    );
  }
}
