import { Injectable } from '@nestjs/common';
import type { SessionUser } from '../access/token.service';
import { ApiError, ERROR_CODES } from '../common/errors';
import { distanceMeters, Point } from '../common/geo';
import { readLocation, requirePhoto } from '../common/photo';
import { CLOSURE_RADIUS_METERS } from '../common/report.config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { accountMap, TicketRow, WITH_FIRST_REPORT } from './lookup';
import { ReportNotifyService } from './report-notify.service';
import type { PhotoLocationDto } from './report.dto';
import { TicketsService } from './tickets.service';

interface ApprovalRow {
  id: string;
  ticketId: string;
  requestedById: string;
  distanceMeters: number;
  afterPhotoKey: string;
  afterLat: number;
  afterLng: number;
  capturedAt: Date;
  ticket: TicketRow;
}

@Injectable()
export class ClosureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notify: ReportNotifyService,
    private readonly tickets: TicketsService,
  ) {}

  private event(
    ticketId: string,
    kind: string,
    actorName: string,
    detail?: string,
  ) {
    return this.prisma.ticketEvent.create({
      data: { ticketId, kind, actorName, detail: detail ?? null },
    });
  }

  private assertOpen(status: string) {
    if (!['assigned', 'in_progress'].includes(status)) {
      throw new ApiError(
        'INVALID_STATE',
        "This ticket can't be closed right now.",
        409,
      );
    }
  }

  async close(
    user: SessionUser,
    id: string,
    dto: PhotoLocationDto,
    file?: File,
  ) {
    const ticket = await this.tickets.findOwn(user.id, id);
    this.assertOpen(ticket.status);

    let photo: File;
    try {
      photo = requirePhoto(file, 'CLOSURE_PHOTO_REQUIRED');
    } catch (err) {
      await this.event(
        ticket.id,
        'closure_blocked',
        user.name,
        'photo missing or not valid',
      );
      throw err;
    }

    const { point, capturedAt } = readLocation(dto);
    const distance = distanceMeters(point, ticket.incident);
    if (distance > CLOSURE_RADIUS_METERS) {
      await this.event(
        ticket.id,
        'closure_blocked',
        user.name,
        `${distance} m`,
      );
      throw new ApiError(
        'CLOSURE_LOCATION_MISMATCH',
        `The photo is ${distance} m from the report. It must be within ${CLOSURE_RADIUS_METERS} m.`,
        409,
      );
    }

    const photoKey = await this.storage.save(photo, 'closures');
    await this.finish(ticket, {
      photoKey,
      point,
      distance,
      capturedAt,
      crewName: user.name,
    });
    return { status: 'resolved' };
  }

  async requestApproval(
    user: SessionUser,
    id: string,
    dto: PhotoLocationDto,
    file?: File,
  ) {
    const ticket = await this.tickets.findOwn(user.id, id);
    this.assertOpen(ticket.status);
    const photo = requirePhoto(file, 'CLOSURE_PHOTO_REQUIRED');
    const { point, capturedAt } = readLocation(dto);
    const distance = distanceMeters(point, ticket.incident);
    if (distance <= CLOSURE_RADIUS_METERS) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        'The photo is within range. Close the ticket directly.',
        400,
      );
    }

    const afterPhotoKey = await this.storage.save(photo, 'closures');
    await this.prisma.$transaction([
      this.prisma.closureApproval.create({
        data: {
          ticketId: ticket.id,
          requestedById: user.id,
          distanceMeters: distance,
          afterPhotoKey,
          afterLat: point.lat,
          afterLng: point.lng,
          capturedAt,
        },
      }),
      this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'closing' },
      }),
      this.prisma.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          kind: 'closure_requested',
          actorName: user.name,
          detail: `${distance} m`,
        },
      }),
    ]);
    return { status: 'closing' };
  }

  async listPending() {
    const rows = await this.prisma.closureApproval.findMany({
      where: { status: 'pending' },
      include: { ticket: { include: WITH_FIRST_REPORT } },
      orderBy: { createdAt: 'asc' },
    });
    const people = await accountMap(this.prisma, [
      ...rows.map((row) => row.requestedById),
      ...rows.map((row) => row.ticket.crewId),
    ]);
    return Promise.all(rows.map((row) => this.view(row, people)));
  }

  async one(id: string) {
    const approval = await this.load(id);
    const people = await accountMap(this.prisma, [approval.requestedById]);
    return this.view(approval, people);
  }

  async approve(supervisor: SessionUser, id: string) {
    const approval = await this.load(id);
    if (approval.status !== 'pending') {
      throw new ApiError('INVALID_STATE', 'This request was already decided.', 409);
    }
    const people = await accountMap(this.prisma, [approval.requestedById]);
    await this.finish(approval.ticket, {
      photoKey: approval.afterPhotoKey,
      point: { lat: approval.afterLat, lng: approval.afterLng },
      distance: approval.distanceMeters,
      capturedAt: approval.capturedAt,
      crewName: people.get(approval.requestedById)?.name ?? 'Crew',
      approval: {
        id: approval.id,
        supervisorId: supervisor.id,
        supervisorName: supervisor.name,
      },
    });
    return { status: 'resolved' };
  }

  async sendBack(supervisor: SessionUser, id: string) {
    const approval = await this.load(id);
    if (approval.status !== 'pending') {
      throw new ApiError('INVALID_STATE', 'This request was already decided.', 409);
    }
    await this.prisma.$transaction([
      this.prisma.closureApproval.update({
        where: { id },
        data: {
          status: 'sent_back',
          decidedById: supervisor.id,
          decidedAt: new Date(),
        },
      }),
      this.prisma.ticket.update({
        where: { id: approval.ticketId },
        data: { status: 'in_progress' },
      }),
      this.prisma.ticketEvent.create({
        data: {
          ticketId: approval.ticketId,
          kind: 'closure_sent_back',
          actorName: supervisor.name,
        },
      }),
    ]);
    return { status: 'in_progress' };
  }

  private async load(id: string) {
    const approval = await this.prisma.closureApproval.findUnique({
      where: { id },
      include: { ticket: { include: WITH_FIRST_REPORT } },
    });
    if (!approval) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 'Request not found.', 404);
    }
    return approval;
  }

  private async finish(
    ticket: TicketRow,
    options: {
      photoKey: string;
      point: Point;
      distance: number;
      capturedAt: Date;
      crewName: string;
      approval?: {
        id: string;
        supervisorId: string;
        supervisorName: string;
      };
    },
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'resolved',
          afterPhotoKey: options.photoKey,
          closureLat: options.point.lat,
          closureLng: options.point.lng,
          closureDistance: options.distance,
          overrideFlag: !!options.approval,
          closedAt: options.capturedAt,
        },
      });
      await tx.incident.update({
        where: { id: ticket.incidentId },
        data: { status: 'resolved' },
      });
      await tx.report.updateMany({
        where: { incidentId: ticket.incidentId },
        data: { status: 'resolved' },
      });
      if (options.approval) {
        await tx.closureApproval.update({
          where: { id: options.approval.id },
          data: {
            status: 'approved',
            decidedById: options.approval.supervisorId,
            decidedAt: new Date(),
          },
        });
        await tx.ticketEvent.create({
          data: {
            ticketId: ticket.id,
            kind: 'closure_approved',
            actorName: options.approval.supervisorName,
            detail: `${options.distance} m`,
          },
        });
      }
      await tx.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          kind: 'resolved',
          actorName: options.crewName,
          detail: `${options.distance} m`,
        },
      });
    });
    void this.notify.incident(ticket.incidentId, 'resolved').catch(() => undefined);
  }

  private async view(
    approval: ApprovalRow,
    people: Map<string, { name: string; crewLabel: string | null }>,
  ) {
    const first = approval.ticket.incident.reports[0];
    const crew = people.get(approval.requestedById);
    return {
      id: approval.id,
      ticketId: approval.ticketId,
      reference: first?.reference ?? '',
      crewLabel: crew?.crewLabel ?? crew?.name ?? '',
      requestedByName: crew?.name ?? '',
      distanceMeters: approval.distanceMeters,
      limitMeters: CLOSURE_RADIUS_METERS,
      beforePhotoUrl: (await this.storage.urlFor(first?.photoKey)) ?? '',
      beforeAt: (first?.capturedAt ?? approval.ticket.createdAt).toISOString(),
      afterPhotoUrl: (await this.storage.urlFor(approval.afterPhotoKey)) ?? '',
      afterAt: approval.capturedAt.toISOString(),
    };
  }
}
