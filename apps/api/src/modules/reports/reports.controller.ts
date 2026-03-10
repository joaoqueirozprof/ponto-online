import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('migrate-employee-punches')
  @RequirePermissions('admin.all')
  @ApiOperation({ summary: 'Migrar registros de ponto (one-time admin)' })
  migrateEmployeePunches() {
    return this.reportsService.migrateEmployeePunches();
  }

  @Get('employee/:employeeId/:month/:year')
  @RequirePermissions('reports.view')
  @ApiOperation({ summary: 'Relatório de ponto do funcionário' })
  getEmployeeReport(
    @Param('employeeId') employeeId: string,
    @Param('month') month: number,
    @Param('year') year: number,
  ) {
    return this.reportsService.getEmployeeReport(employeeId, month, year);
  }

  @Get('branch/:branchId/:month/:year')
  @RequirePermissions('reports.view')
  @ApiOperation({ summary: 'Relatório resumo da filial' })
  getBranchReport(
    @Param('branchId') branchId: string,
    @Param('month') month: number,
    @Param('year') year: number,
  ) {
    return this.reportsService.getBranchReport(branchId, month, year);
  }

  @Get('payroll/:branchId/:month/:year')
  @RequirePermissions('reports.view')
  @ApiOperation({ summary: 'Relatório de folha de pagamento com horas extras' })
  getPayrollReport(
    @Param('branchId') branchId: string,
    @Param('month') month: number,
    @Param('year') year: number,
  ) {
    return this.reportsService.getPayrollReport(branchId, month, year);
  }

  @Post('overtime-adjustment')
  @RequirePermissions('reports.edit')
  @ApiOperation({ summary: 'Salvar ajuste de horas extras' })
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
  @RequirePermissions('reports.view')
  @ApiOperation({ summary: 'Ajustes de horas extras do funcionário' })
  getOvertimeAdjustments(
    @Param('employeeId') employeeId: string,
    @Param('month') month: number,
    @Param('year') year: number,
  ) {
    return this.reportsService.getOvertimeAdjustments(employeeId, month, year);
  }

  @Delete('overtime-adjustment/:id')
  @RequirePermissions('reports.edit')
  @ApiOperation({ summary: 'Excluir ajuste de horas extras' })
  deleteOvertimeAdjustment(@Param('id') id: string) {
    return this.reportsService.deleteOvertimeAdjustment(id);
  }
}
