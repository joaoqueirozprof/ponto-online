import { Injectable, BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.systemUser.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new BadRequestException('Já existe um usuário com este email');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.systemUser.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash: hashedPassword,
        roleId: dto.roleId,
        branchId: dto.branchId,
        companyId: dto.companyId || null,
        isActive: true,
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
        company: { select: { id: true, name: true } },
      },
    });

    const tokens = this.generateTokens(user);

    return {
      user: this.formatUserResponse(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.systemUser.findUnique({
      where: { email: dto.email },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
        company: {
          select: { id: true, name: true, isActive: true, blockedAt: true },
        },
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Conta de usuário desativada');
    }

    // Check company status (skip for super admins without company)
    if (user.company) {
      if (!user.company.isActive) {
        throw new ForbiddenException('A empresa está inativa. Entre em contato com o suporte.');
      }
      if (user.company.blockedAt) {
        throw new ForbiddenException('A empresa está bloqueada. Entre em contato com o suporte.');
      }
    }

    await this.prisma.systemUser.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const tokens = this.generateTokens(user);

    return {
      user: this.formatUserResponse(user),
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
      });

      const user = await this.prisma.systemUser.findUnique({
        where: { id: payload.sub },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: { permission: true },
              },
            },
          },
          company: { select: { id: true, name: true, isActive: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Usuário não encontrado ou inativo');
      }

      const tokens = this.generateTokens(user);

      return {
        user: this.formatUserResponse(user),
        ...tokens,
      };
    } catch (error) {
      throw new UnauthorizedException('Token de refresh inválido');
    }
  }

  async getMe(userId: string) {
    const user = await this.prisma.systemUser.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            cnpj: true,
            isActive: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
      permissions: user.role.rolePermissions.map((rp) => rp.permission.code),
      isSuperAdmin: user.isSuperAdmin,
      company: user.company ? {
        id: user.company.id,
        name: user.company.name,
        cnpj: user.company.cnpj,
      } : null,
      branch: user.branch ? {
        id: user.branch.id,
        name: user.branch.name,
        code: user.branch.code,
      } : null,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    };
  }

  private formatUserResponse(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
      permissions: user.role.rolePermissions.map((rp: any) => rp.permission.code),
      isSuperAdmin: user.isSuperAdmin || false,
      company: user.company ? { id: user.company.id, name: user.company.name } : null,
      branch: user.branch ? { id: user.branch.id, name: user.branch.name } : null,
    };
  }

  private generateTokens(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role.id,
      roleName: user.role.name,
      companyId: user.companyId,
      branchId: user.branchId,
      isSuperAdmin: user.isSuperAdmin || false,
    };

    const accessToken = this.jwtService.sign(payload as any, {
      expiresIn: (process.env.JWT_EXPIRATION || '15m') as any,
    });

    const refreshToken = this.jwtService.sign(payload as any, {
      secret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
      expiresIn: (process.env.JWT_REFRESH_EXPIRATION || '7d') as any,
    });

    return { accessToken, refreshToken };
  }
}
