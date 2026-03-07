import { Module } from '@nestjs/common';
import { SeedController } from './seed.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SeedController],
})
export class SeedModule {}
