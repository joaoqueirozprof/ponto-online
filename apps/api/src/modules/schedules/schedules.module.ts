import { Module } from '@nestjs/common';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';
import { HolidaysController } from './holidays.controller';
import { HolidaysService } from './holidays.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SchedulesController, HolidaysController],
  providers: [SchedulesService, HolidaysService],
  exports: [SchedulesService, HolidaysService],
})
export class SchedulesModule {}
