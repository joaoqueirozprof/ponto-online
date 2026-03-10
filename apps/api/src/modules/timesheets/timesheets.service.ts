import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/** BRT offset in milliseconds (UTC-3) */
const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;

/**
 * Convert a UTC Date to a BRT (UTC-3) date string YYYY-MM-DD.
 */
function utcToBrtDateStr(utcDate: Date): string {
  const brt = new Date(utcDate.getTime() + BRT_OFFSET_MS);
  return brt.toISOString().split('T')[0];
}

/**
 * Get BRT month boundaries as UTC Date objects.
 * BRT first day 00:00 = UTC 03:00, BRT last day 23:59:59 = UTC next month 02:59:59
 */
function getBrtMonthBoundsUtc(month: number, year: number): { startDate: Date; endDate: Date } {
  const startDate = new Date(Date.UTC(year, month - 1, 1, 3, 0, 0, 0));
  const daysInMonth = new Date(year, month, 0).getDate();
  const endDate = new Date(Date.UTC(year, month - 1, daysInMonth + 1, 2, 59, 59, 999));
  return { startDate, endDate };
}

/**
 * Get BRT hour from a UTC Date (for night-hour detection).
 */
function getBrtHour(utcDate: Date): number {
  const brt = new Date(utcDate.getTime() + BRT_OFFSET_MS);
  return brt.getUTCHours();
}

@Injectable()
export class TimesheetsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTimesheet(employeeId: string, month: number, year: number) {
    month = Number(month);
    year = Number(year);

    let timesheet: any = await this.prisma.timesheet.findUnique({
      where: {
        employeeId_month_year: {
          employeeId,
          month,
          year,
        },
      },
      include: {
        timesheetDays: {
          include: {
            scheduleEntry: true,
          },
          orderBy: { date: 'asc' },
        },
        employee: {
          select: { id: true, name: true, cpf: true },
        },
      },
    });

    if (!timesheet) {
      timesheet = await this.createEmptyTimesheet(employeeId, month, year);
    }

    // Fetch punches for the month using BRT boundaries
    const { startDate, endDate } = getBrtMonthBoundsUtc(month, year);

