import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('Companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @RequirePermissions('admin.companies')
  @ApiOperation({ summary: 'Criar nova empresa (Super Admin)' })
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar empresas' })
  findAll(
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 10,
    @Query('search') search?: string,
    @Request() req?: any,
  ) {
    // Super admin sees all; company user sees only their company
    if (req?.user?.isSuperAdmin) {
      return this.companiesService.findAll(skip, take, search);
    }
    // Non-super-admin sees only their own company
    return this.companiesService.findOne(req?.user?.companyId);
  }

  @Get('stats')
  @RequirePermissions('admin.companies')
  @ApiOperation({ summary: 'Estatísticas da plataforma (Super Admin)' })
  getStats() {
    return this.companiesService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes da empresa' })
  findOne(@Param('id') id: string, @Request() req: any) {
    const restrict = req.user.isSuperAdmin ? undefined : req.user.companyId;
    return this.companiesService.findOne(id, restrict);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar empresa' })
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto, @Request() req: any) {
    const restrict = req.user.isSuperAdmin ? undefined : req.user.companyId;
    return this.companiesService.update(id, dto, restrict);
  }

  @Delete(':id')
  @RequirePermissions('admin.companies')
  @ApiOperation({ summary: 'Desativar empresa (Super Admin)' })
  remove(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }

  @Post(':id/reactivate')
  @RequirePermissions('admin.companies')
  @ApiOperation({ summary: 'Reativar empresa (Super Admin)' })
  reactivate(@Param('id') id: string) {
    return this.companiesService.reactivate(id);
  }
}
