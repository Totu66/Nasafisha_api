import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser, RequireRole } from '../access/access.decorators';
import { ROLES } from '../access/roles';
import type { SessionUser } from '../access/token.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './admin-auth.dto';

@Controller()
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('auth/admin/login')
  @HttpCode(200)
  login(@Body() dto: AdminLoginDto) {
    return this.auth.login(dto.email, dto.password, dto.deviceId);
  }

  @Get('auth/me')
  @RequireRole(
    ROLES.CITIZEN,
    ROLES.FIELD_CREW,
    ROLES.FIELD_SUPERVISOR,
    ROLES.OPERATIONS_MANAGER,
    ROLES.EXECUTIVE,
    ROLES.COUNTY_ICT_ADMIN,
  )
  me(@CurrentUser() user: SessionUser) {
    return user;
  }

  @Post('admin/accounts/:id/unlock')
  @HttpCode(200)
  @RequireRole(ROLES.COUNTY_ICT_ADMIN)
  async unlock(@CurrentUser() me: SessionUser, @Param('id') id: string) {
    await this.auth.unlock(me.id, id);
  }
}
