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
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @RequirePermissions('employees.create')
  @ApiOperation({ summary: 'Criar novo funcionário' })
  create(@Body() createEmployeeDto: CreateEmployeeDto, @Request() req: any) {
    return this.employeesService.create(createEmployeeDto, req.tenantCompanyId);
  }

  @Get()
  @RequirePermissions('employees.view')
  @ApiOperation({ summary: 'Listar funcionários com filtros e paginação' })
  findAll(
    @Request() req: any,
    @Query('branchId') branchId?: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 10,
    @Query('isActive') isActive?: boolean,
    @Query('search') search?: string,
  ) {
    return this.employeesService.findAll(req.tenantCompanyId, branchId, skip, take, isActive, search);
  }

  @Get(':id')
  @RequirePermissions('employees.view')
  @ApiOperation({ summary: 'Buscar funcionário por ID' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.employeesService.findOne(id, req.tenantCompanyId);
  }

  @Patch(':id')
  @RequirePermissions('employees.edit')
  @ApiOperation({ summary: 'Atualizar funcionário' })
  update(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @Request() req: any,
  ) {
    return this.employeesService.update(id, updateEmployeeDto, req.tenantCompanyId);
  }

  @Delete(':id')
  @RequirePermissions('employees.delete')
  @ApiOperation({ summary: 'Excluir funcionário' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.employeesService.remove(id, req.tenantCompanyId);
  }
}
