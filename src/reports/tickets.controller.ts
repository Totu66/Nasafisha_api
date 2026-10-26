import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { ClosureService } from './closure.service';
import { AssignTicketDto, PhotoLocationDto } from './report.dto';
import { TicketsService } from './tickets.service';

@Controller('tickets')
@RequireRole(ROLES.FIELD_CREW)
export class TicketsController {
  constructor(
    private readonly tickets: TicketsService,
    private readonly closure: ClosureService,
  ) {}

  @Get('mine')
  mine(@CurrentUser() me: SessionUser) {
    return this.tickets.mine(me.id);
  }

  @Get(':id')
  one(@CurrentUser() me: SessionUser, @Param('id') id: string) {
    return this.tickets.one(me.id, id);
  }

  @Post(':id/start')
  @HttpCode(200)
  start(@CurrentUser() me: SessionUser, @Param('id') id: string) {
    return this.tickets.start(me, id);
  }

  @Post(':id/close')
  @HttpCode(200)
  @UseInterceptors(PhotoUpload)
  close(
    @CurrentUser() me: SessionUser,
    @Param('id') id: string,
    @Body() dto: PhotoLocationDto,
    @UploadedFile() photo?: File,
  ) {
    return this.closure.close(me, id, dto, photo);
  }

  @Post(':id/closure-approval-requests')
  @HttpCode(200)
  @UseInterceptors(PhotoUpload)
  requestApproval(
    @CurrentUser() me: SessionUser,
    @Param('id') id: string,
    @Body() dto: PhotoLocationDto,
    @UploadedFile() photo?: File,
  ) {
    return this.closure.requestApproval(me, id, dto, photo);
  }
}

@Controller('closure-approvals')
@RequireRole(ROLES.FIELD_SUPERVISOR)
export class ClosureApprovalsController {
  constructor(private readonly closure: ClosureService) {}

  @Get()
  list() {
    return this.closure.listPending();
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.closure.one(id);
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(@CurrentUser() me: SessionUser, @Param('id') id: string) {
    return this.closure.approve(me, id);
  }

  @Post(':id/send-back')
  @HttpCode(200)
  sendBack(@CurrentUser() me: SessionUser, @Param('id') id: string) {
    return this.closure.sendBack(me, id);
  }
}

@Controller('admin')
@RequireRole(ROLES.OPERATIONS_MANAGER)
export class AdminTicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get('tickets')
  list() {
    return this.tickets.adminList();
  }

  @Get('tickets/:id')
  one(@Param('id') id: string) {
    return this.tickets.adminDetail(id);
  }

  @Post('tickets/:id/assign')
  @HttpCode(200)
  assign(
    @CurrentUser() me: SessionUser,
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
  ) {
    return this.tickets.assign(me, id, dto.crewId);
  }

  @Get('crews')
  crews() {
    return this.tickets.crews();
  }
}
