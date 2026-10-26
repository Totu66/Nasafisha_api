import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { File } from 'multer';
import { CurrentUser, RequireRole } from '../access/access.decorators';
import { ROLES } from '../access/roles';
import type { SessionUser } from '../access/token.service';
import { PhotoUpload } from '../common/photo';
import { CreateReportDto } from './report.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@RequireRole(ROLES.CITIZEN)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @UseInterceptors(PhotoUpload)
  create(
    @CurrentUser() me: SessionUser,
    @Body() dto: CreateReportDto,
    @UploadedFile() photo?: File,
  ) {
    return this.reports.create(me, dto, photo);
  }

  @Get('mine')
  mine(@CurrentUser() me: SessionUser) {
    return this.reports.listMine(me.id);
  }

  @Get(':reference')
  one(@CurrentUser() me: SessionUser, @Param('reference') reference: string) {
    return this.reports.getOne(me.id, reference);
  }
}
