import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AutoSyncController } from './auto-sync.controller';
import { AutoSyncService } from './auto-sync.service';
import { ControlIdService } from './control-id.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
  ],
  controllers: [AutoSyncController],
  providers: [AutoSyncService, ControlIdService],
  exports: [AutoSyncService, ControlIdService],
})
export class AutoSyncModule {}
