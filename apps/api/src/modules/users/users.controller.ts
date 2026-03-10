import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions('users.create')
  @ApiOperation({ summary: 'Criar novo usuário na empresa' })
  async create(@Body() dto: CreateUserDto, @Request() req: any) {
    return this.usersService.create(dto, req.user.companyId);
  }

  @Get()
  @RequirePermissions('users.view')
  @ApiOperation({ summary: 'Listar usuários da empresa' })
  async findAll(
    @Request() req: any,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll(req.user.companyId, skip, take, search);
  }

  @Get('roles')
  @RequirePermissions('users.view')
  @ApiOperation({ summary: 'Listar perfis disponíveis' })
  async getRoles() {
    return this.usersService.getAvailableRoles();
  }

  @Get(':id')
  @RequirePermissions('users.view')
  @ApiOperation({ summary: 'Detalhes do usuário' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.usersService.findOne(id, req.user.companyId);
  }

  @Put(':id')
  @RequirePermissions('users.edit')
  @ApiOperation({ summary: 'Atualizar usuário' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Request() req: any) {
    return this.usersService.update(id, dto, req.user.companyId);
  }

  @Delete(':id')
  @RequirePermissions('users.delete')
  @ApiOperation({ summary: 'Desativar usuário' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.usersService.remove(id, req.user.companyId, req.user.sub);
  }
}