    const monthPunches = await this.prisma.normalizedPunch.findMany({
      where: {
        employeeId,
        punchTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { punchTime: 'asc' },
    });

    // Group punches by BRT date (not UTC!)
    const punchesByDate: Record<string, Array<{ time: string; type: string; status: string }>> = {};
    for (const punch of monthPunches) {
      const dateKey = utcToBrtDateStr(punch.punchTime);
      if (!punchesByDate[dateKey]) {
        punchesByDate[dateKey] = [];
      }
      punchesByDate[dateKey].push({
        time: punch.punchTime.toISOString(),
        type: punch.punchType,
        status: punch.status,
      });
    }

    // If no timesheetDays, generate virtual days from calendar + punchesByDate
    if (!timesheet.timesheetDays || timesheet.timesheetDays.length === 0) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: employeeId },
        include: { schedule: { include: { scheduleEntries: true } } },
      });

      const scheduleByDay: Record<number, any> = {};
      if (employee?.schedule?.scheduleEntries) {
        for (const entry of employee.schedule.scheduleEntries) {
          scheduleByDay[entry.dayOfWeek] = entry;
        }
      }

      const holidays = await this.prisma.holiday.findMany({
        where: { date: { gte: new Date(Date.UTC(year, month - 1, 1)), lte: new Date(Date.UTC(year, month, 0)) } },
      });
      const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

      const daysInMonth = new Date(year, month, 0).getDate();
      const virtualDays: any[] = [];
      let totalWorked = 0;
      let totalOvertime = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(Date.UTC(year, month - 1, day));
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayOfWeek = new Date(year, month - 1, day).getDay();
        const dayPunches = punchesByDate[dateStr] || [];
        const scheduleEntry = scheduleByDay[dayOfWeek];
        const isHoliday = holidayDates.has(dateStr);
        const isWorkDay = scheduleEntry?.isWorkDay && !isHoliday;
        const isSunday = dayOfWeek === 0;
        const hasPunchesOnDay = dayPunches.length >= 2;
        const treatAsWorkDay = isWorkDay || (isSunday && hasPunchesOnDay);

        let workedMinutes = 0;
        let status = 'NORMAL';
        if (isHoliday) status = 'HOLIDAY';
        else if (!treatAsWorkDay && !hasPunchesOnDay) status = 'WEEKEND';

        if (dayPunches.length >= 2) {
          const sorted = [...dayPunches].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
          let entryTime: number | null = null;
          for (const p of sorted) {
            const t = new Date(p.time).getTime();
            if (p.type === 'ENTRY' && !entryTime) entryTime = t;
            else if (p.type === 'BREAK_START' && entryTime) { workedMinutes += Math.floor((t - entryTime) / 60000); entryTime = null; }
            else if (p.type === 'BREAK_END') entryTime = t;
            else if (p.type === 'EXIT' && entryTime) { workedMinutes += Math.floor((t - entryTime) / 60000); entryTime = null; }
          }
          if (entryTime && sorted.length > 0) {
            const lastT = new Date(sorted[sorted.length - 1].time).getTime();
            if (lastT !== entryTime) workedMinutes += Math.floor((lastT - entryTime) / 60000);
          }
        } else if (dayPunches.length === 1) {
          status = 'INCOMPLETE';
        } else if (isWorkDay && date <= new Date()) {
          status = 'ABSENCE';
        }

        if (date <= new Date()) {
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
          let overtimeMinutes = 0;
          let absenceMinutes = 0;
          if (treatAsWorkDay && expectedMinutes > 0) {
            if (workedMinutes > expectedMinutes) overtimeMinutes = workedMinutes - expectedMinutes;
            else if (workedMinutes < expectedMinutes && workedMinutes > 0) absenceMinutes = expectedMinutes - workedMinutes;
            else if (workedMinutes === 0 && dayPunches.length === 0) absenceMinutes = expectedMinutes;
          } else if (isSunday && hasPunchesOnDay && expectedMinutes === 0) {
            // Sunday without schedule: count hours as normal work, no overtime
          } else if (!treatAsWorkDay && workedMinutes > 0) {
            overtimeMinutes = workedMinutes;
          }
          totalWorked += workedMinutes;
          totalOvertime += overtimeMinutes;

          virtualDays.push({
            id: `virtual-${dateStr}`,
            date: date.toISOString(),
            dayOfWeek,
            workedMinutes,
            overtimeMinutes,
            nightMinutes: 0,
            lateMinutes: 0,
            absenceMinutes,
            breakMinutes: 0,
            punchCount: dayPunches.length,
            status,
            notes: null,
            scheduleEntry: scheduleEntry || null,
          });
        }
      }

      return {
        ...timesheet,
        timesheetDays: virtualDays,
        totalWorkedMinutes: totalWorked,
        totalOvertimeMinutes: totalOvertime,
        totalAbsenceMinutes: virtualDays.reduce((s: number, d: any) => s + (d.absenceMinutes || 0), 0),
        punchesByDate,
      };
    }

    return {
      ...timesheet,
      punchesByDate,
    };
  }

  async createEmptyTimesheet(employeeId: string, month: number, year: number) {
    return this.prisma.timesheet.create({
      data: {
        employeeId,
        month,
        year,
        status: 'OPEN',
      },
      include: {
        employee: true,
      },
    });
  }

  async calculateTimesheet(employeeId: string, month: number, year: number) {
    month = Number(month);
    year = Number(year);

    // Get employee with schedule
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        schedule: {
          include: { scheduleEntries: true },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee ${employeeId} not found`);
    }

    // Get or create timesheet
    let timesheet = await this.prisma.timesheet.findUnique({
      where: {
        employeeId_month_year: { employeeId, month, year },
      },
    });

    if (!timesheet) {
      timesheet = await this.prisma.timesheet.create({
        data: { employeeId, month, year, status: 'OPEN' },
      });
    }

    // Delete existing timesheet days for recalculation
    await this.prisma.timesheetDay.deleteMany({
      where: { timesheetId: timesheet.id },
    });

    // Get all normalized punches using BRT month boundaries
    const { startDate, endDate } = getBrtMonthBoundsUtc(month, year);

    const punches = await this.prisma.normalizedPunch.findMany({
      where: {
        employeeId,
        punchTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { punchTime: 'asc' },
    });

    // Get holidays for this month
    const holidays = await this.prisma.holiday.findMany({
      where: {
        date: {
          gte: new Date(Date.UTC(year, month - 1, 1)),
          lte: new Date(Date.UTC(year, month, 0)),
        },
      },
    });
    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

    // Group punches by BRT date (not UTC!)
    const punchesByDate: Record<string, any[]> = {};
    for (const p of punches) {
      const dateStr = utcToBrtDateStr(p.punchTime);
      if (!punchesByDate[dateStr]) {
        punchesByDate[dateStr] = [];
      }
      punchesByDate[dateStr].push(p);
    }

    // Build schedule entries map by day of week (0=Sunday, 1=Monday, etc.)
    const scheduleByDay: Record<number, any> = {};
    if (employee.schedule?.scheduleEntries) {
      for (const entry of employee.schedule.scheduleEntries) {
        scheduleByDay[entry.dayOfWeek] = entry;
      }
    }

    // Calculate for each day of the month
    const daysInMonth = new Date(year, month, 0).getDate();
    const timesheetDays: any[] = [];
    let totalWorked = 0;
    let totalOvertime = 0;
    let totalNight = 0;
    let totalAbsence = 0;
    let totalLate = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, month - 1, day));
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month - 1, day).getDay(); // 0=Sunday
      const dayPunches = punchesByDate[dateStr] || [];
      const scheduleEntry = scheduleByDay[dayOfWeek];
      const isHoliday = holidayDates.has(dateStr);
      const isWorkDay = scheduleEntry?.isWorkDay && !isHoliday;
      // Sunday: if isWorkDay is true in schedule, treat as normal work day.
      // If isWorkDay is false but employee has punches, treat as normal work day (domingo caso a parte).
      const isSunday = dayOfWeek === 0;
      const hasPunchesOnDay = dayPunches.length >= 2;
      const treatAsWorkDay = isWorkDay || (isSunday && hasPunchesOnDay);

      let workedMinutes = 0;
      let breakMinutes = 0;
      let punchCount = dayPunches.length;
      let status = 'NORMAL';

      if (isHoliday) {
        status = 'HOLIDAY';
      } else if (!treatAsWorkDay && !hasPunchesOnDay) {
        status = 'WEEKEND';
      }

      // Calculate worked time from punch pairs
      if (dayPunches.length >= 2) {
        const sorted = [...dayPunches].sort((a, b) => a.punchTime.getTime() - b.punchTime.getTime());

        // Find ENTRY/EXIT pairs
        let entryTime: Date | null = null;
        let breakStart: Date | null = null;

        for (const p of sorted) {
          if (p.punchType === 'ENTRY' && !entryTime) {
            entryTime = p.punchTime;
          } else if (p.punchType === 'BREAK_START' && entryTime) {
            if (breakStart === null) {
              workedMinutes += Math.floor((p.punchTime.getTime() - entryTime.getTime()) / 60000);
              breakStart = p.punchTime;
              entryTime = null;
            }
          } else if (p.punchType === 'BREAK_END') {
            if (breakStart) {
              breakMinutes += Math.floor((p.punchTime.getTime() - breakStart.getTime()) / 60000);
              breakStart = null;
              entryTime = p.punchTime;
            }
          } else if (p.punchType === 'EXIT' && entryTime) {
            workedMinutes += Math.floor((p.punchTime.getTime() - entryTime.getTime()) / 60000);
            entryTime = null;
          }
        }

        // If still have an open entry (no exit), count up to last punch
        if (entryTime && sorted.length > 0) {
          const lastPunch = sorted[sorted.length - 1];
          if (lastPunch.punchTime.getTime() !== entryTime.getTime()) {
            workedMinutes += Math.floor((lastPunch.punchTime.getTime() - entryTime.getTime()) / 60000);
          }
        }
      } else if (dayPunches.length === 1) {
        status = 'INCOMPLETE';
      }

      // Calculate expected work time from schedule
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

      // Calculate overtime and absence
      let overtimeMinutes = 0;
      let absenceMinutes = 0;
      let lateMinutes = 0;

      if (treatAsWorkDay && expectedMinutes > 0) {
        if (workedMinutes > expectedMinutes) {
          overtimeMinutes = workedMinutes - expectedMinutes;
        } else if (workedMinutes < expectedMinutes && workedMinutes > 0) {
          absenceMinutes = expectedMinutes - workedMinutes;
        } else if (workedMinutes === 0 && punchCount === 0) {
          absenceMinutes = expectedMinutes;
          status = 'ABSENCE';
        }
      } else if (isSunday && hasPunchesOnDay && expectedMinutes === 0) {
        // Sunday without schedule entry: count worked hours as normal (not overtime)
        // The hours are simply recorded as worked time
      } else if (!treatAsWorkDay && workedMinutes > 0) {
        overtimeMinutes = workedMinutes;
      }

      // Calculate night hours (22:00 - 05:00 BRT)
      let nightMinutes = 0;
      if (dayPunches.length >= 2) {
        const sorted = [...dayPunches].sort((a, b) => a.punchTime.getTime() - b.punchTime.getTime());
        const firstBrtHour = getBrtHour(sorted[0].punchTime);
        const lastBrtHour = getBrtHour(sorted[sorted.length - 1].punchTime);
        if (firstBrtHour < 5 || lastBrtHour >= 22) {
          nightMinutes = Math.min(workedMinutes, 60);
        }
      }

      // Only create day if it's in the past or today
      const today = new Date();
      if (date <= today) {
        timesheetDays.push({
          timesheetId: timesheet.id,
          scheduleEntryId: scheduleEntry?.id || null,
          date,
          workedMinutes,
          overtimeMinutes,
          nightMinutes,
          lateMinutes,
          absenceMinutes,
          breakMinutes,
          punchCount,
          status: status as any,
        });

        totalWorked += workedMinutes;
        totalOvertime += overtimeMinutes;
        totalNight += nightMinutes;
        totalAbsence += absenceMinutes;
        totalLate += lateMinutes;
      }
    }

    // Create all timesheet days
    if (timesheetDays.length > 0) {
      await this.prisma.timesheetDay.createMany({
        data: timesheetDays,
      });
    }

    // Update timesheet totals
    const updated = await this.prisma.timesheet.update({
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
      include: {
        timesheetDays: { orderBy: { date: 'asc' } },
        employee: { select: { id: true, name: true, cpf: true } },
      },
    });

    return updated;
  }

  async calculateBatch(month: number, year: number, branchId?: string) {
    month = Number(month);
    year = Number(year);

    const where: any = { isActive: true };
    if (branchId) where.branchId = branchId;

    const employees = await this.prisma.employee.findMany({
      where,
      select: { id: true, name: true },
    });

    let processed = 0;
    let errors = 0;
    const results: any[] = [];

    for (const emp of employees) {
      try {
        await this.calculateTimesheet(emp.id, month, year);
        processed++;
      } catch (e: any) {
        errors++;
        results.push({ employeeId: emp.id, name: emp.name, error: e.message });
      }
    }

    return {
      processed,
      errors,
      total: employees.length,
      message: `${processed} folhas calculadas, ${errors} erros`,
      errorDetails: results,
    };
  }

  async listTimesheets(branchId?: string, skip: any = 0, take: any = 10, search?: string, month?: number, year?: number, status?: string) {
    skip = Number(skip) || 0;
    take = Number(take) || 10;
    const where: any = {};
    if (branchId) {
      where.employee = {
        branchId,
      };
    }
    if (search) {
      where.employee = {
        ...where.employee,
        name: { contains: search, mode: 'insensitive' },
      };
    }
    if (month) {
      where.month = Number(month);
    }
    if (year) {
      where.year = Number(year);
    }
    if (status) {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      this.prisma.timesheet.findMany({
        where,
        skip,
        take,
        include: {
          employee: {
            select: { id: true, name: true, cpf: true, branch: { select: { id: true, name: true } } },
          },
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { employee: { name: 'asc' } }],
      }),
      this.prisma.timesheet.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async updateTimesheetStatus(timesheetId: string, status: string) {
    const timesheet = await this.prisma.timesheet.findUnique({
      where: { id: timesheetId },
    });

    if (!timesheet) {
      throw new NotFoundException(`Timesheet with ID ${timesheetId} not found`);
    }

    return this.prisma.timesheet.update({
      where: { id: timesheetId },
      data: {
        status: status as any,
        ...(status === 'CALCULATED' && { calculatedAt: new Date() }),
        ...(status === 'APPROVED' && { approvedAt: new Date() }),
      },
    });
  }

  async approveTimesheet(timesheetId: string, userId: string) {
    const timesheet = await this.prisma.timesheet.findUnique({
      where: { id: timesheetId },
    });

    if (!timesheet) {
      throw new NotFoundException(`Timesheet with ID ${timesheetId} not found`);
    }

    return this.prisma.timesheet.update({
      where: { id: timesheetId },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date(),
      },
      include: {
        employee: true,
        approver: true,
      },
    });
  }

  async batchApproveTimesheets(ids: string[], userId: string) {
    if (!ids || ids.length === 0) {
      return { approved: 0, message: 'Nenhuma folha de ponto selecionada' };
    }

    const result = await this.prisma.timesheet.updateMany({
      where: {
        id: { in: ids },
        status: { not: 'APPROVED' as any },
      },
      data: {
        status: 'APPROVED' as any,
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });

    return { approved: result.count, message: `${result.count} folhas de ponto aprovadas com sucesso` };
  }

  async getTimeBalance(employeeId: string, month: number, year: number) {
    let balance = await this.prisma.timeBalance.findUnique({
      where: {
        employeeId_month_year: {
          employeeId,
          month,
          year,
        },
      },
    });

    if (!balance) {
      balance = await this.prisma.timeBalance.create({
        data: {
          employeeId,
          month,
          year,
          previousBalance: 0,
          currentBalance: 0,
        },
      });
    }

    return balance;
  }
}
