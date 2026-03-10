import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ControlIdService } from './control-id.service';

/** BRT offset in milliseconds (UTC-3) */
const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;

/**
 * Convert a UTC Date to a BRT (UTC-3) date string YYYY-MM-DD.
 * This ensures punches are grouped by the local day in Fortaleza, not UTC day.
 */
function utcToBrtDateStr(utcDate: Date): string {
  const brt = new Date(utcDate.getTime() + BRT_OFFSET_MS);
  return brt.toISOString().split('T')[0];
}

/**
 * Get BRT day boundaries as UTC Date objects.
 * For a given UTC punch time, returns the UTC range that corresponds to the
 * BRT calendar day containing that punch.
 * BRT 00:00 = UTC 03:00, BRT 23:59:59 = UTC+1 02:59:59
 */
function getBrtDayBoundsUtc(utcDate: Date): { dayStart: Date; dayEnd: Date } {
  const brtDateStr = utcToBrtDateStr(utcDate);
  const [y, m, d] = brtDateStr.split('-').map(Number);
  // BRT 00:00:00 in UTC = that date at 03:00:00 UTC
  const dayStart = new Date(Date.UTC(y, m - 1, d, 3, 0, 0, 0));
  // BRT 23:59:59.999 in UTC = next day at 02:59:59.999 UTC
  const dayEnd = new Date(Date.UTC(y, m - 1, d + 1, 2, 59, 59, 999));
  return { dayStart, dayEnd };
}

/**
 * Get BRT month boundaries as UTC Date objects.
 * Returns the UTC range for the entire BRT month.
 */
function getBrtMonthBoundsUtc(month: number, year: number): { startDate: Date; endDate: Date } {
  // BRT first day 00:00 = UTC 03:00 of that day
  const startDate = new Date(Date.UTC(year, month - 1, 1, 3, 0, 0, 0));
  // BRT last day 23:59:59 = UTC next month 1st at 02:59:59
  const daysInMonth = new Date(year, month, 0).getDate();
  const endDate = new Date(Date.UTC(year, month - 1, daysInMonth + 1, 2, 59, 59, 999));
  return { startDate, endDate };
}

/**
 * Get the BRT month and year for a UTC date.
 */
