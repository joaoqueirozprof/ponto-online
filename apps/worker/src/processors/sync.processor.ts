import { PrismaClient } from '@prisma/client';
import { Job } from 'bull';

export class SyncProcessor {
  constructor(private prisma: PrismaClient) {}

  async process(job: Job<{ deviceId: string }>) {
    const { deviceId } = job.data;

    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    try {
      const recentLogs = await this.prisma.deviceSyncLog.findMany({
        where: { deviceId },
        orderBy: { startedAt: 'desc' },
        take: 1,
      });

      const lastSync = recentLogs[0]?.finishedAt || new Date(0);

      const unprocessedPunches = await this.prisma.rawPunchEvent.findMany({
        where: {
          deviceId,
          processedAt: null,
          importedAt: { gte: lastSync },
        },
      });

      let processedCount = 0;

      for (const punch of unprocessedPunches) {
        try {
          await this.prisma.rawPunchEvent.update({
            where: { id: punch.id },
            data: { processedAt: new Date() },
          });

          processedCount++;
        } catch (error) {
          console.error(`Error processing punch ${punch.id}:`, error);
        }
      }

      await this.prisma.deviceSyncLog.create({
        data: {
          deviceId,
          syncType: 'AUTO_SYNC',
          status: 'SUCCESS',
          recordsProcessed: processedCount,
          finishedAt: new Date(),
        },
      });

      await this.prisma.device.update({
        where: { id: deviceId },
        data: { lastSyncAt: new Date() },
      });

      return {
        success: true,
        deviceId,
        processedCount,
      };
    } catch (error) {
      await this.prisma.deviceSyncLog.create({
        data: {
          deviceId,
          syncType: 'AUTO_SYNC',
          status: 'FAILED',
          recordsProcessed: 0,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          finishedAt: new Date(),
        },
      });

      throw error;
    }
  }
}
