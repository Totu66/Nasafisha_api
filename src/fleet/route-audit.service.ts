import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { haversine, LatLng, pathLength } from './path';

interface RouteLike {
  id: string;
  vehicleId: string;
  shiftStart: Date;
  shiftEnd: Date;
  plannedPath: unknown;
  plannedMinutes: number;
}

@Injectable()
export class RouteAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async compute(route: RouteLike) {
    const end = route.shiftEnd < new Date() ? route.shiftEnd : new Date();
    const positions = await this.prisma.positionLog.findMany({
      where: {
        vehicleId: route.vehicleId,
        recordedAt: { gte: route.shiftStart, lte: end },
      },
      orderBy: { recordedAt: 'asc' },
      select: { lat: true, lng: true, recordedAt: true },
    });

    const planned = route.plannedPath as LatLng[];
    const plannedMeters = Math.round(pathLength(planned));

    let actual = 0;
    for (let i = 1; i < positions.length; i++) {
      actual += haversine(
        [positions[i - 1].lat, positions[i - 1].lng],
        [positions[i].lat, positions[i].lng],
      );
    }

    const actualMeters = Math.round(actual);
    const actualMinutes =
      positions.length >= 2
        ? Math.round(
            (positions[positions.length - 1].recordedAt.getTime() - positions[0].recordedAt.getTime()) /
              60_000,
          )
        : 0;

    return {
      hasData: positions.length >= 2,
      plannedMeters,
      actualMeters,
      varianceMeters: actualMeters - plannedMeters,
      plannedMinutes: route.plannedMinutes,
      actualMinutes,
      varianceMinutes: actualMinutes - route.plannedMinutes,
      plannedPath: planned,
      actualPath: positions.map((p): LatLng => [p.lat, p.lng]),
    };
  }

  @Cron('*/15 * * * *')
  async auditEndedShifts() {
    const routes = await this.prisma.route.findMany({
      where: { audited: false, shiftEnd: { lte: new Date() } },
      take: 100,
    });

    for (const route of routes) {
      const c = await this.compute(route);

      if (c.hasData) {
        await this.prisma.routeAudit.create({
          data: {
            routeId: route.id,
            vehicleId: route.vehicleId,
            plannedMeters: c.plannedMeters,
            actualMeters: c.actualMeters,
            varianceMeters: c.varianceMeters,
            plannedMinutes: c.plannedMinutes,
            actualMinutes: c.actualMinutes,
            varianceMinutes: c.varianceMinutes,
          },
        });
      }

      await this.prisma.route.update({
        where: { id: route.id },
        data: { audited: true },
      });
    }
  }
}
