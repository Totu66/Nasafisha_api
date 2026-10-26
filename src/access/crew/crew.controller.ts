import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { CrewLoginDto, ResetPinDto } from '../access.dto';
import { CurrentUser, RequireRole } from '../access.decorators';
import { ROLES } from '../roles';
import type { SessionUser } from '../token.service';
import { CrewService } from './crew.service';

@Controller('auth/crew')
export class CrewController {
  constructor(private readonly crew: CrewService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: CrewLoginDto) {
    return this.crew.login(dto.employeeId, dto.pin, dto.deviceId);
  }
}

@Controller('supervisor/crew-accounts')
@RequireRole(ROLES.FIELD_SUPERVISOR)
export class SupervisorController {
  constructor(private readonly crew: CrewService) {}

  @Get()
  list() {
    return this.crew.listCrewAccounts();
  }

  @Post(':id/pin')
  @HttpCode(200)
  async resetPin(
    @Param('id') id: string,
    @Body() dto: ResetPinDto,
    @CurrentUser() me: SessionUser,
  ) {
    await this.crew.resetPin(me.id, id, dto.pin);
  }
}
