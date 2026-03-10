import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { HolidaysService } from './holidays.service';

@ApiTags('Holidays')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Post()
  @RequirePermissions('schedules.create')
  @ApiOperation({ summary: 'Criar feriado' })
  create(@Body() createHolidayDto: any) {
    return this.holidaysService.create(createHolidayDto);
  }

  @Post('seed-national')
  @RequirePermissions('schedules.create')
  @ApiOperation({ summary: 'Importar feriados nacionais brasileiros' })
  seedNational(@Body('year') year: number) {
    return this.holidaysService.seedNationalHolidays(year || new Date().getFullYear());
  }

  @Get()
  @RequirePermissions('schedules.view')
  @ApiOperation({ summary: 'Listar feriados' })
  findAll(
    @Query('branchId') branchId?: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 50,
    @Query('search') search?: string,
    @Query('year') year?: number,
  ) {
    return this.holidaysService.findAll(branchId, skip, take, search, year);
  }

  @Get(':id')
  @RequirePermissions('schedules.view')
  @ApiOperation({ summary: 'Buscar feriado por ID' })
  findOne(@Param('id') id: string) {
    return this.holidaysService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('schedules.edit')
  @ApiOperation({ summary: 'Atualizar feriado' })
  update(@Param('id') id: string, @Body() updateHolidayDto: any) {
    return this.holidaysService.update(id, updateHolidayDto);
  }

  @Delete(':id')
  @RequirePermissions('schedules.delete')
  @ApiOperation({ summary: 'Excluir feriado' })
  remove(@Param('id') id: string) {
    return this.holidaysService.remove(id);
  }
}
