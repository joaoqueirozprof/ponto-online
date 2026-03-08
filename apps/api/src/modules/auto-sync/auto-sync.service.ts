import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ControlIdService } from './control-id.service';

@Injectable()
export class AutoSyncService {
  private readonly logger = new Logger(AutoSyncService.name);
  private isSyncing = false;
  private lastSyncResults: any = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly controlId: ControlIdService,
  ) {}

  /**
   * Auto-sync punches from all active devices every 15 minutes
   */
  @Cron('0 */15 * * * *')
  async scheduledPunchSync() {
    if (this.isSyncing) {
      this.logger.warn('Sync already in progress, skipping scheduled run');
      return;
    }
    this.logger.log('Starting scheduled punch sync...');
    await this.syncAllDevices();
  }

  /**
   * Full daily sync at 6:00 AM (before work starts) - pulls all records and recalculates
   */
  @Cron('0 0 6 * * *')
  async dailyFullSync() {
    this.logger.log('Starting daily full sync...');
    await this.syncAllDevices();
    await this.recalculateCurrentMonth();
  }

  /**
   * Employee sync - runs daily at 5:30 AM
   */
  @Cron('0 30 5 * * *')
  async scheduledEmployeeSync() {
    this.logger.log('Starting scheduled employee sync...');
    await this.syncAllEmployees();
  }

  /**
   * Sync punches from all active devices
   */
  async syncAllDevices(): Promise<any> {
    this.isSyncing = true;
    const results: any[] = [];

    try {
      const devices = await this.prisma.device.findMany({
        where: { isActive: true },
        include: { branch: true },
      });

      this.logger.log(`Found ${devices.length} active devices to sync`);

      for (const device of devices) {
        try {
          const result = await this.syncDevice(device.id);
          results.push({ deviceId: device.id, name: device.name, ...result });
        } catch (error: any) {
          this.logger.error(`Failed to sync device ${device.name}: ${error.message}`);
          results.push({
            deviceId: device.id,
            name: device.name,
            error: error.message,
            success: false,
          });

          await this.prisma.deviceSyncLog.create({
            data: {
              deviceId: device.id,
              syncType: 'AUTO_PUNCH_SYNC',
              status: 'FAILED',
              recordsProcessed: 0,
              errorMessage: error.message,
              finishedAt: new Date(),
            },
          });
        }
      }

      this.lastSyncResults = {
        timestamp: new Date(),
        devices: results,
        totalNew: results.reduce((sum, r) => sum + (r.newRecords || 0), 0),
      };

      return this.lastSyncResults;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync punches from a single device using AFD export
   */
  async syncDevice(deviceId: string): Promise<any> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      include: { branch: true },
    });

    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    this.logger.log(`Syncing device: ${device.name} (${device.ipAddress})`);

    // Get last sync NSR to only fetch new records
    const lastSync = await this.prisma.deviceSyncLog.findFirst({
      where: {
        deviceId,
        status: 'SUCCESS',
        syncType: { in: ['AUTO_PUNCH_SYNC', 'MANUAL_PUNCH_SYNC'] },
      },
      orderBy: { finishedAt: 'desc' },
    });

    // Get last NSR from raw data of most recent record
    const lastRecord = await this.prisma.rawPunchEvent.findFirst({
      where: { deviceId },
      orderBy: { punchTime: 'desc' },
    });

    let initialNsr: number | undefined;
    if (lastRecord?.rawData && typeof lastRecord.rawData === 'object') {
      const rawData = lastRecord.rawData as any;
      if (rawData.nsr) {
        initialNsr = parseInt(rawData.nsr) + 1;
      }
    }

    // Also try date-based filter: get records from last sync date
    let initialDate: { day: number; month: number; year: number } | undefined;
    if (lastSync?.finishedAt && !initialNsr) {
      const d = lastSync.finishedAt;
      initialDate = {
        day: d.getDate(),
        month: d.getMonth() + 1,
        year: d.getFullYear(),
      };
    }

    // Export AFD from device
    const afdText = await this.controlId.exportAfd(deviceId, initialDate, initialNsr);
    const records = this.controlId.parseAfdRecords(afdText);

    this.logger.log(`Parsed ${records.length} AFD records from device ${device.name}`);

    if (records.length === 0) {
      await this.prisma.deviceSyncLog.create({
        data: {
          deviceId,
          syncType: 'AUTO_PUNCH_SYNC',
          status: 'SUCCESS',
          recordsProcessed: 0,
          finishedAt: new Date(),
        },
      });

      await this.prisma.device.update({
        where: { id: deviceId },
        data: { lastSyncAt: new Date() },
      });

      return { success: true, newRecords: 0, duplicates: 0 };
    }

    // Build PIS to employee mapping
    const employees = await this.prisma.employee.findMany({
      where: { branchId: device.branchId },
      select: { id: true, name: true, pis: true, deviceUserId: true, registration: true },
    });

    const pisToEmployee: Record<string, string> = {};
    const regToEmployee: Record<string, string> = {};
    for (const emp of employees) {
      if (emp.pis) pisToEmployee[emp.pis] = emp.id;
      if (emp.deviceUserId) regToEmployee[emp.deviceUserId] = emp.id;
      if (emp.registration) regToEmployee[emp.registration] = emp.id;
    }

    // Process records
    let newRecords = 0;
    let duplicates = 0;
    let errors = 0;
    const affectedEmployeeMonths = new Set<string>();

    for (const record of records) {
      try {
        const punchTime = this.controlId.afdToUtcDate(record.date, record.time);

        // Find employee by PIS or registration
        const employeeId = pisToEmployee[record.pis] || regToEmployee[record.pis] || null;

        // Check for duplicate (same device, same time, same PIS)
        const existing = await this.prisma.rawPunchEvent.findFirst({
          where: {
            deviceId,
            punchTime,
            rawData: {
              path: ['pis'],
              equals: record.pis,
            },
          },
        });

        if (existing) {
          duplicates++;
          continue;
        }

        // Create raw punch event
        const rawPunch = await this.prisma.rawPunchEvent.create({
          data: {
            deviceId,
            employeeId,
            punchTime,
            source: 'DEVICE',
            rawData: {
              nsr: record.nsr,
              pis: record.pis,
              originalDate: record.date,
              originalTime: record.time,
              raw: record.raw,
            },
            importedAt: new Date(),
          },
        });

        // Create normalized punch if employee found
        if (employeeId) {
          // Determine punch type based on existing punches for this day
          const dayStart = new Date(punchTime);
          dayStart.setUTCHours(0, 0, 0, 0);
          const dayEnd = new Date(punchTime);
          dayEnd.setUTCHours(23, 59, 59, 999);

          const existingPunches = await this.prisma.normalizedPunch.findMany({
            where: {
              employeeId,
              punchTime: { gte: dayStart, lte: dayEnd },
            },
            orderBy: { punchTime: 'asc' },
          });

          const punchIndex = existingPunches.length;
          const punchTypes = ['ENTRY', 'BREAK_START', 'BREAK_END', 'EXIT'];
          const punchType = punchTypes[punchIndex % 4] as any;

          await this.prisma.normalizedPunch.create({
            data: {
              rawPunchEventId: rawPunch.id,
              employeeId,
              punchTime,
              originalTime: punchTime,
              punchType,
              status: 'NORMAL',
            },
          });

          // Track affected employee/months for recalculation
          const monthKey = `${employeeId}:${punchTime.getUTCMonth() + 1}:${punchTime.getUTCFullYear()}`;
          affectedEmployeeMonths.add(monthKey);
        }

        newRecords++;
      } catch (error: any) {
        errors++;
        this.logger.error(`Error processing AFD record: ${error.message}`);
      }
    }

    // Update device last sync
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { lastSyncAt: new Date() },
    });

    // Log sync
    await this.prisma.deviceSyncLog.create({
      data: {
        deviceId,
        syncType: 'AUTO_PUNCH_SYNC',
        status: errors > 0 ? 'PARTIAL' : 'SUCCESS',
        recordsProcessed: newRecords,
        errorMessage: errors > 0 ? `${errors} errors, ${duplicates} duplicates skipped` : null,
        finishedAt: new Date(),
      },
    });

    // Auto-recalculate affected timesheets
    if (affectedEmployeeMonths.size > 0) {
      this.logger.log(`Recalculating ${affectedEmployeeMonths.size} affected timesheets...`);
      await this.recalculateAffected(affectedEmployeeMonths);
    }

    this.logger.log(`Device ${device.name}: ${newRecords} new, ${duplicates} duplicates, ${errors} errors`);

    return {
      success: true,
      newRecords,
      duplicates,
      errors,
      affectedTimesheets: affectedEmployeeMonths.size,
    };
  }

  /**
   * Recalculate timesheets for affected employee/months
   */
  async recalculateAffected(affectedEmployeeMonths: Set<string>): Promise<void> {
    for (const key of affectedEmployeeMonths) {
      const [employeeId, monthStr, yearStr] = key.split(':');
      const month = parseInt(monthStr);
      const year = parseInt(yearStr);

      try {
        await this.calculateTimesheet(employeeId, month, year);
      } catch (error: any) {
        this.logger.error(`Failed to recalculate timesheet for ${employeeId} ${month}/${year}: ${error.message}`);
      }
    }
  }

  /**
   * Recalculate current month timesheets for all employees
   */
  async recalculateCurrentMonth(): Promise<any> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    this.logger.log(`Recalculating all timesheets for ${month}/${year}...`);

    const employees = await this.prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    let processed = 0;
    let errors = 0;

    for (const emp of employees) {
      try {
        await this.calculateTimesheet(emp.id, month, year);
        processed++;
      } catch (error: any) {
        errors++;
        this.logger.error(`Failed to recalculate for ${emp.name}: ${error.message}`);
      }
    }

    this.logger.log(`Recalculation complete: ${processed} processed, ${errors} errors`);
    return { processed, errors, total: employees.length, month, year };
  }

  /**
   * Calculate timesheet for a single employee/month
   * (Simplified version that calls the timesheets service logic directly)
   */
  private async calculateTimesheet(employeeId: string, month: number, year: number): Promise<void> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { schedule: { include: { scheduleEntries: true } } },
    });

    if (!employee) return;

    let timesheet = await this.prisma.timesheet.findUnique({
      where: { employeeId_month_year: { employeeId, month, year } },
    });

    if (!timesheet) {
      timesheet = await this.prisma.timesheet.create({
        data: { employeeId, month, year, status: 'OPEN' },
      });
    }

    // Delete existing days for recalculation
    await this.prisma.timesheetDay.deleteMany({
      where: { timesheetId: timesheet.id },
    });

    // Get punches
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    const punches = await this.prisma.normalizedPunch.findMany({
      where: {
        employeeId,
        punchTime: { gte: startDate, lte: endDate },
      },
      orderBy: { punchTime: 'asc' },
    });

    // Holidays
    const holidays = await this.prisma.holiday.findMany({
      where: { date: { gte: startDate, lte: endDate } },
    });
    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

    // Group by date
    const punchesByDate: Record<string, any[]> = {};
    for (const p of punches) {
      const dateStr = p.punchTime.toISOString().split('T')[0];
      if (!punchesByDate[dateStr]) punchesByDate[dateStr] = [];
      punchesByDate[dateStr].push(p);
    }

    // Schedule map
    const scheduleByDay: Record<number, any> = {};
    if (employee.schedule?.scheduleEntries) {
      for (const entry of employee.schedule.scheduleEntries) {
        scheduleByDay[entry.dayOfWeek] = entry;
      }
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    const timesheetDays: any[] = [];
    let totalWorked = 0, totalOvertime = 0, totalNight = 0, totalAbsence = 0, totalLate = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, month - 1, day));
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = new Date(year, month - 1, day).getDay();
      const dayPunches = punchesByDate[dateStr] || [];
      const scheduleEntry = scheduleByDay[dayOfWeek];
      const isHoliday = holidayDates.has(dateStr);
      const isWorkDay = scheduleEntry?.isWorkDay && !isHoliday;

      let workedMinutes = 0, breakMinutes = 0, status = 'NORMAL';

      if (isHoliday) status = 'HOLIDAY';
      else if (!isWorkDay || dayOfWeek === 0) status = 'WEEKEND';

      if (dayPunches.length >= 2) {
        const sorted = [...dayPunches].sort((a, b) => a.punchTime.getTime() - b.punchTime.getTime());
        let entryTime: Date | null = null;
        let breakStart: Date | null = null;

        for (const p of sorted) {
          if (p.punchType === 'ENTRY' && !entryTime) {
            entryTime = p.punchTime;
          } else if (p.punchType === 'BREAK_START' && entryTime) {
            workedMinutes += Math.floor((p.punchTime.getTime() - entryTime.getTime()) / 60000);
            breakStart = p.punchTime;
            entryTime = null;
          } else if (p.punchType === 'BREAK_END' && breakStart) {
            breakMinutes += Math.floor((p.punchTime.getTime() - breakStart.getTime()) / 60000);
            breakStart = null;
            entryTime = p.punchTime;
          } else if (p.punchType === 'EXIT' && entryTime) {
            workedMinutes += Math.floor((p.punchTime.getTime() - entryTime.getTime()) / 60000);
            entryTime = null;
          }
        }

        if (entryTime && sorted.length > 0) {
          const lastPunch = sorted[sorted.length - 1];
          if (lastPunch.punchTime.getTime() !== entryTime.getTime()) {
            workedMinutes += Math.floor((lastPunch.punchTime.getTime() - entryTime.getTime()) / 60000);
          }
        }
      } else if (dayPunches.length === 1) {
        status = 'INCOMPLETE';
      }

      let expectedMinutes = 0;
      if (scheduleEntry?.isWorkDay && scheduleEntry.startTime && scheduleEntry.endTime) {
        const [sh, sm] = scheduleEntry.startTime.split(':').map(Number);
        const [eh, em] = scheduleEntry.endTime.split(':').map(Number);
        expectedMinutes = (eh * 60 + em) - (sh * 60 + sm);
        if (scheduleEntry.breakStartTime && scheduleEntry.breakEndTime) {
          const [bsh, bsm] = scheduleEntry.breakStartTime.split(':').map(Number);
          const [beh, bem] = scheduleEntry.breakEndTime.split(':').map(Number);
          expectedMinutes -= (beh * 60 + bem) - (bsh * 60 + bsm);
        }
      }

      let overtimeMinutes = 0, absenceMinutes = 0, nightMinutes = 0;
      if (isWorkDay && expectedMinutes > 0) {
        if (workedMinutes > expectedMinutes) overtimeMinutes = workedMinutes - expectedMinutes;
        else if (workedMinutes < expectedMinutes && workedMinutes > 0) absenceMinutes = expectedMinutes - workedMinutes;
        else if (workedMinutes === 0 && dayPunches.length === 0) { absenceMinutes = expectedMinutes; status = 'ABSENCE'; }
      } else if (!isWorkDay && workedMinutes > 0) {
        overtimeMinutes = workedMinutes;
      }

      const today = new Date();
      if (date <= today) {
        timesheetDays.push({
          timesheetId: timesheet.id,
          scheduleEntryId: scheduleEntry?.id || null,
          date,
          workedMinutes, overtimeMinutes, nightMinutes, lateMinutes: 0,
          absenceMinutes, breakMinutes, punchCount: dayPunches.length,
          status: status as any,
        });
        totalWorked += workedMinutes;
        totalOvertime += overtimeMinutes;
        totalNight += nightMinutes;
        totalAbsence += absenceMinutes;
      }
    }

    if (timesheetDays.length > 0) {
      await this.prisma.timesheetDay.createMany({ data: timesheetDays });
    }

    await this.prisma.timesheet.update({
      where: { id: timesheet.id },
      data: {
        totalWorkedMinutes: totalWorked,
        totalOvertimeMinutes: totalOvertime,
        totalNightMinutes: totalNight,
        totalAbsenceMinutes: totalAbsence,
        totalLateMinutes: totalLate,
        totalBalanceMinutes: totalWorked - (totalAbsence > 0 ? totalAbsence : 0),
        status: 'CALCULATED',
        calculatedAt: new Date(),
      },
    });
  }

  /**
   * Sync employees bidirectionally between system and all devices
   */
  async syncAllEmployees(): Promise<any> {
    const devices = await this.prisma.device.findMany({
      where: { isActive: true },
      include: { branch: true },
    });

    const results: any[] = [];

    for (const device of devices) {
      try {
        const result = await this.syncEmployeesForDevice(device.id);
        results.push({ deviceId: device.id, name: device.name, ...result });
      } catch (error: any) {
        this.logger.error(`Failed to sync employees for device ${device.name}: ${error.message}`);
        results.push({
          deviceId: device.id,
          name: device.name,
          error: error.message,
          success: false,
        });
      }
    }

    return { devices: results };
  }

  /**
   * Sync employees for a single device (bidirectional)
   */
  async syncEmployeesForDevice(deviceId: string): Promise<any> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      include: { branch: true },
    });

    if (!device) throw new Error(`Device ${deviceId} not found`);

    // 1. Get employees from device
    const deviceUsers = await this.controlId.loadUsers(deviceId);
    this.logger.log(`Device ${device.name} has ${deviceUsers.length} users`);

    // 2. Get employees from system for this branch
    const systemEmployees = await this.prisma.employee.findMany({
      where: { branchId: device.branchId, isActive: true },
    });

    // Build maps
    const deviceUsersByReg: Record<string, any> = {};
    for (const u of deviceUsers) {
      if (u.registration) deviceUsersByReg[u.registration] = u;
    }

    const systemEmpByReg: Record<string, any> = {};
    const systemEmpByCpf: Record<string, any> = {};
    for (const e of systemEmployees) {
      if (e.registration) systemEmpByReg[e.registration] = e;
      if (e.cpf) systemEmpByCpf[e.cpf] = e;
    }

    let pushedToDevice = 0;
    let pulledFromDevice = 0;
    let updated = 0;

    // 3. Push system employees NOT on device → to device
    const toCreateOnDevice: { registration: string; name: string }[] = [];
    for (const emp of systemEmployees) {
      const reg = emp.registration || emp.cpf;
      if (reg && !deviceUsersByReg[reg]) {
        toCreateOnDevice.push({
          registration: reg,
          name: emp.name,
        });
      }
    }

    if (toCreateOnDevice.length > 0) {
      try {
        await this.controlId.createUsers(deviceId, toCreateOnDevice);
        pushedToDevice = toCreateOnDevice.length;
        this.logger.log(`Pushed ${pushedToDevice} employees to device ${device.name}`);
      } catch (error: any) {
        this.logger.error(`Failed to push employees to device: ${error.message}`);
      }
    }

    // 4. Pull device users NOT in system → create in system
    for (const devUser of deviceUsers) {
      if (!devUser.registration) continue;

      const existsInSystem = systemEmpByReg[devUser.registration] || systemEmpByCpf[devUser.registration];
      if (!existsInSystem && devUser.name) {
        try {
          await this.prisma.employee.create({
            data: {
              branchId: device.branchId,
              name: devUser.name,
              cpf: devUser.registration.length === 11 ? devUser.registration : `DEV${devUser.registration}`,
              registration: devUser.registration,
              deviceUserId: String(devUser.id),
              admissionDate: new Date(),
              isActive: true,
            },
          });
          pulledFromDevice++;
          this.logger.log(`Pulled new employee from device: ${devUser.name} (${devUser.registration})`);
        } catch (error: any) {
          this.logger.error(`Failed to create employee from device: ${error.message}`);
        }
      }
    }

    // 5. Update deviceUserId mapping for matched employees
    for (const devUser of deviceUsers) {
      if (!devUser.registration) continue;
      const sysEmp = systemEmpByReg[devUser.registration] || systemEmpByCpf[devUser.registration];
      if (sysEmp && !sysEmp.deviceUserId) {
        await this.prisma.employee.update({
          where: { id: sysEmp.id },
          data: { deviceUserId: String(devUser.id) },
        });
        updated++;
      }
    }

    // Log sync
    await this.prisma.deviceSyncLog.create({
      data: {
        deviceId,
        syncType: 'EMPLOYEE_SYNC',
        status: 'SUCCESS',
        recordsProcessed: pushedToDevice + pulledFromDevice + updated,
        finishedAt: new Date(),
      },
    });

    return {
      success: true,
      pushedToDevice,
      pulledFromDevice,
      updatedMappings: updated,
      deviceUsers: deviceUsers.length,
      systemEmployees: systemEmployees.length,
    };
  }

  /**
   * Get sync status and last results
   */
  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncResults: this.lastSyncResults,
    };
  }
}
