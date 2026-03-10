import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEmployeeDto, companyId?: string) {
    const existingEmployee = await this.prisma.employee.findUnique({
      where: { cpf: dto.cpf },
    });

    if (existingEmployee) {
      throw new BadRequestException('Já existe um funcionário com este CPF');
    }

    // Validate branch belongs to company
    if (dto.branchId && companyId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, companyId },
      });
      if (!branch) {
        throw new ForbiddenException('Filial não pertence à sua empresa');
      }
    }

    return this.prisma.employee.create({
      data: dto,
      include: {
        branch: true,
        schedule: {
          include: {
            scheduleEntries: true,
          },
        },
      },
    });
  }

  async findAll(companyId?: string, branchId?: string, skip: any = 0, take: any = 10, isActive?: boolean, search?: string) {
    skip = Number(skip) || 0;
    take = Number(take) || 10;
    const where: any = {};
    
    // Tenant isolation: filter by company branches
    if (companyId) {
      const companyBranches = await this.prisma.branch.findMany({
        where: { companyId },
        select: { id: true },
      });
      where.branchId = { in: companyBranches.map(b => b.id) };
    }
    
    if (branchId) where.branchId = branchId;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { cpf: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { registration: { contains: search, mode: 'insensitive' } },
        { position: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take,
        include: {
          branch: {
            select: { id: true, name: true, code: true },
          },
          schedule: {
            select: { id: true, name: true, type: true },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOne(id: string, companyId?: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        branch: true,
        schedule: {
          include: {
            scheduleEntries: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Funcionário não encontrado`);
    }

    // Tenant isolation check
    if (companyId && employee.branch) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: employee.branchId, companyId },
      });
      if (!branch) {
        throw new ForbiddenException('Acesso negado a este funcionário');
      }
    }

    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto, companyId?: string) {
    await this.findOne(id, companyId);

    if (dto.cpf) {
      const existingEmployee = await this.prisma.employee.findUnique({
        where: { cpf: dto.cpf },
      });

      if (existingEmployee && existingEmployee.id !== id) {
        throw new BadRequestException('Já existe um funcionário com este CPF');
      }
    }

    return this.prisma.employee.update({
      where: { id },
      data: dto,
      include: {
        branch: true,
        schedule: true,
      },
    });
  }

  async remove(id: string, companyId?: string) {
    await this.findOne(id, companyId);

    return this.prisma.employee.delete({
      where: { id },
    });
  }
}
