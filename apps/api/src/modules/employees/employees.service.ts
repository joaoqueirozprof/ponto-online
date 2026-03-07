import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEmployeeDto) {
    const existingEmployee = await this.prisma.employee.findUnique({
      where: { cpf: dto.cpf },
    });

    if (existingEmployee) {
      throw new BadRequestException('Employee with this CPF already exists');
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

  async findAll(branchId?: string, skip: any = 0, take: any = 10, isActive?: boolean) {
    skip = Number(skip) || 0;
    take = Number(take) || 10;
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (isActive !== undefined) where.isActive = isActive;

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

  async findOne(id: string) {
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
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    await this.findOne(id);

    if (dto.cpf) {
      const existingEmployee = await this.prisma.employee.findUnique({
        where: { cpf: dto.cpf },
      });

      if (existingEmployee && existingEmployee.id !== id) {
        throw new BadRequestException('Employee with this CPF already exists');
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

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.employee.delete({
      where: { id },
    });
  }
}
