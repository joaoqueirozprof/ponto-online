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
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';

@ApiTags('Devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @RequirePermissions('devices.create')
  @ApiOperation({ summary: 'Cadastrar novo dispositivo REP' })
  create(@Body() createDeviceDto: CreateDeviceDto, @Request() req: any) {
    return this.devicesService.create(createDeviceDto, req.tenantCompanyId);
  }

  @Get()
  @RequirePermissions('devices.view')
  @ApiOperation({ summary: 'Listar dispositivos' })
  findAll(
    @Request() req: any,
    @Query('branchId') branchId?: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 10,
    @Query('search') search?: string,
  ) {
    return this.devicesService.findAll(branchId, skip, take, search, req.tenantCompanyId);
  }

  @Get(':id')
  @RequirePermissions('devices.view')
  @ApiOperation({ summary: 'Buscar dispositivo por ID' })
  findOne(@Param('id') id: string) {
    return this.devicesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('devices.edit')
  @ApiOperation({ summary: 'Atualizar dispositivo' })
  update(@Param('id') id: string, @Body() updateDeviceDto: any) {
    return this.devicesService.update(id, updateDeviceDto);
  }

  @Delete(':id')
  @RequirePermissions('devices.delete')
  @ApiOperation({ summary: 'Excluir dispositivo' })
  remove(@Param('id') id: string) {
    return this.devicesService.remove(id);
  }
}
