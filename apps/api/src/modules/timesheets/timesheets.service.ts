import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class TimesheetsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTimesheet(employeeId: string, month: number, year: number) {
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

    return timesheet;
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

    // Get all normalized punches for this employee in this month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

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
          gte: startDate,
          lte: endDate,
        },
      },
    });
    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

    // Group punches by date
    const punchesByDate: Record<string, any[]> = {};
    for (const p of punches) {
      const dateStr = p.punchTime.toISOString().split('T')[0];
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
      const date = new Date(year, month - 1, day);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 0=Sunday
      const dayPunches = punchesByDate[dateStr] || [];
      const scheduleEntry = scheduleByDay[dayOfWeek];
      const isHoliday = holidayDates.has(dateStr);
      const isWeekend = dayOfWeek === 0; // Sunday
      const isWorkDay = scheduleEntry?.isWorkDay && !isHoliday;

      let workedMinutes = 0;
      let breakMinutes = 0;
      let punchCount = dayPunches.length;
      let status = 'NORMAL';

      if (isHoliday) {
        status = 'HOLIDAY';
      } else if (!isWorkDay || isWeekend) {
        status = 'WEEKEND';
      }

      // Calculate worked time from punch pairs
      if (dayPunches.length >= 2) {
        const sorted = dayPunches.sort((a, b) => a.punchTime.getTime() - b.punchTime.getTime());

        // Find ENTRY/EXIT pairs
        let entryTime: Date | null = null;
        let breakStart: Date | null = null;

        for (const p of sorted) {
          if (p.punchType === 'ENTRY' && !entryTime) {
            entryTime = p.punchTime;
          } else if (p.punchType === 'BREAK_START' && entryTime) {
            if (breakStart === null) {
              // Time from entry to break start
              workedMinutes += Math.floor((p.punchTime.getTime() - entryTime.getTime()) / 60000);
              breakStart = p.punchTime;
              entryTime = null;
            }
          } else if (p.punchType === 'BREAK_END') {
            if (breakStart) {
              breakMinutes += Math.floor((p.punchTime.getTime() - breakStart.getTime()) / 60000);
              breakStart = null;
              entryTime = p.punchTime; // Resume counting from break end
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
        // Subtract scheduled break
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

      if (isWorkDay && expectedMinutes > 0) {
        if (workedMinutes > expectedMinutes) {
          overtimeMinutes = workedMinutes - expectedMinutes;
        } else if (workedMinutes < expectedMinutes && workedMinutes > 0) {
          absenceMinutes = expectedMinutes - workedMinutes;
        } else if (workedMinutes === 0 && punchCount === 0) {
          absenceMinutes = expectedMinutes;
          status = 'ABSENCE';
        }
      } else if (!isWorkDay && workedMinutes > 0) {
        // Working on non-work day = overtime
        overtimeMinutes = workedMinutes;
      }

      // Calculate night hours (22:00 - 05:00)
      let nightMinutes = 0;
      if (dayPunches.length >= 2) {
        for (const p of dayPunches) {
          const hour = p.punchTime.getHours();
          if (hour >= 22 || hour < 5) {
            nightMinutes += 1; // approximate - count each punch in night period
          }
        }
        // Better approximation: if any work spans night hours
        const sorted = dayPunches.sort((a, b) => a.punchTime.getTime() - b.punchTime.getTime());
        const firstHour = sorted[0].punchTime.getHours();
        const lastHour = sorted[sorted.length - 1].punchTime.getHours();
        if (firstHour < 5 || lastHour >= 22) {
          nightMinutes = Math.min(workedMinutes, 60); // Cap at 60 minutes for night approximation
        } else {
          nightMinutes = 0;
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
