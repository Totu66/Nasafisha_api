import type { PrismaService } from '../prisma/prisma.service';

export const WITH_FIRST_REPORT = {
  incident: {
    include: {
      reports: {
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  },
} as const;

export interface TicketRow {
  id: string;
  incidentId: string;
  crewId: string | null;
  status: string;
  createdAt: Date;
  incident: {
    issueType: string;
    lat: number;
    lng: number;
    zone: string;
    reports: {
      reference: string;
      note: string | null;
      photoKey: string;
      capturedAt: Date;
    }[];
  };
}

export async function accountMap(
  prisma: PrismaService,
  ids: Array<string | null | undefined>,
) {
  const clean = [...new Set(ids.filter((id): id is string => !!id))];
  const rows = clean.length
    ? await prisma.account.findMany({ where: { id: { in: clean } } })
    : [];
  return new Map(rows.map((account) => [account.id, account]));
}
