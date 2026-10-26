import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DumpingController } from './dumping.controller';
import { DumpingService } from './dumping.service';

@Module({
  imports: [PrismaModule],
  controllers: [DumpingController],
  providers: [DumpingService],
  exports: [DumpingService],
})
export class DumpingModule {}
