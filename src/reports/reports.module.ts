import { Module } from '@nestjs/common';
import { DumpingModule } from '../dumping/dumping.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { ClosureService } from './closure.service';
import { ReportNotifyService } from './report-notify.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import {
  AdminTicketsController,
  ClosureApprovalsController,
  TicketsController,
} from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [PrismaModule, StorageModule, DumpingModule, NotificationsModule],
  controllers: [
    ReportsController,
    TicketsController,
    ClosureApprovalsController,
    AdminTicketsController,
  ],
  providers: [
    ReportsService,
    TicketsService,
    ClosureService,
    ReportNotifyService,
  ],
  exports: [ReportsService, ClosureService, TicketsService],
})
export class ReportsModule {}
