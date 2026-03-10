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
import { SchedulesService } from './schedules.service';

@ApiTags('Schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post()
  @RequirePermissions('schedules.create')
  @ApiOperation({ summary: 'Criar nova escala de trabalho' })
  create(@Body() createScheduleDto: any, @Request() req: any) {
    return this.schedulesService.create(createScheduleDto, req.tenantCompanyId);
  }

  @Get()
  @RequirePermissions('schedules.view')
  @ApiOperation({ summary: 'Listar escalas de trabalho' })
  findAll(
    @Request() req: any,
    @Query('branchId') branchId?: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 10,
    @Query('search') search?: string,
  ) {
    return this.schedulesService.findAll(branchId, skip, take, search, req.tenantCompanyId);
  }

  @Get(':id')
  @RequirePermissions('schedules.view')
  @ApiOperation({ summary: 'Buscar escala por ID' })
  findOne(@Param('id') id: string) {
    return this.schedulesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('schedules.edit')
  @ApiOperation({ summary: 'Atualizar escala' })
  update(@Param('id') id: string, @Body() updateScheduleDto: any) {
    return this.schedulesService.update(id, updateScheduleDto);
  }

  @Delete(':id')
  @RequirePermissions('schedules.delete')
  @ApiOperation({ summary: 'Excluir escala' })
  remove(@Param('id') id: string) {
    return this.schedulesService.remove(id);
  }
}
