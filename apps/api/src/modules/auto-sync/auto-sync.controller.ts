import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  Body,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AutoSyncService } from './auto-sync.service';
import { ControlIdService } from './control-id.service';

@ApiTags('Auto Sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('auto-sync')
export class AutoSyncController {
  constructor(
    private readonly autoSyncService: AutoSyncService,
    private readonly controlIdService: ControlIdService,
  ) {}

  @Get('status')
  @RequirePermissions('devices.view')
  @ApiOperation({ summary: 'Status atual da sincronização' })
  getSyncStatus() {
    return this.autoSyncService.getSyncStatus();
  }

  @Post('sync-all')
  @RequirePermissions('devices.edit')
  @ApiOperation({ summary: 'Sincronizar todos os dispositivos ativos' })
  syncAllDevices() {
    return this.autoSyncService.syncAllDevices();
  }

  @Post('sync-device/:deviceId')
  @RequirePermissions('devices.edit')
  @ApiOperation({ summary: 'Sincronizar dispositivo específico' })
  syncDevice(@Param('deviceId') deviceId: string) {
    return this.autoSyncService.syncDevice(deviceId);
  }

  @Post('sync-employees')
  @RequirePermissions('employees.edit')
  @ApiOperation({ summary: 'Sincronizar funcionários com todos os dispositivos' })
  syncAllEmployees() {
    return this.autoSyncService.syncAllEmployees();
  }

  @Post('sync-employees/:deviceId')
  @RequirePermissions('employees.edit')
  @ApiOperation({ summary: 'Sincronizar funcionários de um dispositivo' })
  syncEmployeesForDevice(@Param('deviceId') deviceId: string) {
    return this.autoSyncService.syncEmployeesForDevice(deviceId);
  }

  @Post('recalculate-current')
  @RequirePermissions('timesheets.edit')
  @ApiOperation({ summary: 'Recalcular folhas do mês atual' })
  recalculateCurrentMonth() {
    return this.autoSyncService.recalculateCurrentMonth();
  }

  @Post('recalculate-month')
  @RequirePermissions('timesheets.edit')
  @ApiOperation({ summary: 'Recalcular folhas de um mês específico' })
  recalculateMonth(@Body() body: { month: number; year: number }) {
    return this.autoSyncService.recalculateMonth(body.month, body.year);
  }

  @Post('device/:deviceId/ping')
  @RequirePermissions('devices.view')
  @ApiOperation({ summary: 'Verificar se dispositivo está acessível' })
  async pingDevice(@Param('deviceId') deviceId: string) {
    const reachable = await this.controlIdService.pingDevice(deviceId);
    return { deviceId, reachable };
  }

  @Get('device/:deviceId/info')
  @RequirePermissions('devices.view')
  @ApiOperation({ summary: 'Informações do dispositivo Control ID' })
  getDeviceInfo(@Param('deviceId') deviceId: string) {
    return this.controlIdService.getDeviceInfo(deviceId);
  }

  @Get('device/:deviceId/users')
  @RequirePermissions('devices.view')
  @ApiOperation({ summary: 'Usuários cadastrados no dispositivo' })
  getDeviceUsers(@Param('deviceId') deviceId: string) {
    return this.controlIdService.loadUsers(deviceId);
  }

  @Post('device/:deviceId/create-user')
  @RequirePermissions('devices.edit')
  @ApiOperation({ summary: 'Criar usuário no dispositivo Control ID' })
  createDeviceUser(
    @Param('deviceId') deviceId: string,
    @Body() body: { registration: string; name: string; password?: string },
  ) {
    return this.controlIdService.createUsers(deviceId, [body]);
  }

  @Post('device/:deviceId/probe')
  @RequirePermissions('admin.all')
  @ApiOperation({ summary: 'Probe de debug no dispositivo' })
  async probeDevice(
    @Param('deviceId') deviceId: string,
    @Body() body: { endpoint: string; payload?: any },
  ) {
    return this.controlIdService.probeEndpoint(deviceId, body.endpoint, body.payload);
  }

  @Get('device/:deviceId/afd')
  @RequirePermissions('devices.view')
  @ApiOperation({ summary: 'AFD bruto do dispositivo Control ID' })
  async getDeviceAfd(@Param('deviceId') deviceId: string) {
    const afd = await this.controlIdService.exportAfd(deviceId);
    const records = this.controlIdService.parseAfdRecords(afd);
    return {
      totalLines: afd.split('\n').length,
      punchRecords: records.length,
      firstRecord: records[0] || null,
      lastRecord: records[records.length - 1] || null,
    };
  }
}
