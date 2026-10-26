import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessGuard } from './access.guard';
import { AuditService } from './audit.service';
import { CitizenController } from './citizen/citizen.controller';
import { CitizenService } from './citizen/citizen.service';
import {
  CrewController,
  SupervisorController,
} from './crew/crew.controller';
import { CrewService } from './crew/crew.service';
import { SmsService } from './sms.service';
import { TokenService } from './token.service';

@Global()
@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [
    CitizenController,
    CrewController,
    SupervisorController,
  ],
  providers: [
    TokenService,
    AuditService,
    SmsService,
    CitizenService,
    CrewService,
    AccessGuard,
  ],
  exports: [TokenService, AuditService, SmsService, AccessGuard],
})
export class AccessModule {}
