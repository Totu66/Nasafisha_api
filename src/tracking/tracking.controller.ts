import { Controller, Get, Param } from '@nestjs/common';
import { ReportsService } from '../reports/reports.service';
import { TrackingLinkService } from '../notifications/tracking-link.service';

@Controller('track')
export class TrackingController {
  constructor(
    private readonly links: TrackingLinkService,
    private readonly reports: ReportsService,
  ) {}

  @Get(':code')
  async open(@Param('code') code: string) {
    const { citizenId, reference } = await this.links.resolve(code);
    return this.reports.getOne(citizenId, reference);
  }
}
