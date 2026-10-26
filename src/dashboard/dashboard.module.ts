import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DashboardController } from './dashboard.controller';
import { MetricsService } from './metrics.service';

@Module({
  imports: [PrismaModule],
  controllers: [DashboardController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class DashboardModule {}
