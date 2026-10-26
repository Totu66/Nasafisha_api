import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { TrackingLinkService } from './tracking-link.service';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, TrackingLinkService],
  exports: [NotificationsService, TrackingLinkService],
})
export class NotificationsModule {}
