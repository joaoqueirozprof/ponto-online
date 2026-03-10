import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCompanyDto) {
    const existing = await this.prisma.company.findUnique({ where: { cnpj: dto.cnpj } });
    if (existing) throw new BadRequestException('Já existe uma empresa com este CNPJ');
    return this.prisma.company.create({ data: dto });
  }

  async findAll(skip: any = 0, take: any = 10, search?: string) {
    skip = Number(skip) || 0;
    take = Number(take) || 10;
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { cnpj: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.company.findMany({
        where, skip, take,
        include: {
          branches: { select: { id: true, name: true, code: true } },
          subscription: { include: { plan: { select: { id: true, name: true, maxEmployees: true } } } },
          _count: { select: { systemUsers: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.company.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async findOne(id: string, restrictToCompanyId?: string) {
    if (restrictToCompanyId && id !== restrictToCompanyId) {
      throw new ForbiddenException('Acesso negado a esta empresa');
    }
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        branches: { select: { id: true, name: true, code: true, address: true, phone: true, timezone: true, createdAt: true } },
        subscription: { include: { plan: true, invoices: { take: 5, orderBy: { createdAt: 'desc' as const } } } },
        _count: { select: { systemUsers: true } },
      },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return company;
  }

  async update(id: string, dto: UpdateCompanyDto, restrictToCompanyId?: string) {
    if (restrictToCompanyId && id !== restrictToCompanyId) {
      throw new ForbiddenException('Acesso negado');
    }
    await this.findOne(id);
    if (dto.cnpj) {
      const existing = await this.prisma.company.findUnique({ where: { cnpj: dto.cnpj } });
      if (existing && existing.id !== id) throw new BadRequestException('CNPJ já em uso');
    }
    return this.prisma.company.update({ where: { id }, data: dto, include: { branches: true } });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.company.update({
      where: { id },
      data: { isActive: false, blockedAt: new Date(), blockReason: 'Desativada pelo administrador' },
    });
  }

  async reactivate(id: string) {
    return this.prisma.company.update({
      where: { id },
      data: { isActive: true, blockedAt: null, blockReason: null },
    });
  }

  async getStats() {
    const [totalCompanies, activeCompanies, totalEmployees, totalUsers] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.company.count({ where: { isActive: true } }),
      this.prisma.employee.count({ where: { isActive: true } }),
      this.prisma.systemUser.count({ where: { isActive: true, isSuperAdmin: false } }),
    ]);
    const subs = await this.prisma.subscription.groupBy({ by: ['status'], _count: true });
    return {
      totalCompanies, activeCompanies, totalEmployees, totalUsers,
      subscriptions: subs.reduce((acc: any, s: any) => { acc[s.status] = s._count; return acc; }, {}),
    };
  }
}
