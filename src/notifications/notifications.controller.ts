import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, RequireRole } from '../access/access.decorators';
import { ROLES } from '../access/roles';
import type { SessionUser } from '../access/token.service';
import { LanguageDto } from './notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller()
@RequireRole(ROLES.CITIZEN)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('notifications/mine')
  mine(@CurrentUser() me: SessionUser) {
    return this.notifications.listMine(me.id);
  }

  @Post('notifications/:id/read')
  @HttpCode(200)
  async read(@CurrentUser() me: SessionUser, @Param('id') id: string) {
    await this.notifications.markRead(me.id, id);
  }

  @Patch('me/language')
  async language(@CurrentUser() me: SessionUser, @Body() dto: LanguageDto) {
    await this.notifications.setLanguage(me.id, dto.language);
  }
}
