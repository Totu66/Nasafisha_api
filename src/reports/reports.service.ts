import { Injectable } from '@nestjs/common';
import type { SessionUser } from '../access/token.service';
import { ApiError, ERROR_CODES } from '../common/errors';
import { distanceMeters } from '../common/geo';
import { readLocation, requirePhoto } from '../common/photo';
import {
  BOX_DEGREES,
  CLUSTER_RADIUS_METERS,
  CLUSTER_WINDOW_HOURS,
} from '../common/report.config';
import { DumpingService } from '../dumping/dumping.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { CreateReportDto } from './report.dto';
import { ReportNotifyService } from './report-notify.service';

const pad = (n: number, width = 2) => String(n).padStart(width, '0');
const STEPS = ['submitted', 'verified', 'assigned', 'in_progress', 'resolved'];

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly dumping: DumpingService,
    private readonly notify: ReportNotifyService,
  ) {}

  async create(
    user: SessionUser,
    dto: CreateReportDto,
    file?: File,
  ) {
    const photo = requirePhoto(file, 'PHOTO_REQUIRED');
    const { point, capturedAt } = readLocation(dto);
    const photoKey = await this.storage.save(photo, 'reports');

    const since = new Date(Date.now() - CLUSTER_WINDOW_HOURS * 3_600_000);
    const nearby = await this.prisma.incident.findMany({
      where: {
        status: 'open',
        issueType: dto.issueType,
        createdAt: { gte: since },
        lat: { gte: point.lat - BOX_DEGREES, lte: point.lat + BOX_DEGREES },
        lng: { gte: point.lng - BOX_DEGREES, lte: point.lng + BOX_DEGREES },
      },
    });
    const match = nearby.find(
      (incident) => distanceMeters(incident, point) <= CLUSTER_RADIUS_METERS,
    );

    const countToday = await this.todayCount();
    for (let attempt = 0; attempt < 5; attempt++) {
      const reference = this.makeReference(countToday + 1 + attempt);
      try {
        const report = await this.prisma.$transaction(async (tx) => {
          let incidentId: string;
          if (match) {
            await tx.incident.update({
              where: { id: match.id },
              data: { citizenCount: { increment: 1 } },
            });
            incidentId = match.id;
          } else {
            const incident = await tx.incident.create({
              data: {
                issueType: dto.issueType,
                lat: point.lat,
                lng: point.lng,
              },
            });
            const ticket = await tx.ticket.create({
              data: { incidentId: incident.id },
            });
            await tx.ticketEvent.create({
              data: {
                ticketId: ticket.id,
                kind: 'submitted',
                actorName: user.name,
              },
            });
            incidentId = incident.id;
          }
          return tx.report.create({
            data: {
              reference,
              citizenId: user.id,
              incidentId,
              issueType: dto.issueType,
              photoKey,
              lat: point.lat,
              lng: point.lng,
              capturedAt,
              note: dto.note ?? null,
            },
          });
        });

        if (dto.issueType === 'illegal_dumping') {
          await this.dumping.attach(report.id, point, dto.note);
        }

        void this.notify.received(report).catch(() => undefined);

        return {
          id: report.id,
          reference,
          status: report.status,
          clustered: !!match,
        };
      } catch (err) {
        if ((err as { code?: string }).code !== 'P2002') throw err;
      }
    }
    throw new ApiError(
      ERROR_CODES.INTERNAL_ERROR,
      'Could not save the report. Try again.',
      500,
    );
  }

  async listMine(citizenId: string) {
    const rows = await this.prisma.report.findMany({
      where: { citizenId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { incident: true },
    });
    return rows.map((report) => ({
      id: report.id,
      reference: report.reference,
      issueType: report.issueType,
      zone: report.incident.zone,
      status: report.status,
      createdAt: report.createdAt,
    }));
  }

  async getOne(citizenId: string, reference: string) {
    const report = await this.prisma.report.findFirst({
      where: { reference, citizenId },
      include: {
        incident: {
          include: {
            ticket: {
              include: { events: { orderBy: { createdAt: 'asc' } } },
            },
          },
        },
      },
    });
    if (!report) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 'Report not found.', 404);
    }

    const ticket = report.incident.ticket;
    const timeline = (ticket?.events ?? [])
      .filter((event) => STEPS.includes(event.kind))
      .map((event) => ({
        status: event.kind,
        at: event.kind === 'submitted' ? report.createdAt : event.createdAt,
        detail: event.detail,
      }));

    return {
      reference: report.reference,
      issueType: report.issueType,
      note: report.note,
      status: report.status,
      zone: report.incident.zone,
      capturedAt: report.capturedAt,
      createdAt: report.createdAt,
      photoUrl: await this.storage.urlFor(report.photoKey),
      neighbours: Math.max(0, report.incident.citizenCount - 1),
      timeline,
      resolved:
        ticket?.status === 'resolved'
          ? {
              afterPhotoUrl: await this.storage.urlFor(ticket.afterPhotoKey),
              at: ticket.closedAt,
              distanceMeters: ticket.closureDistance,
            }
          : null,
    };
  }

  private async todayCount() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.prisma.report.count({ where: { createdAt: { gte: start } } });
  }

  private makeReference(n: number) {
    const date = new Date();
    return `NSF-${pad(date.getFullYear() % 100)}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(n, 4)}`;
  }
}
