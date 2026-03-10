import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBranchDto, companyId?: string) {
    const existingBranch = await this.prisma.branch.findUnique({
      where: { code: dto.code },
    });

    if (existingBranch) {
      throw new BadRequestException('Já existe uma filial com este código');
    }

    // Force company ownership
    const data: any = { ...dto };
    if (companyId) {
      data.companyId = companyId;
    }

    return this.prisma.branch.create({
      data,
      include: {
        company: true,
      },
    });
  }

  async findAll(companyId?: string, skip: any = 0, take: any = 10, search?: string) {
    skip = Number(skip) || 0;
    take = Number(take) || 10;
    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

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

  async findOne(id: string, companyId?: string) {
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
      throw new NotFoundException('Filial não encontrada');
    }

    if (companyId && branch.companyId !== companyId) {
      throw new ForbiddenException('Acesso negado a esta filial');
    }

    return branch;
  }

  async update(id: string, dto: UpdateBranchDto, companyId?: string) {
    await this.findOne(id, companyId);

    if (dto.code) {
      const existingBranch = await this.prisma.branch.findUnique({
        where: { code: dto.code },
      });

      if (existingBranch && existingBranch.id !== id) {
        throw new BadRequestException('Já existe uma filial com este código');
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

  async remove(id: string, companyId?: string) {
    await this.findOne(id, companyId);

    return this.prisma.branch.delete({
      where: { id },
    });
  }
}
