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
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@ApiTags('Branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @RequirePermissions('company.edit')
  @ApiOperation({ summary: 'Criar nova filial' })
  create(@Body() createBranchDto: CreateBranchDto, @Request() req: any) {
    return this.branchesService.create(createBranchDto, req.tenantCompanyId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar filiais' })
  findAll(
    @Request() req: any,
    @Query('companyId') companyId?: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 10,
    @Query('search') search?: string,
  ) {
    // Use tenant companyId unless super admin specifies one
    const effectiveCompanyId = req.isSupportAccess ? (companyId || undefined) : req.tenantCompanyId;
    return this.branchesService.findAll(effectiveCompanyId, skip, take, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar filial por ID' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.branchesService.findOne(id, req.tenantCompanyId);
  }

  @Patch(':id')
  @RequirePermissions('company.edit')
  @ApiOperation({ summary: 'Atualizar filial' })
  update(
    @Param('id') id: string,
    @Body() updateBranchDto: UpdateBranchDto,
    @Request() req: any,
  ) {
    return this.branchesService.update(id, updateBranchDto, req.tenantCompanyId);
  }

  @Delete(':id')
  @RequirePermissions('company.edit')
  @ApiOperation({ summary: 'Excluir filial' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.branchesService.remove(id, req.tenantCompanyId);
  }
}
