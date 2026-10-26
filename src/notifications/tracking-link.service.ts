import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ApiError, ERROR_CODES } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const CODE_LENGTH = 7;

@Injectable()
export class TrackingLinkService {
  constructor(private readonly prisma: PrismaService) {}

  private makeCode(): string {
    return Array.from(randomBytes(CODE_LENGTH), (b) => ALPHABET[b % ALPHABET.length]).join('');
  }

  async urlFor(reportId: string): Promise<string> {
    const base = process.env.SHORT_LINK_BASE ?? `${process.env.PUBLIC_APP_URL ?? 'https://nasafisha.go.ke'}/r`;
    const days = Number(process.env.TRACKING_LINK_DAYS ?? 30);
    const expiresAt = new Date(Date.now() + days * 86_400_000);

    const existing = await this.prisma.trackingLink.findUnique({ where: { reportId } });

    if (existing) {
      if (existing.expiresAt < new Date()) {
        await this.prisma.trackingLink.update({
          where: { reportId },
          data: { expiresAt },
        });
      }
      return `${base}/${existing.code}`;
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = this.makeCode();
      try {
        await this.prisma.trackingLink.create({
          data: { code, reportId, expiresAt },
        });
        return `${base}/${code}`;
      } catch (err) {
        if ((err as { code?: string }).code !== 'P2002') throw err;
      }
    }

    throw new ApiError(ERROR_CODES.INTERNAL_ERROR, 'Could not make a tracking link.', 500);
  }

  async resolve(code: string): Promise<{ citizenId: string; reference: string }> {
    const notFound = () => new ApiError(ERROR_CODES.NOT_FOUND, 'This link has expired or does not exist.', 404);

    const link = await this.prisma.trackingLink.findUnique({
      where: { code: code.toLowerCase() },
    });

    if (!link || link.expiresAt < new Date()) throw notFound();

    const report = await this.prisma.report.findUnique({ where: { id: link.reportId } });
    if (!report) throw notFound();

    return { citizenId: report.citizenId, reference: report.reference };
  }
}