function getBrtMonthYear(utcDate: Date): { month: number; year: number } {
  const brt = new Date(utcDate.getTime() + BRT_OFFSET_MS);
  return { month: brt.getUTCMonth() + 1, year: brt.getUTCFullYear() };
}

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

    // Export AFD from device.
    // Some firmware versions don't support export_afd.fcgi; fall back to access_logs.
    // AfdRecord extended with optional fields from access_logs path
    type ExtendedRecord = import('./control-id.service').AfdRecord & {
      accessLogId?: number;
      punchTimeUtc?: Date;
    };
    let records: ExtendedRecord[];
    let useAccessLogs = false;

    try {
      const afdText = await this.controlId.exportAfd(deviceId, initialDate, initialNsr);
      records = this.controlId.parseAfdRecords(afdText);
      this.logger.log(`Parsed ${records.length} AFD records from device ${device.name}`);
    } catch (afdError: any) {
      if (
        afdError.message?.includes('400') ||
        afdError.message?.toLowerCase().includes('invalid command')
      ) {
        // Device doesn't support AFD — fall back to access_logs via load_objects.fcgi
        this.logger.warn(
          `Device ${device.name} does not support export_afd.fcgi — using access_logs fallback`,
        );
        useAccessLogs = true;

        // Load device users to map user_id → registration (PIS)
        const deviceUsers = await this.controlId.loadUsers(deviceId);
        const userIdToReg: Record<number, string> = {};
        for (const u of deviceUsers) {
          if (u.id != null && u.registration) {
            userIdToReg[u.id] = u.registration;
          }
        }

        // Determine since which log ID to fetch (incremental)
        let sinceId: number | undefined;
        let sinceTime: number | undefined;
        if (lastRecord?.rawData && typeof lastRecord.rawData === 'object') {
          const raw = lastRecord.rawData as any;
          if (raw.accessLogId != null) {
            sinceId = (raw.accessLogId as number) + 1;
          }
        }
        if (sinceId === undefined && lastSync?.finishedAt) {
          // Convert last sync date to Unix timestamp BRT (subtract 3h to undo our +3h offset)
          sinceTime = Math.floor(lastSync.finishedAt.getTime() / 1000) - 3 * 3600;
        }

        const accessLogs = await this.controlId.getAccessLogs(deviceId, sinceId, sinceTime);
        this.logger.log(
          `Fetched ${accessLogs.length} access_logs from device ${device.name} (sinceId=${sinceId}, sinceTime=${sinceTime})`,
        );

        // Convert access_log entries to AfdRecord-like objects.
        // We store punchTimeUtc directly to avoid double-adding timezone offset later.
        records = accessLogs
          .filter((log: any) => log.user_id != null && log.time != null)
          .map((log: any) => {
            const registration = userIdToReg[log.user_id] || String(log.user_id);
            const punchDate = this.controlId.accessLogToUtcDate(log.time as number);

            return {
              nsr: String(log.id),
              type: '3',
              date: '',  // not used — punchTimeUtc below takes precedence
              time: '',  // not used
              pis: registration,
              raw: JSON.stringify(log),
              accessLogId: log.id as number,
              punchTimeUtc: punchDate,  // pre-computed UTC Date
            };
          });

        this.logger.log(
          `Converted ${records.length} access_logs to punch records for device ${device.name}`,
        );
      } else {
        throw afdError;
      }
    }

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
        // Use pre-computed UTC date (access_logs path) or convert from AFD ddmmyyyy/hhmm
        const punchTime: Date =
          (record as any).punchTimeUtc instanceof Date
            ? (record as any).punchTimeUtc
            : this.controlId.afdToUtcDate(record.date, record.time);

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
        const rawData: any = {
          nsr: record.nsr,
          pis: record.pis,
          originalDate: record.date,
          originalTime: record.time,
          raw: record.raw,
        };
        // Store access log ID for incremental sync on next run
        if ((record as any).accessLogId != null) {
          rawData.accessLogId = (record as any).accessLogId;
        }

        const rawPunch = await this.prisma.rawPunchEvent.create({
          data: {
            deviceId,
            employeeId,
            punchTime,
            source: 'DEVICE',
            rawData,
            importedAt: new Date(),
          },
        });

        // Create/re-normalize punches for this employee's BRT day
        if (employeeId) {
          const { dayStart, dayEnd } = getBrtDayBoundsUtc(punchTime);

          // Get ALL raw punch events for this employee on this BRT day
          const dayRawPunches = await this.prisma.rawPunchEvent.findMany({
            where: {
              employeeId,
              punchTime: { gte: dayStart, lte: dayEnd },
            },
            orderBy: { punchTime: 'asc' },
          });

          // Deduplicate: remove punches within 2 minutes of the previous one
          const deduped: typeof dayRawPunches = [];
          for (const rp of dayRawPunches) {
            if (deduped.length === 0) {
              deduped.push(rp);
            } else {
              const prev = deduped[deduped.length - 1];
              const diffSec = (rp.punchTime.getTime() - prev.punchTime.getTime()) / 1000;
              if (diffSec > 120) {
                deduped.push(rp);
              }
            }
          }

          // Cap at 4 punches per day
          const toNormalize = deduped.slice(0, 4);
          const dayTotal = toNormalize.length;

          // Smart punch type assignment based on total punches in the day:
          // 1 punch: ENTRY
          // 2 punches: ENTRY, EXIT
          // 3 punches: ENTRY, BREAK_START, EXIT
          // 4 punches: ENTRY, BREAK_START, BREAK_END, EXIT
          const typeMap: Record<number, string[]> = {
            1: ['ENTRY'],
            2: ['ENTRY', 'EXIT'],
            3: ['ENTRY', 'BREAK_START', 'EXIT'],
            4: ['ENTRY', 'BREAK_START', 'BREAK_END', 'EXIT'],
          };
          const types = typeMap[dayTotal] || typeMap[4];

          // Delete existing normalized punches for this day
          await this.prisma.normalizedPunch.deleteMany({
            where: {
              employeeId,
              punchTime: { gte: dayStart, lte: dayEnd },
            },
          });

          // Re-create with smart types
          for (let i = 0; i < toNormalize.length; i++) {
            const rp = toNormalize[i];
            await this.prisma.normalizedPunch.create({
              data: {
                rawPunchEventId: rp.id,
                employeeId,
                punchTime: rp.punchTime,
                originalTime: rp.punchTime,
                punchType: types[i] as any,
                status: 'NORMAL',
              },
            });
          }

          // Track affected employee/months for recalculation using BRT date
          const { month: brtMonth, year: brtYear } = getBrtMonthYear(punchTime);
          const monthKey = `${employeeId}:${brtMonth}:${brtYear}`;
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
   * Recalculate timesheets for a specific month/year for all active employees
   */
  async recalculateMonth(month: number, year: number): Promise<any> {
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
        this.logger.error(`Failed to recalculate for ${emp.name} ${month}/${year}: ${error.message}`);
      }
    }

    this.logger.log(`Recalculation ${month}/${year} complete: ${processed} processed, ${errors} errors`);
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

    // Get punches using BRT month boundaries
    // BRT first day 00:00 = UTC 03:00, BRT last day 23:59:59 = UTC next month 02:59:59
    const { startDate, endDate } = getBrtMonthBoundsUtc(month, year);

    const punches = await this.prisma.normalizedPunch.findMany({
      where: {
        employeeId,
        punchTime: { gte: startDate, lte: endDate },
      },
      orderBy: { punchTime: 'asc' },
    });

    // Holidays
    const holidays = await this.prisma.holiday.findMany({
      where: { date: { gte: new Date(Date.UTC(year, month - 1, 1)), lte: new Date(Date.UTC(year, month, 0)) } },
    });
    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

    // Group by BRT date (not UTC date!)
    const punchesByDate: Record<string, any[]> = {};
    for (const p of punches) {
      const dateStr = utcToBrtDateStr(p.punchTime);
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
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
