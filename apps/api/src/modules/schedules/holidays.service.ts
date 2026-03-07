import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class HolidaysService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: any) {
    return this.prisma.holiday.create({
      data: dto,
      include: {
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async findAll(branchId?: string, skip: any = 0, take: any = 50) {
    skip = Number(skip) || 0;
    take = Number(take) || 50;
    const where = branchId ? { branchId } : {};

    const [data, total] = await Promise.all([
      this.prisma.holiday.findMany({
        where,
        skip,
        take,
        include: {
          branch: { select: { id: true, name: true } },
        },
        orderBy: { date: 'asc' },
      }),
      this.prisma.holiday.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const holiday = await this.prisma.holiday.findUnique({
      where: { id },
      include: {
        branch: true,
      },
    });

    if (!holiday) {
      throw new NotFoundException(`Holiday with ID ${id} not found`);
    }

    return holiday;
  }

  async update(id: string, dto: any) {
    await this.findOne(id);

    return this.prisma.holiday.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.holiday.delete({
      where: { id },
    });
  }
}
