import { Injectable } from '@nestjs/common';
import type { SessionUser } from '../access/token.service';
import { ApiError, ERROR_CODES } from '../common/errors';
import { distanceMeters, Point } from '../common/geo';
import {
  BOX_DEGREES,
  DUMPING_SITE_RADIUS_METERS,
  HOTSPOT_MIN_REPORTS,
  HOTSPOT_WINDOW_DAYS,
} from '../common/report.config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DumpingService {
  constructor(private readonly prisma: PrismaService) {}

  async attach(reportId: string, point: Point, note?: string | null) {
    const near = await this.prisma.dumpingSite.findMany({
      where: {
        lat: { gte: point.lat - BOX_DEGREES, lte: point.lat + BOX_DEGREES },
        lng: { gte: point.lng - BOX_DEGREES, lte: point.lng + BOX_DEGREES },
      },
    });
    const site =
      near.find(
        (candidate) =>
          distanceMeters(candidate, point) <= DUMPING_SITE_RADIUS_METERS,
      ) ??
      (await this.prisma.dumpingSite.create({
        data: { lat: point.lat, lng: point.lng, name: note?.trim() || null },
      }));

    await this.prisma.report.update({
      where: { id: reportId },
      data: { dumpingSiteId: site.id },
    });

    const since = new Date(Date.now() - HOTSPOT_WINDOW_DAYS * 86_400_000);
    const [total, recent] = await Promise.all([
      this.prisma.report.count({ where: { dumpingSiteId: site.id } }),
      this.prisma.report.count({
        where: { dumpingSiteId: site.id, createdAt: { gte: since } },
      }),
    ]);
    await this.prisma.dumpingSite.update({
      where: { id: site.id },
      data: {
        reportCount: total,
        lastReportedAt: new Date(),
        hotspot: recent >= HOTSPOT_MIN_REPORTS,
      },
    });
  }

  async list(zone?: string, minReports?: number, hotspotOnly?: boolean) {
    const rows = await this.prisma.dumpingSite.findMany({
      where: {
        ...(minReports ? { reportCount: { gte: minReports } } : {}),
        ...(hotspotOnly ? { hotspot: true } : {}),
        ...(zone ? { reports: { some: { incident: { zone } } } } : {}),
      },
      include: {
        reports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { incident: true },
        },
      },
      orderBy: { reportCount: 'desc' },
    });
    return rows.map((site) => ({
      id: site.id,
      name: site.name ?? 'Unnamed site',
      zone: site.reports[0]?.incident.zone ?? 'Unassigned',
      reports: site.reportCount,
      status: site.hotspot ? 'hotspot' : 'tracked',
      lat: site.lat,
      lng: site.lng,
      lastReportedAt: site.lastReportedAt,
    }));
  }

  async history(id: string) {
    const site = await this.prisma.dumpingSite.findUnique({
      where: { id },
      include: {
        reports: {
          orderBy: { createdAt: 'desc' },
          select: { reference: true, note: true, createdAt: true },
        },
        remediations: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!site) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Site not found.', 404);
    return {
      id: site.id,
      name: site.name ?? 'Unnamed site',
      hotspot: site.hotspot,
      reports: site.reports,
      remediations: site.remediations.map((r) => ({
        id: r.id,
        note: r.note,
        by: r.byName,
        at: r.createdAt,
      })),
    };
  }

  async addRemediation(by: SessionUser, id: string, note: string) {
    const site = await this.prisma.dumpingSite.findUnique({ where: { id } });
    if (!site) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Site not found.', 404);
    await this.prisma.dumpingRemediation.create({
      data: { siteId: id, note, byName: by.name },
    });
  }
}
