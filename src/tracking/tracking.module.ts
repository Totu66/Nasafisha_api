import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReportsModule } from '../reports/reports.module';
import { TrackingController } from './tracking.controller';

@Module({
  imports: [NotificationsModule, ReportsModule],
  controllers: [TrackingController],
})
export class TrackingModule {}
