import { Injectable } from '@nestjs/common';
import { AuditService } from '../access/audit.service';
import type { SessionUser } from '../access/token.service';
import { ApiError, ERROR_CODES } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { distanceToPath, LatLng } from './path';
import { people } from './people';

@Injectable()
export class DeviationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async check(vehicle: { id: string; offRouteSince: Date | null }, p: { lat: number; lng: number; recordedAt: Date }) {
    const route = await this.prisma.route.findFirst({
      where: {
        vehicleId: vehicle.id,
        shiftStart: { lte: p.recordedAt },
        shiftEnd: { gte: p.recordedAt },
      },
    });

    if (!route) {
      if (vehicle.offRouteSince) await this.setOffRouteSince(vehicle.id, null);
      return;
    }

    const distance = distanceToPath([p.lat, p.lng], route.plannedPath as unknown as LatLng[]);
    const openAlert = await this.prisma.deviationAlert.findFirst({
      where: { routeId: route.id, closedAt: null },
    });

    if (distance <= route.thresholdMeters) {
      if (vehicle.offRouteSince) await this.setOffRouteSince(vehicle.id, null);

      if (openAlert) {
        await this.prisma.deviationAlert.update({
          where: { id: openAlert.id },
          data: {
            closedAt: new Date(),
            status: openAlert.status === 'open' ? 'cleared' : openAlert.status,
          },
        });
      }

      return;
    }

    const since = vehicle.offRouteSince ?? p.recordedAt;

    if (!vehicle.offRouteSince) await this.setOffRouteSince(vehicle.id, p.recordedAt);

    const minutes = Math.floor((p.recordedAt.getTime() - since.getTime()) / 60_000);

    if (!openAlert && minutes >= route.thresholdMinutes) {
      await this.prisma.deviationAlert.create({
        data: {
          vehicleId: vehicle.id,
          routeId: route.id,
          distanceMeters: Math.round(distance),
          minutesOff: minutes,
        },
      });
    } else if (openAlert?.status === 'open') {
      await this.prisma.deviationAlert.update({
        where: { id: openAlert.id },
        data: {
          distanceMeters: Math.round(distance),
          minutesOff: minutes,
        },
      });
    }
  }

  private setOffRouteSince(vehicleId: string, value: Date | null) {
    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { offRouteSince: value },
    });
  }

  async listOpen() {
    const rows = await this.prisma.deviationAlert.findMany({
      where: { status: 'open' },
      include: { vehicle: true, route: true },
      orderBy: { flaggedAt: 'desc' },
    });

    const crew = await people(this.prisma, rows.map((r) => r.vehicle.crewId));

    return rows.map((a) => {
      const c = a.vehicle.crewId ? crew.get(a.vehicle.crewId) : undefined;

      return {
        id: a.id,
        crewLabel: c?.crewLabel ?? c?.name ?? '',
        vehiclePlate: a.vehicle.plate,
        distanceMeters: a.distanceMeters,
        minutesOff: a.minutesOff,
        thresholdMeters: a.route.thresholdMeters,
        thresholdMinutes: a.route.thresholdMinutes,
        status: a.status,
      };
    });
  }

  async authorise(user: SessionUser, id: string) {
    const alert = await this.prisma.deviationAlert.findUnique({ where: { id } });

    if (!alert) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Alert not found.', 404);
    if (alert.status !== 'open') {
      throw new ApiError('INVALID_STATE', 'This alert is already handled.', 409);
    }

    await this.prisma.deviationAlert.update({
      where: { id },
      data: { status: 'authorised', authorisedById: user.id },
    });

    await this.audit.log('DEVIATION_AUTHORISED', user.id, id);
  }
}
