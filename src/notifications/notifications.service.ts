import { Injectable, Logger } from '@nestjs/common';
import { SmsService } from '../access/sms.service';
import { PrismaService } from '../prisma/prisma.service';
import { Lang, renderSms, SmsKind } from './templates';
import { TrackingLinkService } from './tracking-link.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly links: TrackingLinkService,
  ) {}

  async status(report: { id: string; reference: string; citizenId: string }, kind: SmsKind) {
    const account = await this.prisma.account.findUnique({ where: { id: report.citizenId } });
    if (!account) return;

    const lang: Lang = account.language === 'sw' ? 'sw' : 'en';
    const link = await this.links.urlFor(report.id);
    const text = renderSms(kind, lang, { reference: report.reference, link });

    await this.prisma.inAppNotification.create({
      data: {
        citizenId: account.id,
        reference: report.reference,
        kind,
        message: text,
      },
    });

    if (!account.phone) return;

    try {
      await this.sms.send(account.phone, text);
      await this.prisma.smsLog.create({
        data: { reportId: report.id, kind, lang, status: 'sent' },
      });
    } catch (err) {
      await this.prisma.smsLog.create({
        data: {
          reportId: report.id,
          kind,
          lang,
          status: 'failed',
          error: String(err).slice(0, 200),
        },
      });
      this.logger.warn(`SMS failed for ${report.reference} (${kind}). The in-app copy was saved.`);
    }
  }

  async listMine(citizenId: string) {
    const rows = await this.prisma.inAppNotification.findMany({
      where: { citizenId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return rows.map((n) => ({
      id: n.id,
      kind: n.kind,
      reference: n.reference,
      message: n.message,
      read: n.readAt !== null,
      createdAt: n.createdAt,
    }));
  }

  async markRead(citizenId: string, id: string) {
    await this.prisma.inAppNotification.updateMany({
      where: { id, citizenId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async setLanguage(citizenId: string, language: Lang) {
    await this.prisma.account.update({
      where: { id: citizenId },
      data: { language },
    });
  }
}
