import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { AccessModule } from './access/access.module';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { BookmarkModule } from './bookmark/bookmark.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FleetModule } from './fleet/fleet.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { SupabaseModule } from './supabase/supabase.module';
import { SyncModule } from './sync/sync.module';
import { TestModule } from './test/test.module';
import { TrackingModule } from './tracking/tracking.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UserModule,
    BookmarkModule,
    PrismaModule,
    TestModule,
    SupabaseModule,
    AccessModule,
    ReportsModule,
    AdminAuthModule,
    FleetModule,
    DashboardModule,
    SyncModule,
    NotificationsModule,
    TrackingModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
