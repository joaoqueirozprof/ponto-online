import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { BranchesModule } from './modules/branches/branches.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { DevicesModule } from './modules/devices/devices.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { PunchesModule } from './modules/punches/punches.module';
import { TimesheetsModule } from './modules/timesheets/timesheets.module';
import { SyncModule } from './modules/sync/sync.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SeedModule } from './modules/seed/seed.module';
import { AutoSyncModule } from './modules/auto-sync/auto-sync.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRATION || '15m') as any,
      },
    }),
    // Core
    PrismaModule,
    HealthModule,
    AuthModule,
    AuditModule,
    // Business modules
    CompaniesModule,
    BranchesModule,
    EmployeesModule,
    DevicesModule,
    SchedulesModule,
    PunchesModule,
    TimesheetsModule,
    SyncModule,
    ReportsModule,
    SeedModule,
    AutoSyncModule,
  ],
})
export class AppModule {}
