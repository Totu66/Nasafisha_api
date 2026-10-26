import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DeviationService } from './deviation.service';
import {
  AlertsController,
  FleetController,
  PositionsController,
  SupervisorFleetController,
} from './fleet.controller';
import { FleetService } from './fleet.service';
import { PositionsService } from './positions.service';
import { RouteAuditService } from './route-audit.service';
import { StaleService } from './stale.service';

@Module({
  imports: [PrismaModule],
  controllers: [PositionsController, FleetController, AlertsController, SupervisorFleetController],
  providers: [PositionsService, DeviationService, StaleService, RouteAuditService, FleetService],
  exports: [FleetService],
})
export class FleetModule {}
