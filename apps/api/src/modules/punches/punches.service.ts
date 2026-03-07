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

  async getRawPunches(employeeId?: string, deviceId?: string, skip: any = 0, take: any = 100, search?: string) {
    skip = Number(skip) || 0;
    take = Number(take) || 100;
    const where: any = {};
    if (employeeId) where.employeeId = employeeId;
    if (deviceId) where.deviceId = deviceId;
    if (search) {
      where.employee = {
        ...where.employee,
        name: { contains: search, mode: 'insensitive' },
      };
    }

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

  async getNormalizedPunches(employeeId?: string, skip: any = 0, take: any = 100) {
    skip = Number(skip) || 0;
    take = Number(take) || 100;
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

  async createManualPunch(dto: { employeeId: string; punchTime: string; punchType: string; reason: string; createdBy: string }) {
    // Create raw punch event first (source = MANUAL, deviceId not required for manual)
    // We need a device to satisfy the relation - use a virtual/manual device
    let manualDevice = await this.prisma.device.findFirst({
      where: { serialNumber: 'MANUAL-ENTRY' },
    });

    if (!manualDevice) {
      // Get the first branch to associate the manual device
      const firstBranch = await this.prisma.branch.findFirst();
      if (!firstBranch) {
        throw new NotFoundException('No branch found. Please create a branch first.');
      }
      manualDevice = await this.prisma.device.create({
        data: {
          name: 'Registro Manual',
          serialNumber: 'MANUAL-ENTRY',
          model: 'Manual',
          branchId: firstBranch.id,
          status: 'ONLINE',
          location: 'Sistema',
        },
      });
    }

    const punchTime = new Date(dto.punchTime);

    const rawPunch = await this.prisma.rawPunchEvent.create({
      data: {
        deviceId: manualDevice.id,
        employeeId: dto.employeeId,
        punchTime,
        source: 'MANUAL',
        rawData: { reason: dto.reason, createdBy: dto.createdBy },
      },
    });

    const normalizedPunch = await this.prisma.normalizedPunch.create({
      data: {
        rawPunchEventId: rawPunch.id,
        employeeId: dto.employeeId,
        punchTime,
        punchType: dto.punchType as any,
        status: 'MANUAL',
        originalTime: punchTime,
        adjustedBy: dto.createdBy,
        adjustmentReason: dto.reason,
      },
      include: {
        employee: { select: { id: true, name: true, cpf: true } },
      },
    });

    return normalizedPunch;
  }

  async getPunchAdjustments(employeeId?: string, skip: any = 0, take: any = 50) {
    skip = Number(skip) || 0;
    take = Number(take) || 50;
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
