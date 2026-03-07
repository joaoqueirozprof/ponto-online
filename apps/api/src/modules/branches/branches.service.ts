import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBranchDto) {
    const existingBranch = await this.prisma.branch.findUnique({
      where: { code: dto.code },
    });

    if (existingBranch) {
      throw new BadRequestException('Branch with this code already exists');
    }

    return this.prisma.branch.create({
      data: dto,
      include: {
        company: true,
      },
    });
  }

  async findAll(companyId?: string, skip: any = 0, take: any = 10) {
    skip = Number(skip) || 0;
    take = Number(take) || 10;
    const where = companyId ? { companyId } : {};

    const [data, total] = await Promise.all([
      this.prisma.branch.findMany({
        where,
        skip,
        take,
        include: {
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.branch.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        company: true,
        employees: {
          select: {
            id: true,
            name: true,
            cpf: true,
            isActive: true,
          },
        },
        devices: {
          select: {
            id: true,
            name: true,
            model: true,
            isActive: true,
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }

    return branch;
  }

  async update(id: string, dto: UpdateBranchDto) {
    await this.findOne(id);

    if (dto.code) {
      const existingBranch = await this.prisma.branch.findUnique({
        where: { code: dto.code },
      });

      if (existingBranch && existingBranch.id !== id) {
        throw new BadRequestException('Branch with this code already exists');
      }
    }

    return this.prisma.branch.update({
      where: { id },
      data: dto,
      include: {
        company: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.branch.delete({
      where: { id },
    });
  }
}
