import { Controller, Get, Param, Query } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('week')
  async week(@Query('from') from?: string, @Query('to') to?: string, @Query('zone') zone?: string) {
    const start = from ? new Date(from) : new Date();
    const end = to ? new Date(to) : new Date();
    return this.metrics.week(start, end, zone);
  }

  @Get('score')
  async score(
    @Query('collectionRate') collectionRate?: string,
    @Query('avgResolutionHours') avgResolutionHours?: string,
    @Query('routeAdherence') routeAdherence?: string,
  ) {
    return this.metrics.score({
      collectionRate: Number(collectionRate ?? 0),
      avgResolutionHours: Number(avgResolutionHours ?? 0),
      routeAdherence: Number(routeAdherence ?? 0),
    });
  }

  @Get('efficiency/:zone')
  async efficiency(@Param('zone') zone: string) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const result = await this.metrics.week(weekStart, now, zone);
    return {
      zone,
      score: this.metrics.score(result),
      ...result,
    };
  }
}
