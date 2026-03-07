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
    // We need a device to satisfy the relation - use a virtual/manual device
    let manualDevice: any = await this.prisma.device.findFirst({
      where: { serialNumber: 'MANUAL-ENTRY' },
    });

    if (!manualDevice) {
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
          ipAddress: '0.0.0.0',
          port: 0,
          login: 'system',
          encryptedPassword: 'none',
          isActive: false,
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
        status: 'MANUAL' as any,
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

  async fixAfdSourceRecords() {
    // 1. Create proper REP devices for each branch (if they don't exist)
    const branches = await this.prisma.branch.findMany();
    const repDevices: Record<string, any> = {};

    for (const branch of branches) {
      let repDevice = await this.prisma.device.findFirst({
        where: { serialNumber: `REP-${branch.code || branch.name.toUpperCase().replace(/\s+/g, '-')}` },
      });

      if (!repDevice) {
        repDevice = await this.prisma.device.create({
          data: {
            name: `REP ${branch.name}`,
            serialNumber: `REP-${branch.code || branch.name.toUpperCase().replace(/\s+/g, '-')}`,
            model: 'Henry Orion 6',
            branchId: branch.id,
            ipAddress: '192.168.1.100',
            port: 3000,
            login: 'admin',
            encryptedPassword: 'encrypted',
            isActive: true,
          },
        });
      }

      repDevices[branch.id] = repDevice;
    }

    // 2. Get the manual device
    const manualDevice = await this.prisma.device.findFirst({
      where: { serialNumber: 'MANUAL-ENTRY' },
    });

    if (!manualDevice) {
      return { message: 'No manual device found, nothing to fix', updated: 0 };
    }

    // 3. Update all raw punch events that have source=MANUAL and reason "Importação AFD"
    // First, get employees grouped by branch to know which REP device to assign
    const employees = await this.prisma.employee.findMany({
      select: { id: true, branchId: true },
    });

    const employeeBranch: Record<string, string> = {};
    for (const emp of employees) {
      if (emp.branchId) employeeBranch[emp.id] = emp.branchId;
    }

    // 4. Update records in batches by branch
    let totalUpdated = 0;

    for (const branch of branches) {
      const branchEmployeeIds = employees
        .filter(e => e.branchId === branch.id)
        .map(e => e.id);

      if (branchEmployeeIds.length === 0) continue;

      const repDevice = repDevices[branch.id];

      // Update raw punch events for this branch's employees
      const result = await this.prisma.rawPunchEvent.updateMany({
        where: {
          source: 'MANUAL',
          deviceId: manualDevice.id,
          employeeId: { in: branchEmployeeIds },
        },
        data: {
          source: 'AFD',
          deviceId: repDevice.id,
        },
      });

      totalUpdated += result.count;
    }

    // 5. Also update any records without employeeId
    const orphanResult = await this.prisma.rawPunchEvent.updateMany({
      where: {
        source: 'MANUAL',
        deviceId: manualDevice.id,
      },
      data: {
        source: 'AFD',
      },
    });

    totalUpdated += orphanResult.count;

    // 6. Delete the manual device if no records left pointing to it
    const remainingManual = await this.prisma.rawPunchEvent.count({
      where: { deviceId: manualDevice.id },
    });

    if (remainingManual === 0) {
      await this.prisma.device.delete({ where: { id: manualDevice.id } });
    }

    return {
      message: 'AFD records fixed successfully',
      totalUpdated,
      devicesCreated: Object.keys(repDevices).length,
      manualDeviceDeleted: remainingManual === 0,
    };
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
