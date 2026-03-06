import {
  Controller,
  Get,
  Param,
  UseGuards,
  Query,
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
  @ApiOperation({ summary: 'Get payroll report' })
  getPayrollReport(
    @Param('branchId') branchId: string,
    @Param('month') month: number,
    @Param('year') year: number,
  ) {
    return this.reportsService.getPayrollReport(branchId, month, year);
  }
}
