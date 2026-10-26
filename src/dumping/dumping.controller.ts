import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, RequireRole } from '../access/access.decorators';
import { ROLES } from '../access/roles';
import type { SessionUser } from '../access/token.service';
import { RemediationDto } from '../reports/report.dto';
import { DumpingService } from './dumping.service';

@Controller('admin/dumping-sites')
@RequireRole(ROLES.OPERATIONS_MANAGER)
export class DumpingController {
  constructor(private readonly dumping: DumpingService) {}

  @Get()
  list(
    @Query('zone') zone?: string,
    @Query('minReports') minReports?: string,
    @Query('hotspot') hotspot?: string,
  ) {
    return this.dumping.list(
      zone,
      minReports ? Number(minReports) : undefined,
      hotspot === 'true',
    );
  }

  @Get(':id')
  history(@Param('id') id: string) {
    return this.dumping.history(id);
  }

  @Post(':id/remediation')
  addRemediation(
    @CurrentUser() me: SessionUser,
    @Param('id') id: string,
    @Body() dto: RemediationDto,
  ) {
    return this.dumping.addRemediation(me, id, dto.note);
  }
}
