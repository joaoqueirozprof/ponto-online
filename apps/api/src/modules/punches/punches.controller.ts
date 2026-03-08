import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PunchesService } from './punches.service';

@ApiTags('Punches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('punches')
export class PunchesController {
  constructor(private readonly punchesService: PunchesService) {}

  @Get('raw')
  @ApiOperation({ summary: 'Get raw punch events' })
  getRawPunches(
    @Query('employeeId') employeeId?: string,
    @Query('deviceId') deviceId?: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 100,
    @Query('search') search?: string,
  ) {
    return this.punchesService.getRawPunches(employeeId, deviceId, skip, take, search);
  }

  @Get('normalized')
  @ApiOperation({ summary: 'Get normalized punches' })
  getNormalizedPunches(
    @Query('employeeId') employeeId?: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 100,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.punchesService.getNormalizedPunches(employeeId, skip, take, search, startDate, endDate);
  }

  @Post('manual')
  @ApiOperation({ summary: 'Create a manual punch record' })
  createManualPunch(
    @Body() createManualPunchDto: any,
  ) {
    return this.punchesService.createManualPunch(createManualPunchDto);
  }

  @Post(':id/adjust')
  @ApiOperation({ summary: 'Adjust a punch record' })
  adjustPunch(
    @Param('id') id: string,
    @Body() adjustPunchDto: any,
  ) {
    return this.punchesService.adjustPunch(id, adjustPunchDto);
  }

  @Post('fix-afd-source')
  @ApiOperation({ summary: 'Fix AFD-imported records source from MANUAL to AFD and assign proper REP devices' })
  fixAfdSource() {
    return this.punchesService.fixAfdSourceRecords();
  }

  @Get('adjustments')
  @ApiOperation({ summary: 'Get punch adjustments history' })
  getPunchAdjustments(
    @Query('employeeId') employeeId?: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 50,
  ) {
    return this.punchesService.getPunchAdjustments(employeeId, skip, take);
  }
}
