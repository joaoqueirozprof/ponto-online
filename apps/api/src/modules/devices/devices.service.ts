import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateDeviceDto } from './dto/create-device.dto';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDeviceDto) {
    const existingDevice = await this.prisma.device.findUnique({
      where: { serialNumber: dto.serialNumber },
    });

    if (existingDevice) {
      throw new BadRequestException('Device with this serial number already exists');
    }

    return this.prisma.device.create({
      data: dto,
      include: {
        branch: true,
      },
    });
  }

  async findAll(branchId?: string, skip = 0, take = 10) {
    const where = branchId ? { branchId } : {};

    const [data, total] = await Promise.all([
      this.prisma.device.findMany({
        where,
        skip,
        take,
        include: {
          branch: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.device.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const device = await this.prisma.device.findUnique({
      where: { id },
      include: {
        branch: true,
        deviceSyncLogs: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!device) {
      throw new NotFoundException(`Device with ID ${id} not found`);
    }

    return device;
  }

  async update(id: string, dto: any) {
    await this.findOne(id);

    if (dto.serialNumber) {
      const existingDevice = await this.prisma.device.findUnique({
        where: { serialNumber: dto.serialNumber },
      });

      if (existingDevice && existingDevice.id !== id) {
        throw new BadRequestException('Device with this serial number already exists');
      }
    }

    return this.prisma.device.update({
      where: { id },
      data: dto,
      include: { branch: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.device.delete({
      where: { id },
    });
  }

  async recordSyncLog(deviceId: string, syncType: string, status: string, recordsProcessed: number, errorMessage?: string) {
    return this.prisma.deviceSyncLog.create({
      data: {
        deviceId,
        syncType,
        status,
        recordsProcessed,
        errorMessage,
        finishedAt: new Date(),
      },
    });
  }
}
