import type { PrismaService } from '../prisma/prisma.service';

export async function people(
  prisma: PrismaService,
  ids: Array<string | null | undefined>,
) {
  const clean = [...new Set(ids.filter((x): x is string => !!x))];
  const rows = clean.length ? await prisma.account.findMany({ where: { id: { in: clean } } }) : [];

  return new Map(rows.map((a) => [a.id, a]));
}
