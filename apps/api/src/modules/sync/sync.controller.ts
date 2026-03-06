import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SyncService } from './sync.service';

@ApiTags('Sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('punches/:deviceId')
  @ApiOperation({ summary: 'Receive punch records from device agent' })
  syncPunches(
    @Param('deviceId') deviceId: string,
    @Body('punches') punches: any[],
  ) {
    return this.syncService.syncPunches(deviceId, punches);
  }

  @Post('device-status/:deviceId')
  @ApiOperation({ summary: 'Receive device status update from agent' })
  recordDeviceStatus(
    @Param('deviceId') deviceId: string,
    @Body() status: any,
  ) {
    return this.syncService.recordDeviceStatus(deviceId, status);
  }

  @Get('employees/:branchId')
  @ApiOperation({ summary: 'Get employee list for device sync' })
  getEmployeesForSync(
    @Param('branchId') branchId: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 1000,
  ) {
    return this.syncService.getEmployeesForSync(branchId, skip, take);
  }

  @Post('employee-device-id/:employeeId')
  @ApiOperation({ summary: 'Update employee device ID mapping' })
  updateEmployeeDeviceId(
    @Param('employeeId') employeeId: string,
    @Body('deviceUserId') deviceUserId: string,
  ) {
    return this.syncService.updateEmployeeDeviceId(employeeId, deviceUserId);
  }
}
