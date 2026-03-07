import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCompanyDto) {
    const existingCompany = await this.prisma.company.findUnique({
      where: { cnpj: dto.cnpj },
    });

    if (existingCompany) {
      throw new BadRequestException('Company with this CNPJ already exists');
    }

    return this.prisma.company.create({
      data: dto,
    });
  }

  async findAll(skip: any = 0, take: any = 10) {
    skip = Number(skip) || 0;
    take = Number(take) || 10;
    const [data, total] = await Promise.all([
      this.prisma.company.findMany({
        skip,
        take,
        include: {
          branches: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.company.count(),
    ]);

    return {
      data,
      total,
      skip,
      take,
    };
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        branches: {
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
            phone: true,
            timezone: true,
            createdAt: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID ${id} not found`);
    }

    return company;
  }

  async update(id: string, dto: UpdateCompanyDto) {
    await this.findOne(id);

    if (dto.cnpj) {
      const existingCompany = await this.prisma.company.findUnique({
        where: { cnpj: dto.cnpj },
      });

      if (existingCompany && existingCompany.id !== id) {
        throw new BadRequestException('Company with this CNPJ already exists');
      }
    }

    return this.prisma.company.update({
      where: { id },
      data: dto,
      include: {
        branches: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.company.delete({
      where: { id },
    });
  }
}
