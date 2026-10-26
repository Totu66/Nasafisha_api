import { Injectable } from '@nestjs/common';
import type { SessionUser } from '../access/token.service';
import { ApiError, ERROR_CODES } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { accountMap, TicketRow, WITH_FIRST_REPORT } from './lookup';
import { ReportNotifyService } from './report-notify.service';
import { FleetService } from '../fleet/fleet.service';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notify: ReportNotifyService,
    private readonly fleet: FleetService,
  ) {}

  async mine(crewId: string) {
    const rows = await this.prisma.ticket.findMany({
      where: { crewId, status: { in: ['assigned', 'in_progress', 'closing'] } },
      include: WITH_FIRST_REPORT,
      orderBy: { createdAt: 'asc' },
    });
    const vehicle = await this.fleet.vehicleForCrew(crewId);
    return {
      vehicle,
      tickets: await Promise.all(rows.map((row) => this.toCrewTicket(row))),
    };
  }

  async one(crewId: string, id: string) {
    return this.toCrewTicket(await this.findOwn(crewId, id));
  }

  async findOwn(crewId: string, id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: WITH_FIRST_REPORT,
    });
    if (!ticket || ticket.crewId !== crewId) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 'Ticket not found.', 404);
    }
    return ticket;
  }

  async start(user: SessionUser, id: string) {
    const ticket = await this.findOwn(user.id, id);
    if (ticket.status !== 'assigned') return { status: ticket.status };

    await this.prisma.$transaction([
      this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'in_progress' },
      }),
      this.prisma.report.updateMany({
        where: { incidentId: ticket.incidentId },
        data: { status: 'in_progress' },
      }),
      this.prisma.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          kind: 'in_progress',
          actorName: user.name,
        },
      }),
    ]);
    void this.notify.incident(ticket.incidentId, 'in_progress').catch(() => undefined);
    return { status: 'in_progress' };
  }

  private async toCrewTicket(ticket: TicketRow) {
    const first = ticket.incident.reports[0];
    return {
      id: ticket.id,
      reference: first?.reference ?? '',
      issueType: ticket.incident.issueType,
      zone: ticket.incident.zone,
      residentNote: first?.note ?? undefined,
      status: ticket.status,
      location: { lat: ticket.incident.lat, lng: ticket.incident.lng },
      beforePhotoUrl: (await this.storage.urlFor(first?.photoKey)) ?? '',
      reportedAt: (first?.capturedAt ?? ticket.createdAt).toISOString(),
    };
  }

  async adminList() {
    const rows = await this.prisma.ticket.findMany({
      include: WITH_FIRST_REPORT,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const people = await accountMap(
      this.prisma,
      rows.map((row) => row.crewId),
    );
    return rows.map((ticket) => {
      const crew = ticket.crewId ? people.get(ticket.crewId) : undefined;
      return {
        id: ticket.id,
        reference: ticket.incident.reports[0]?.reference ?? '',
        issueType: ticket.incident.issueType,
        zone: ticket.incident.zone,
        crewLabel: crew ? (crew.crewLabel ?? crew.name) : null,
        status: ticket.status,
      };
    });
  }

  async adminDetail(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        ...WITH_FIRST_REPORT,
        events: { orderBy: { createdAt: 'asc' } },
        approvals: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!ticket) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 'Ticket not found.', 404);
    }

    const first = ticket.incident.reports[0];
    const approval = ticket.approvals[0];
    const pending = approval?.status === 'pending' ? approval : null;
    const people = await accountMap(this.prisma, [
      ticket.crewId,
      pending?.requestedById,
    ]);
    const crew = ticket.crewId ? people.get(ticket.crewId) : undefined;
    const afterKey = ticket.afterPhotoKey ?? pending?.afterPhotoKey ?? null;

    return {
      id: ticket.id,
      reference: first?.reference ?? '',
      status: ticket.status,
      crewLabel: crew ? (crew.crewLabel ?? crew.name) : null,
      requestedByName: pending
        ? people.get(pending.requestedById)?.name
        : undefined,
      distanceMeters:
        pending?.distanceMeters ?? ticket.closureDistance ?? undefined,
      beforePhotoUrl: (await this.storage.urlFor(first?.photoKey)) ?? '',
      beforeAt: (first?.capturedAt ?? ticket.createdAt).toISOString(),
      afterPhotoUrl: await this.storage.urlFor(afterKey),
      afterAt:
        (ticket.closedAt ?? pending?.capturedAt)?.toISOString() ?? null,
      audit: ticket.events.map((event) => ({
        id: event.id,
        at: event.createdAt.toISOString(),
        kind: event.kind,
        actor: event.actorName,
        detail: event.detail ?? undefined,
      })),
    };
  }

  async assign(manager: SessionUser, ticketId: string, crewId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 'Ticket not found.', 404);
    }
    if (!['open', 'assigned'].includes(ticket.status)) {
      throw new ApiError(
        'INVALID_STATE',
        'This ticket can no longer be reassigned.',
        409,
      );
    }
    const crew = await this.prisma.account.findUnique({
      where: { id: crewId },
    });
    if (!crew || crew.role !== 'field_crew' || !crew.isActive) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 'Crew not found.', 404);
    }

    const firstTime = ticket.status === 'open';
    await this.prisma.$transaction([
      this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { crewId, status: 'assigned' },
      }),
      this.prisma.incident.update({
        where: { id: ticket.incidentId },
        data: { zone: crew.zone ?? 'Unassigned' },
      }),
      this.prisma.report.updateMany({
        where: { incidentId: ticket.incidentId },
        data: { status: 'assigned' },
      }),
      ...(firstTime
        ? [
            this.prisma.ticketEvent.create({
              data: {
                ticketId: ticket.id,
                kind: 'verified',
                actorName: manager.name,
              },
            }),
          ]
        : []),
      this.prisma.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          kind: 'assigned',
          actorName: manager.name,
          detail: crew.crewLabel ?? crew.name,
        },
      }),
    ]);
    return { status: 'assigned' };
  }

  async crews() {
    const rows = await this.prisma.account.findMany({
      where: { role: 'field_crew', isActive: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((account) => ({
      id: account.id,
      name: account.name,
      crewLabel: account.crewLabel ?? '',
      zone: account.zone ?? '',
    }));
  }
}
