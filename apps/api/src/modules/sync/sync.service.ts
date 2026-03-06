import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async syncPunches(deviceId: string, punches: any[]) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new NotFoundException(`Device with ID ${deviceId} not found`);
    }

    const createdPunches = [];
    let processedCount = 0;
    let errorCount = 0;

    for (const punch of punches) {
      try {
        const employee = await this.prisma.employee.findFirst({
          where: {
            branchId: device.branchId,
            deviceUserId: punch.userId,
          },
        });

        const rawPunch = await this.prisma.rawPunchEvent.create({
          data: {
            deviceId,
            employeeId: employee?.id,
            punchTime: new Date(punch.timestamp),
            source: 'DEVICE',
            rawData: punch,
            importedAt: new Date(),
          },
        });

        if (employee) {
          const normalizedPunch = await this.prisma.normalizedPunch.create({
            data: {
              rawPunchEventId: rawPunch.id,
              employeeId: employee.id,
              punchTime: new Date(punch.timestamp),
              originalTime: new Date(punch.timestamp),
              punchType: punch.type || 'ENTRY',
              status: 'NORMAL',
            },
          });
          createdPunches.push(normalizedPunch);
        }

        processedCount++;
      } catch (error) {
        errorCount++;
        console.error(`Error processing punch: ${error.message}`);
      }
    }

    await this.prisma.device.update({
      where: { id: deviceId },
      data: { lastSyncAt: new Date() },
    });

    await this.prisma.deviceSyncLog.create({
      data: {
        deviceId,
        syncType: 'PUNCH_SYNC',
        status: errorCount === 0 ? 'SUCCESS' : 'PARTIAL',
        recordsProcessed: processedCount,
        errorMessage: errorCount > 0 ? `${errorCount} errors during sync` : null,
        finishedAt: new Date(),
      },
    });

    return {
      processed: processedCount,
      errors: errorCount,
      punches: createdPunches,
    };
  }

  async recordDeviceStatus(deviceId: string, status: any) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new NotFoundException(`Device with ID ${deviceId} not found`);
    }

    await this.prisma.device.update({
      where: { id: deviceId },
      data: {
        isActive: status.isActive !== false,
        lastSyncAt: new Date(),
      },
    });

    return {
      success: true,
      deviceId,
      status: 'updated',
    };
  }

  async getEmployeesForSync(branchId: string, skip = 0, take = 1000) {
    const employees = await this.prisma.employee.findMany({
      where: {
        branchId,
        isActive: true,
      },
      skip,
      take,
      select: {
        id: true,
        name: true,
        cpf: true,
        pis: true,
        registration: true,
        deviceUserId: true,
        position: true,
        department: true,
        admissionDate: true,
        terminationDate: true,
      },
    });

    return employees;
  }

  async updateEmployeeDeviceId(employeeId: string, deviceUserId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${employeeId} not found`);
    }

    return this.prisma.employee.update({
      where: { id: employeeId },
      data: { deviceUserId },
    });
  }
}
