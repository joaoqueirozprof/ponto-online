import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class PunchesService {
  constructor(private readonly prisma: PrismaService) {}

  async createRawPunch(dto: any) {
    return this.prisma.rawPunchEvent.create({
      data: dto,
      include: {
        device: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true, cpf: true } },
      },
    });
  }

  async getRawPunches(employeeId?: string, deviceId?: string, skip = 0, take = 100) {
    const where: any = {};
    if (employeeId) where.employeeId = employeeId;
    if (deviceId) where.deviceId = deviceId;

    const [data, total] = await Promise.all([
      this.prisma.rawPunchEvent.findMany({
        where,
        skip,
        take,
        include: {
          device: true,
          employee: true,
        },
        orderBy: { punchTime: 'desc' },
      }),
      this.prisma.rawPunchEvent.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async getNormalizedPunches(employeeId?: string, skip = 0, take = 100) {
    const where = employeeId ? { employeeId } : {};

    const [data, total] = await Promise.all([
      this.prisma.normalizedPunch.findMany({
        where,
        skip,
        take,
        include: {
          employee: { select: { id: true, name: true } },
          rawPunchEvent: { select: { id: true, importedAt: true } },
        },
        orderBy: { punchTime: 'desc' },
      }),
      this.prisma.normalizedPunch.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async adjustPunch(punchId: string, dto: any) {
    const punch = await this.prisma.normalizedPunch.findUnique({
      where: { id: punchId },
    });

    if (!punch) {
      throw new NotFoundException(`Punch with ID ${punchId} not found`);
    }

    const adjustment = await this.prisma.punchAdjustment.create({
      data: {
        normalizedPunchId: punchId,
        employeeId: punch.employeeId,
        originalTime: punch.punchTime,
        newTime: new Date(dto.newTime),
        reason: dto.reason,
        adjustedBy: dto.adjustedBy,
      },
    });

    await this.prisma.normalizedPunch.update({
      where: { id: punchId },
      data: {
        punchTime: new Date(dto.newTime),
        status: 'ADJUSTED',
        adjustedBy: dto.adjustedBy,
        adjustmentReason: dto.reason,
      },
    });

    return adjustment;
  }

  async getPunchAdjustments(employeeId?: string, skip = 0, take = 50) {
    const where = employeeId ? { employeeId } : {};

    const [data, total] = await Promise.all([
      this.prisma.punchAdjustment.findMany({
        where,
        skip,
        take,
        include: {
          employee: { select: { id: true, name: true } },
          normalizedPunch: { select: { id: true, punchTime: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.punchAdjustment.count({ where }),
    ]);

    return { data, total, skip, take };
  }
}
