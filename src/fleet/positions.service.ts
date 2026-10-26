import { Injectable } from '@nestjs/common';
import { ApiError, ERROR_CODES } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { DeviationService } from './deviation.service';
import { MAX_BATCH, MOVING_SPEED_KMH, SERVICING_RADIUS_METERS } from './fleet.config';
import { haversine } from './path';

interface Parsed {
  deviceId: string;
  lat: number;
  lng: number;
  speed: number;
  recordedAt: Date;
}

@Injectable()
export class PositionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deviation: DeviationService,
  ) {}

  async ingest(body: unknown) {
    const list = (body as { positions?: unknown })?.positions;
    const records: unknown[] = Array.isArray(list) ? list : [body];

    if (records.length > MAX_BATCH) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        `Send at most ${MAX_BATCH} positions at a time.`,
        400,
      );
    }

    let accepted = 0;
    const rejected: { index: number; reason: string }[] = [];

    for (const [index, raw] of records.entries()) {
      const parsed = this.parse(raw);
      const reason = typeof parsed === 'string' ? parsed : await this.store(parsed);

      if (reason) {
        rejected.push({ index, reason });
        await this.prisma.rejectedPosition.create({
          data: {
            reason,
            raw: JSON.stringify(raw ?? null).slice(0, 2000),
          },
        });
      } else {
        accepted++;
      }
    }

    return { accepted, rejected };
  }

  private parse(raw: unknown): Parsed | string {
    if (!raw || typeof raw !== 'object') return 'Record is not an object';

    const o = raw as Record<string, unknown>;
    const deviceId = String(o.vehicle_id ?? o.vehicleId ?? '').trim();
    const lat = Number(o.latitude ?? o.lat);
    const lng = Number(o.longitude ?? o.lng);
    const speed = Number(o.speed ?? 0);

    if (!deviceId) return 'vehicle_id is missing';
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return 'latitude is missing or out of range';
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return 'longitude is missing or out of range';
    if (!Number.isFinite(speed) || speed < 0 || speed > 200) return 'speed is out of range';

    const ts = o.timestamp;
    const recordedAt = typeof ts === 'number'
      ? new Date(ts < 1e12 ? ts * 1000 : ts)
      : new Date(String(ts ?? ''));

    if (Number.isNaN(recordedAt.getTime())) return 'timestamp is missing or not valid';
    if (recordedAt.getTime() > Date.now() + 5 * 60_000) return 'timestamp is in the future';
    if (recordedAt.getTime() < Date.now() - 24 * 3_600_000) return 'timestamp is more than 24 hours old';

    return { deviceId, lat, lng, speed, recordedAt };
  }

  private async store(p: Parsed): Promise<string | null> {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { deviceId: p.deviceId } });
    if (!vehicle) return 'Unknown vehicle';

    await this.prisma.positionLog.create({
      data: {
        vehicleId: vehicle.id,
        lat: p.lat,
        lng: p.lng,
        speed: p.speed,
        recordedAt: p.recordedAt,
      },
    });

    if (!vehicle.lastReportedAt || p.recordedAt >= vehicle.lastReportedAt) {
      await this.prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          lastLat: p.lat,
          lastLng: p.lng,
          lastSpeed: p.speed,
          lastReportedAt: p.recordedAt,
          status: await this.statusFor(vehicle.crewId, p),
          isStale: false,
        },
      });

      await this.deviation.check(vehicle, p);
    }

    return null;
  }

  private async statusFor(crewId: string | null, p: Parsed): Promise<string> {
    if (p.speed > MOVING_SPEED_KMH) return 'en_route';
    if (!crewId) return 'idle';

    const tickets = await this.prisma.ticket.findMany({
      where: { crewId, status: { in: ['assigned', 'in_progress'] } },
      include: { incident: true },
    });

    const atTicket = tickets.some(
      (t) =>
        haversine([p.lat, p.lng], [t.incident.lat, t.incident.lng]) <= SERVICING_RADIUS_METERS,
    );

    return atTicket ? 'servicing' : 'idle';
  }
}
