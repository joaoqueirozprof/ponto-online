import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AutoSyncService } from './auto-sync.service';
import { ControlIdService } from './control-id.service';

@ApiTags('Auto Sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('auto-sync')
export class AutoSyncController {
  constructor(
    private readonly autoSyncService: AutoSyncService,
    private readonly controlIdService: ControlIdService,
  ) {}

  // ========== SYNC STATUS ==========

  @Get('status')
  @ApiOperation({ summary: 'Get current sync status and last results' })
  getSyncStatus() {
    return this.autoSyncService.getSyncStatus();
  }

  // ========== PUNCH SYNC ==========

  @Post('sync-all')
  @ApiOperation({ summary: 'Manually trigger sync from all active devices' })
  syncAllDevices() {
    return this.autoSyncService.syncAllDevices();
  }

  @Post('sync-device/:deviceId')
  @ApiOperation({ summary: 'Manually trigger sync from a specific device' })
  syncDevice(@Param('deviceId') deviceId: string) {
    return this.autoSyncService.syncDevice(deviceId);
  }

  // ========== EMPLOYEE SYNC ==========

  @Post('sync-employees')
  @ApiOperation({ summary: 'Sync employees bidirectionally with all devices' })
  syncAllEmployees() {
    return this.autoSyncService.syncAllEmployees();
  }

  @Post('sync-employees/:deviceId')
  @ApiOperation({ summary: 'Sync employees for a specific device' })
  syncEmployeesForDevice(@Param('deviceId') deviceId: string) {
    return this.autoSyncService.syncEmployeesForDevice(deviceId);
  }

  // ========== RECALCULATION ==========

  @Post('recalculate-current')
  @ApiOperation({ summary: 'Recalculate all timesheets for current month' })
  recalculateCurrentMonth() {
    return this.autoSyncService.recalculateCurrentMonth();
  }

  @Post('recalculate-month')
  @ApiOperation({ summary: 'Recalculate all timesheets for a specific month/year' })
  recalculateMonth(@Body() body: { month: number; year: number }) {
    return this.autoSyncService.recalculateMonth(body.month, body.year);
  }

  // ========== DEVICE COMMUNICATION ==========

  @Post('device/:deviceId/ping')
  @ApiOperation({ summary: 'Check if device is reachable' })
  async pingDevice(@Param('deviceId') deviceId: string) {
    const reachable = await this.controlIdService.pingDevice(deviceId);
    return { deviceId, reachable };
  }

  @Get('device/:deviceId/info')
  @ApiOperation({ summary: 'Get device information from Control ID' })
  getDeviceInfo(@Param('deviceId') deviceId: string) {
    return this.controlIdService.getDeviceInfo(deviceId);
  }

  @Get('device/:deviceId/users')
  @ApiOperation({ summary: 'List users registered on the Control ID device' })
  getDeviceUsers(@Param('deviceId') deviceId: string) {
    return this.controlIdService.loadUsers(deviceId);
  }

  @Post('device/:deviceId/create-user')
  @ApiOperation({ summary: 'Create a user on the Control ID device' })
  createDeviceUser(
    @Param('deviceId') deviceId: string,
    @Body() body: { registration: string; name: string; password?: string },
  ) {
    return this.controlIdService.createUsers(deviceId, [body]);
  }

  @Post('device/:deviceId/probe')
  @ApiOperation({ summary: 'Probe device with arbitrary endpoint (debugging)' })
  async probeDevice(
    @Param('deviceId') deviceId: string,
    @Body() body: { endpoint: string; payload?: any },
  ) {
    return this.controlIdService.probeEndpoint(deviceId, body.endpoint, body.payload);
  }

  @Get('device/:deviceId/afd')
  @ApiOperation({ summary: 'Get raw AFD from Control ID device' })
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
