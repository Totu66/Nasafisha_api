import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, RequireRole } from '../access/access.decorators';
import { ROLES } from '../access/roles';
import type { SessionUser } from '../access/token.service';
import { DeviationService } from './deviation.service';
import { AssignVehicleDto, CreateRouteDto, CreateVehicleDto } from './fleet.dto';
import { FleetService } from './fleet.service';
import { PositionsService } from './positions.service';
import { TrackerKeyGuard } from './tracker.guard';

@Controller('fleet/positions')
@UseGuards(TrackerKeyGuard)
export class PositionsController {
  constructor(private readonly positions: PositionsService) {}

  @Post()
  @HttpCode(200)
  ingest(@Body() body: unknown) {
    return this.positions.ingest(body);
  }
}

@Controller('admin')
@RequireRole(ROLES.OPERATIONS_MANAGER)
export class FleetController {
  constructor(private readonly fleet: FleetService) {}

  @Get('fleet')
  live() {
    return this.fleet.live();
  }

  @Get('fleet/:vehicleId/audit')
  audit(@Param('vehicleId') vehicleId: string) {
    return this.fleet.auditView(vehicleId);
  }

  @Post('fleet/:vehicleId/ack-stale')
  @HttpCode(200)
  @RequireRole(ROLES.OPERATIONS_MANAGER, ROLES.FIELD_SUPERVISOR)
  async ackStale(@CurrentUser() me: SessionUser, @Param('vehicleId') vehicleId: string) {
    await this.fleet.ackStale(me, vehicleId);
  }

  @Post('vehicles')
  createVehicle(@Body() dto: CreateVehicleDto) {
    return this.fleet.createVehicle(dto);
  }

  @Post('vehicles/:id/assign')
  @HttpCode(200)
  async assign(@Param('id') id: string, @Body() dto: AssignVehicleDto) {
    await this.fleet.assignCrew(id, dto.crewId);
  }

  @Post('routes')
  createRoute(@Body() dto: CreateRouteDto) {
    return this.fleet.createRoute(dto);
  }
}

@Controller('deviation-alerts')
@RequireRole(ROLES.FIELD_SUPERVISOR, ROLES.OPERATIONS_MANAGER)
export class AlertsController {
  constructor(private readonly deviation: DeviationService) {}

  @Get()
  list() {
    return this.deviation.listOpen();
  }

  @Post(':id/authorise')
  @HttpCode(200)
  async authorise(@CurrentUser() me: SessionUser, @Param('id') id: string) {
    await this.deviation.authorise(me, id);
  }
}

@Controller('supervisor/crews')
@RequireRole(ROLES.FIELD_SUPERVISOR)
export class SupervisorFleetController {
  constructor(private readonly fleet: FleetService) {}

  @Get()
  crews() {
    return this.fleet.crewStatus();
  }
}
