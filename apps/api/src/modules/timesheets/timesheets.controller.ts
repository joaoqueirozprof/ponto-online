import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  UseGuards,
  Query,
  Body,
  Req,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { TimesheetsService } from './timesheets.service';

@ApiTags('Timesheets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('timesheets')
export class TimesheetsController {
  constructor(private readonly timesheetsService: TimesheetsService) {}

  @Get('build-version')
  @ApiOperation({ summary: 'Versão do build' })
  getBuildVersion() {
    return { version: 'build-80-multitenant', timestamp: new Date().toISOString() };
  }

  @Get()
  @RequirePermissions('timesheets.view')
  @ApiOperation({ summary: 'Listar folhas de ponto' })
  listTimesheets(
    @Request() req: any,
    @Query('branchId') branchId?: string,
    @Query('month') month?: number,
    @Query('year') year?: number,
    @Query('status') status?: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 10,
    @Query('search') search?: string,
  ) {
    return this.timesheetsService.listTimesheets(branchId, skip, take, search, month, year, status, req.tenantCompanyId);
  }

  @Get(':employeeId/:month/:year')
  @RequirePermissions('timesheets.view')
  @ApiOperation({ summary: 'Buscar folha de ponto do funcionário' })
  getTimesheet(
    @Param('employeeId') employeeId: string,
    @Param('month') month: number,
    @Param('year') year: number,
  ) {
    return this.timesheetsService.getTimesheet(employeeId, month, year);
  }

  @Post('calculate/:employeeId/:month/:year')
  @RequirePermissions('timesheets.edit')
  @ApiOperation({ summary: 'Calcular folha de ponto do funcionário' })
  calculateTimesheet(
    @Param('employeeId') employeeId: string,
    @Param('month') month: number,
    @Param('year') year: number,
  ) {
    return this.timesheetsService.calculateTimesheet(employeeId, month, year);
  }

  @Post('calculate-batch')
  @RequirePermissions('timesheets.edit')
  @ApiOperation({ summary: 'Calcular folhas de ponto em lote' })
  calculateBatch(
    @Body('month') month: number,
    @Body('year') year: number,
    @Body('branchId') branchId?: string,
  ) {
    return this.timesheetsService.calculateBatch(month, year, branchId);
  }

  @Patch(':id/status')
  @RequirePermissions('timesheets.edit')
  @ApiOperation({ summary: 'Atualizar status da folha de ponto' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.timesheetsService.updateTimesheetStatus(id, status);
  }

  @Post('batch-approve')
  @RequirePermissions('timesheets.approve')
  @ApiOperation({ summary: 'Aprovar múltiplas folhas de ponto' })
  batchApprove(
    @Body('ids') ids: string[],
    @Req() req: any,
  ) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id || null;
    return this.timesheetsService.batchApproveTimesheets(ids, userId);
  }

  @Patch(':id/approve')
  @RequirePermissions('timesheets.approve')
  @ApiOperation({ summary: 'Aprovar folha de ponto' })
  approve(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id || null;
    return this.timesheetsService.approveTimesheet(id, userId);
  }

  @Get(':employeeId/balance/:month/:year')
  @RequirePermissions('timesheets.view')
  @ApiOperation({ summary: 'Saldo de horas do funcionário' })
  getTimeBalance(
    @Param('employeeId') employeeId: string,
    @Param('month') month: number,
    @Param('year') year: number,
  ) {
    return this.timesheetsService.getTimeBalance(employeeId, month, year);
  }
}
