import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new user within the caller's company
   */
  async create(dto: CreateUserDto, callerCompanyId: string) {
    if (!callerCompanyId) {
      throw new ForbiddenException('Empresa não identificada');
    }

    // Check duplicate email
    const existing = await this.prisma.systemUser.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException('Já existe um usuário com este email');
    }

    // Validate branch belongs to company
    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, companyId: callerCompanyId },
      });
      if (!branch) {
        throw new BadRequestException('Filial não pertence à empresa');
      }
    }

    // Validate role is not system role
    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) {
      throw new BadRequestException('Perfil não encontrado');
    }
    if (role.isSystem) {
      throw new ForbiddenException('Não é possível atribuir perfil de sistema');
    }

    // Check plan limits
    const userCount = await this.prisma.systemUser.count({
      where: { companyId: callerCompanyId, isActive: true },
    });
    const subscription = await this.prisma.subscription.findUnique({
      where: { companyId: callerCompanyId },
      include: { plan: true },
    });
    if (subscription && userCount >= subscription.plan.maxUsers) {
      throw new BadRequestException(
        `Limite de ${subscription.plan.maxUsers} usuários atingido. Faça upgrade do plano.`,
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.systemUser.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash: hashedPassword,
        roleId: dto.roleId,
        companyId: callerCompanyId,
        branchId: dto.branchId || null,
        isActive: true,
      },
      include: {
        role: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      branch: user.branch,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  /**
   * List users within a company
   */
  async findAll(companyId: string, skip = 0, take = 20, search?: string) {
    const where: any = { companyId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.systemUser.findMany({
        where,
        skip: Number(skip) || 0,
        take: Number(take) || 20,
        include: {
          role: { select: { id: true, name: true, description: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.systemUser.count({ where }),
    ]);

    return {
      data: data.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        branch: u.branch,
        isActive: u.isActive,
        lastLogin: u.lastLogin,
        createdAt: u.createdAt,
      })),
      total,
      skip,
      take,
    };
  }

  /**
   * Get single user (must be in same company)
   */
  async findOne(id: string, companyId: string) {
    const user = await this.prisma.systemUser.findFirst({
      where: { id, companyId },
      include: {
        role: { select: { id: true, name: true, description: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      branch: user.branch,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Update user (must be in same company)
   */
  async update(id: string, dto: UpdateUserDto, callerCompanyId: string) {
    const user = await this.prisma.systemUser.findFirst({
      where: { id, companyId: callerCompanyId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const updateData: any = {};

    if (dto.name) updateData.name = dto.name;
    if (dto.email) {
      const existing = await this.prisma.systemUser.findUnique({ where: { email: dto.email } });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Email já em uso');
      }
      updateData.email = dto.email;
    }
    if (dto.password) {
      updateData.passwordHash = await bcrypt.hash(dto.password, 12);
    }
    if (dto.roleId) {
      const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
      if (!role) throw new BadRequestException('Perfil não encontrado');
      if (role.isSystem) throw new ForbiddenException('Não é possível atribuir perfil de sistema');
      updateData.roleId = dto.roleId;
    }
    if (dto.branchId !== undefined) {
      if (dto.branchId) {
        const branch = await this.prisma.branch.findFirst({
          where: { id: dto.branchId, companyId: callerCompanyId },
        });
        if (!branch) throw new BadRequestException('Filial não pertence à empresa');
      }
      updateData.branchId = dto.branchId || null;
    }
    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }

    const updated = await this.prisma.systemUser.update({
      where: { id },
      data: updateData,
      include: {
        role: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      branch: updated.branch,
      isActive: updated.isActive,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Delete/deactivate user (must be in same company)
   */
  async remove(id: string, callerCompanyId: string, callerId: string) {
    if (id === callerId) {
      throw new BadRequestException('Você não pode excluir sua própria conta');
    }

    const user = await this.prisma.systemUser.findFirst({
      where: { id, companyId: callerCompanyId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Soft delete - deactivate instead of deleting
    await this.prisma.systemUser.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Usuário desativado com sucesso' };
  }

  /**
   * Get available roles for the company
   */
  async getAvailableRoles() {
    return this.prisma.role.findMany({
      where: { isSystem: false },
      select: { id: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });
  }
}
