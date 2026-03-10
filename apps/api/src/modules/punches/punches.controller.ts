import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PunchesService } from './punches.service';

@ApiTags('Punches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('punches')
export class PunchesController {
  constructor(private readonly punchesService: PunchesService) {}

  @Get('raw')
  @RequirePermissions('punches.view')
  @ApiOperation({ summary: 'Buscar registros brutos de ponto' })
  getRawPunches(
    @Request() req: any,
    @Query('employeeId') employeeId?: string,
    @Query('deviceId') deviceId?: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 100,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.punchesService.getRawPunches(employeeId, deviceId, skip, take, search, startDate, endDate, req.tenantCompanyId);
  }

  @Get('normalized')
  @RequirePermissions('punches.view')
  @ApiOperation({ summary: 'Buscar registros normalizados de ponto' })
  getNormalizedPunches(
    @Request() req: any,
    @Query('employeeId') employeeId?: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 100,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.punchesService.getNormalizedPunches(employeeId, skip, take, search, startDate, endDate, req.tenantCompanyId);
  }

  @Post('manual')
  @RequirePermissions('punches.create')
  @ApiOperation({ summary: 'Criar registro manual de ponto' })
  createManualPunch(
    @Body() createManualPunchDto: any,
    @Request() req: any,
  ) {
    return this.punchesService.createManualPunch(createManualPunchDto, req.tenantCompanyId);
  }

  @Post(':id/adjust')
  @RequirePermissions('punches.edit')
  @ApiOperation({ summary: 'Ajustar registro de ponto' })
  adjustPunch(
    @Param('id') id: string,
    @Body() adjustPunchDto: any,
    @Request() req: any,
  ) {
    return this.punchesService.adjustPunch(id, adjustPunchDto);
  }

  @Post('fix-afd-source')
  @RequirePermissions('admin.all')
  @ApiOperation({ summary: 'Corrigir registros AFD importados' })
  fixAfdSource() {
    return this.punchesService.fixAfdSourceRecords();
  }

  @Get('adjustments')
  @RequirePermissions('punches.view')
  @ApiOperation({ summary: 'Histórico de ajustes de ponto' })
  getPunchAdjustments(
    @Request() req: any,
    @Query('employeeId') employeeId?: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 50,
  ) {
    return this.punchesService.getPunchAdjustments(employeeId, skip, take);
  }
}
