import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('migrate-employee-punches')
  @ApiOperation({ summary: 'Migrate punches from old employee IDs to new ones (one-time)' })
  migrateEmployeePunches() {
    return this.reportsService.migrateEmployeePunches();
  }

  @Get('employee/:employeeId/:month/:year')
  @ApiOperation({ summary: 'Get employee timesheet report' })
  getEmployeeReport(
    @Param('employeeId') employeeId: string,
    @Param('month') month: number,
    @Param('year') year: number,
  ) {
    return this.reportsService.getEmployeeReport(employeeId, month, year);
  }

  @Get('branch/:branchId/:month/:year')
  @ApiOperation({ summary: 'Get branch summary report' })
  getBranchReport(
    @Param('branchId') branchId: string,
    @Param('month') month: number,
    @Param('year') year: number,
  ) {
    return this.reportsService.getBranchReport(branchId, month, year);
  }

  @Get('payroll/:branchId/:month/:year')
  @ApiOperation({ summary: 'Get payroll report with overtime calculations' })
  getPayrollReport(
    @Param('branchId') branchId: string,
    @Param('month') month: number,
    @Param('year') year: number,
  ) {
    return this.reportsService.getPayrollReport(branchId, month, year);
  }

  @Post('overtime-adjustment')
  @ApiOperation({ summary: 'Save an HR overtime adjustment with reason' })
  saveOvertimeAdjustment(
    @Body() body: {
      employeeId: string;
      month: number;
      year: number;
      field: string;
      originalMinutes: number;
      adjustedMinutes: number;
      reason: string;
      adjustedBy?: string;
    },
  ) {
    return this.reportsService.saveOvertimeAdjustment(body);
  }

  @Get('overtime-adjustments/:employeeId/:month/:year')
  @ApiOperation({ summary: 'Get all HR adjustments for an employee in a month' })
  getOvertimeAdjustments(
    @Param('employeeId') employeeId: string,
    @Param('month') month: number,
    @Param('year') year: number,
  ) {
    return this.reportsService.getOvertimeAdjustments(employeeId, month, year);
  }

  @Delete('overtime-adjustment/:id')
  @ApiOperation({ summary: 'Delete an HR overtime adjustment' })
  deleteOvertimeAdjustment(@Param('id') id: string) {
    return this.reportsService.deleteOvertimeAdjustment(id);
  }
}
