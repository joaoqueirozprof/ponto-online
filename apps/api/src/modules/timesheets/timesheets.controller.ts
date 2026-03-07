import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Query,
  Body,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TimesheetsService } from './timesheets.service';

@ApiTags('Timesheets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('timesheets')
export class TimesheetsController {
  constructor(private readonly timesheetsService: TimesheetsService) {}

  @Get()
  @ApiOperation({ summary: 'List timesheets' })
  listTimesheets(
    @Query('branchId') branchId?: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 10,
  ) {
    return this.timesheetsService.listTimesheets(branchId, skip, take);
  }

  @Get(':employeeId/:month/:year')
  @ApiOperation({ summary: 'Get timesheet for employee and period' })
  getTimesheet(
    @Param('employeeId') employeeId: string,
    @Param('month') month: number,
    @Param('year') year: number,
  ) {
    return this.timesheetsService.getTimesheet(employeeId, month, year);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update timesheet status' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.timesheetsService.updateTimesheetStatus(id, status);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve timesheet' })
  approve(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id || null;
    return this.timesheetsService.approveTimesheet(id, userId);
  }

  @Get(':employeeId/balance/:month/:year')
  @ApiOperation({ summary: 'Get time balance for employee' })
  getTimeBalance(
    @Param('employeeId') employeeId: string,
    @Param('month') month: number,
    @Param('year') year: number,
  ) {
    return this.timesheetsService.getTimeBalance(employeeId, month, year);
  }
}
