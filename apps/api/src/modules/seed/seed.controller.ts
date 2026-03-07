import { Controller, Post, Body } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Seed')
@Controller('seed')
export class SeedController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('execute-sql')
  @ApiOperation({ summary: 'Execute raw SQL for seeding (TEMPORARY)' })
  async executeSql(@Body() body: { sql: string }) {
    try {
      const statements = body.sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && s !== 'BEGIN' && s !== 'COMMIT');

      let success = 0;
      let errors = 0;
      const errorDetails: string[] = [];

      for (const stmt of statements) {
        try {
          await this.prisma.$executeRawUnsafe(stmt);
          success++;
        } catch (err: any) {
          errors++;
          if (errorDetails.length < 10) {
            errorDetails.push(`${stmt.substring(0, 80)}... => ${err.message?.substring(0, 100)}`);
          }
        }
      }

      return {
        message: 'Seed executed',
        totalStatements: statements.length,
        success,
        errors,
        errorDetails,
      };
    } catch (err: any) {
      return { error: err.message };
    }
  }

  @Post('bulk-insert')
  @ApiOperation({ summary: 'Bulk insert seed data (TEMPORARY)' })
  async bulkInsert(@Body() body: {
    rawPunchEvents?: any[];
    normalizedPunches?: any[];
    timesheets?: any[];
    timesheetDays?: any[];
  }) {
    const results: any = {};

    if (body.timesheets?.length) {
      let ok = 0, err = 0;
      for (const ts of body.timesheets) {
        try {
          await this.prisma.timesheet.create({ data: ts });
          ok++;
        } catch (e: any) {
          err++;
          if (err <= 3) results.tsError = e.message;
        }
      }
      results.timesheets = { ok, err };
    }

    if (body.timesheetDays?.length) {
      let ok = 0, err = 0;
      for (const td of body.timesheetDays) {
        try {
          await this.prisma.timesheetDay.create({ data: td });
          ok++;
        } catch (e: any) {
          err++;
          if (err <= 3) results.tdError = e.message;
        }
      }
      results.timesheetDays = { ok, err };
    }

    if (body.rawPunchEvents?.length) {
      let ok = 0, err = 0;
      for (const rp of body.rawPunchEvents) {
        try {
          await this.prisma.rawPunchEvent.create({ data: rp });
          ok++;
        } catch (e: any) {
          err++;
          if (err <= 3) results.rpError = e.message;
        }
      }
      results.rawPunchEvents = { ok, err };
    }

    if (body.normalizedPunches?.length) {
      let ok = 0, err = 0;
      for (const np of body.normalizedPunches) {
        try {
          await this.prisma.normalizedPunch.create({ data: np });
          ok++;
        } catch (e: any) {
          err++;
          if (err <= 3) results.npError = e.message;
        }
      }
      results.normalizedPunches = { ok, err };
    }

    return results;
  }
}
