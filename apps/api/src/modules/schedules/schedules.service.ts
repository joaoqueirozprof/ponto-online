import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class SchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: any) {
    const { scheduleEntries, ...rest } = dto;
    return this.prisma.workSchedule.create({
      data: {
        ...rest,
        scheduleEntries: scheduleEntries && scheduleEntries.length > 0
          ? { create: scheduleEntries }
          : undefined,
      },
      include: {
        scheduleEntries: true,
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async findAll(branchId?: string, skip: any = 0, take: any = 10, search?: string) {
    skip = Number(skip) || 0;
    take = Number(take) || 10;
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.workSchedule.findMany({
        where,
        skip,
        take,
        include: {
          scheduleEntries: true,
          branch: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workSchedule.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const schedule = await this.prisma.workSchedule.findUnique({
      where: { id },
      include: {
        scheduleEntries: {
          orderBy: { dayOfWeek: 'asc' },
        },
        branch: true,
        employees: {
          select: { id: true, name: true, cpf: true },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule with ID ${id} not found`);
    }

    return schedule;
  }

  async update(id: string, dto: any) {
    await this.findOne(id);

    return this.prisma.workSchedule.update({
      where: { id },
      data: {
        ...dto,
        scheduleEntries: dto.scheduleEntries ? {
          deleteMany: {},
          create: dto.scheduleEntries,
        } : undefined,
      },
      include: {
        scheduleEntries: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.workSchedule.delete({
      where: { id },
    });
  }
}
