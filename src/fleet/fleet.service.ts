import { Injectable } from '@nestjs/common';
import { AuditService } from '../access/audit.service';
import type { SessionUser } from '../access/token.service';
import { ApiError, ERROR_CODES } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateRouteDto, CreateVehicleDto } from './fleet.dto';
import { people } from './people';
import { RouteAuditService } from './route-audit.service';

interface VehicleRow {
  id: string;
  plate: string;
  crewId: string | null;
  status: string;
  isStale: boolean;
  lastLat: number | null;
  lastLng: number | null;
  lastSpeed: number | null;
  lastReportedAt: Date | null;
}

const startOfDay = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

@Injectable()
export class FleetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: RouteAuditService,
    private readonly audit: AuditService,
  ) {}

  async vehicleForCrew(crewId: string) {
    const v = await this.prisma.vehicle.findFirst({ where: { crewId } });
    return v ? { plate: v.plate, online: !!v.lastReportedAt && !v.isStale } : null;
  }

  async live() {
    const vehicles = await this.prisma.vehicle.findMany({ orderBy: { plate: 'asc' } });
    const open = await this.prisma.deviationAlert.findMany({
      where: { status: 'open' },
      select: { vehicleId: true },
    });
    const offRoute = new Set(open.map((a) => a.vehicleId));
    const crew = await people(this.prisma, vehicles.map((v) => v.crewId));

    return vehicles.map((v: VehicleRow) => {
      const c = v.crewId ? crew.get(v.crewId) : undefined;

      return {
        id: v.id,
        plate: v.plate,
        crewLabel: c?.crewLabel ?? c?.name ?? '',
        lat: v.lastLat,
        lng: v.lastLng,
        speed: v.lastSpeed,
        status: v.isStale ? 'stale' : offRoute.has(v.id) ? 'off_route' : v.status,
        lastReportedAt: v.lastReportedAt,
        staleMinutes:
          v.isStale && v.lastReportedAt
            ? Math.round((Date.now() - v.lastReportedAt.getTime()) / 60_000)
            : 0,
      };
    });
  }

  async crewStatus() {
    const vehicles = await this.prisma.vehicle.findMany({ where: { crewId: { not: null } } });
    const ids = vehicles.map((v) => v.crewId as string);
    const crew = await people(this.prisma, ids);
    const open = await this.prisma.deviationAlert.findMany({
      where: { status: 'open' },
      select: { vehicleId: true },
    });
    const offRoute = new Set(open.map((a) => a.vehicleId));

    const tickets = ids.length
      ? await this.prisma.ticket.findMany({
          where: {
            crewId: { in: ids },
            OR: [{ status: { not: 'resolved' } }, { closedAt: { gte: startOfDay() } }],
          },
          select: { crewId: true, status: true },
        })
      : [];

    return vehicles.map((v) => {
      const mine = tickets.filter((t) => t.crewId === v.crewId);
      const c = crew.get(v.crewId as string);

      return {
        crewId: v.crewId,
        crewLabel: c?.crewLabel ?? c?.name ?? '',
        vehiclePlate: v.plate,
        status: v.isStale
          ? 'stale'
          : offRoute.has(v.id)
            ? 'off_route'
            : v.status === 'idle'
              ? 'idle'
              : 'en_route',
        staleMinutes:
          v.isStale && v.lastReportedAt
            ? Math.round((Date.now() - v.lastReportedAt.getTime()) / 60_000)
            : undefined,
        ticketsDone: mine.filter((t) => t.status === 'resolved').length,
        ticketsTotal: mine.length,
      };
    });
  }

  async auditView(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });

    if (!vehicle) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Vehicle not found.', 404);

    const route = await this.prisma.route.findFirst({
      where: { vehicleId, shiftStart: { lte: new Date() } },
      orderBy: { shiftStart: 'desc' },
      include: { audits: true },
    });

    if (!route) throw new ApiError(ERROR_CODES.NOT_FOUND, 'No route was set for this vehicle.', 404);

    const crew = await people(this.prisma, [vehicle.crewId]);
    const c = vehicle.crewId ? crew.get(vehicle.crewId) : undefined;
    const calc = await this.audits.compute(route);

    return {
      vehiclePlate: vehicle.plate,
      crewLabel: c?.crewLabel ?? c?.name ?? '',
      shift: { start: route.shiftStart, end: route.shiftEnd },
      variance: { distanceMeters: calc.varianceMeters, timeMinutes: calc.varianceMinutes },
      deviationFlags: {
        total: route.audits.length,
        unresolved: route.audits.filter((a) => a.closedAt === null).length,
      },
      plannedPath: calc.plannedPath,
      actualPath: calc.actualPath,
    };
  }

  async ackStale(user: SessionUser, vehicleId: string) {
    const v = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!v) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Vehicle not found.', 404);

    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { isStale: false, staleAckedAt: new Date() },
    });

    await this.audit.log('STALE_ACKNOWLEDGED', user.id, vehicleId);
  }

  async createVehicle(dto: CreateVehicleDto) {
    try {
      const v = await this.prisma.vehicle.create({
        data: {
          plate: dto.plate.trim().toUpperCase(),
          deviceId: dto.deviceId.trim(),
          crewId: dto.crewId ?? null,
          zone: dto.zone ?? null,
        },
      });

      return { id: v.id, plate: v.plate };
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        throw new ApiError(
          'DUPLICATE',
          'A vehicle with this plate or tracker id already exists.',
          409,
        );
      }
      throw err;
    }
  }

  async assignCrew(vehicleId: string, crewId: string) {
    const crew = await this.prisma.account.findUnique({ where: { id: crewId } });
    if (!crew || crew.role !== 'field_crew') {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 'Crew not found.', 404);
    }

    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { crewId },
    });
  }

  async createRoute(dto: CreateRouteDto) {
    const start = new Date(dto.shiftStart);
    const end = new Date(dto.shiftEnd);

    if (end <= start) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        'The shift must end after it starts.',
        400,
      );
    }

    const pathOk = dto.plannedPath.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        p.every((n) => Number.isFinite(n)) &&
        Math.abs(p[0]) <= 90 &&
        Math.abs(p[1]) <= 180,
    );

    if (!pathOk) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        'plannedPath must be a list of [lat, lng] pairs.',
        400,
      );
    }

    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
    if (!vehicle) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 'Vehicle not found.', 404);
    }

    const route = await this.prisma.route.create({
      data: {
        vehicleId: dto.vehicleId,
        zone: dto.zone ?? vehicle.zone,
        shiftStart: start,
        shiftEnd: end,
        plannedPath: dto.plannedPath,
        plannedMinutes: dto.plannedMinutes,
        ...(dto.thresholdMeters ? { thresholdMeters: dto.thresholdMeters } : {}),
        ...(dto.thresholdMinutes ? { thresholdMinutes: dto.thresholdMinutes } : {}),
      },
    });

    return { id: route.id };
  }
}
