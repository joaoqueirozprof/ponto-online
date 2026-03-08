import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEmployeeReport(employeeId: string, month: number, year: number) {
    month = Number(month);
    year = Number(year);

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        branch: true,
        schedule: { include: { scheduleEntries: true } },
      },
    });

    let timesheet = await this.prisma.timesheet.findUnique({
      where: {
        employeeId_month_year: {
          employeeId,
          month,
          year,
        },
      },
      include: {
        timesheetDays: {
          orderBy: { date: 'asc' },
        },
      },
    });

    // Get all punches for this employee in the month for daily detail
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

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

    // Group punches by date
    const punchesByDate: Record<string, Array<{ time: string; type: string; status: string }>> = {};
    for (const punch of monthPunches) {
      const dateKey = punch.punchTime.toISOString().split('T')[0];
      if (!punchesByDate[dateKey]) {
        punchesByDate[dateKey] = [];
      }
      punchesByDate[dateKey].push({
        time: punch.punchTime.toISOString(),
        type: punch.punchType,
        status: punch.status,
      });
    }

    // If timesheet has no days, generate virtual days from the month calendar + punchesByDate
    if (!timesheet || !timesheet.timesheetDays || timesheet.timesheetDays.length === 0) {
      const daysInMonth = new Date(year, month, 0).getDate();
      const virtualDays: any[] = [];
      let totalWorked = 0;
      let totalOvertime = 0;

      // Get employee schedule for determining work days
      const scheduleByDay: Record<number, any> = {};
      if (employee?.schedule?.scheduleEntries) {
        for (const entry of employee.schedule.scheduleEntries) {
          scheduleByDay[entry.dayOfWeek] = entry;
        }
      }

      // Get holidays for this month
      const holidays = await this.prisma.holiday.findMany({
        where: { date: { gte: startDate, lte: endDate } },
      });
      const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dateStr = date.toISOString().split('T')[0];
        const dayOfWeek = date.getDay();
        const dayPunches = punchesByDate[dateStr] || [];
        const scheduleEntry = scheduleByDay[dayOfWeek];
        const isHoliday = holidayDates.has(dateStr);
        const isWorkDay = scheduleEntry?.isWorkDay && !isHoliday;

        let workedMinutes = 0;
        let status = 'NORMAL';
        if (isHoliday) status = 'HOLIDAY';
        else if (!isWorkDay || dayOfWeek === 0) status = 'WEEKEND';

        // Calculate worked time from punch pairs
        if (dayPunches.length >= 2) {
          const sorted = [...dayPunches].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
          let entryTime: number | null = null;
          for (const p of sorted) {
            const t = new Date(p.time).getTime();
            if (p.type === 'ENTRY' && !entryTime) {
              entryTime = t;
            } else if (p.type === 'BREAK_START' && entryTime) {
              workedMinutes += Math.floor((t - entryTime) / 60000);
              entryTime = null;
            } else if (p.type === 'BREAK_END') {
              entryTime = t;
            } else if (p.type === 'EXIT' && entryTime) {
              workedMinutes += Math.floor((t - entryTime) / 60000);
              entryTime = null;
            }
          }
          if (entryTime && sorted.length > 0) {
            const lastT = new Date(sorted[sorted.length - 1].time).getTime();
            if (lastT !== entryTime) workedMinutes += Math.floor((lastT - entryTime) / 60000);
          }
        } else if (dayPunches.length === 1) {
          status = 'INCOMPLETE';
        } else if (isWorkDay && new Date(date) <= new Date()) {
          status = 'ABSENCE';
        }

        // Only include days up to today
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
          if (isWorkDay && expectedMinutes > 0) {
            if (workedMinutes > expectedMinutes) overtimeMinutes = workedMinutes - expectedMinutes;
            else if (workedMinutes < expectedMinutes && workedMinutes > 0) absenceMinutes = expectedMinutes - workedMinutes;
            else if (workedMinutes === 0 && dayPunches.length === 0) absenceMinutes = expectedMinutes;
          } else if (!isWorkDay && workedMinutes > 0) {
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
          });
        }
      }

      const virtualTimesheet = timesheet ? {
        ...timesheet,
        timesheetDays: virtualDays,
        totalWorkedMinutes: totalWorked,
        totalOvertimeMinutes: totalOvertime,
        totalAbsenceMinutes: virtualDays.reduce((s, d) => s + (d.absenceMinutes || 0), 0),
      } : {
        id: 'virtual',
        month,
        year,
        status: 'OPEN',
        totalWorkedMinutes: totalWorked,
        totalOvertimeMinutes: totalOvertime,
        totalNightMinutes: 0,
        totalAbsenceMinutes: virtualDays.reduce((s, d) => s + (d.absenceMinutes || 0), 0),
        totalLateMinutes: 0,
        totalBalanceMinutes: totalWorked,
        timesheetDays: virtualDays,
      };

      return {
        employee,
        timesheet: virtualTimesheet,
        punchesByDate,
      };
    }

    return {
      employee,
      timesheet,
      punchesByDate,
    };
  }

  async getBranchReport(branchId: string, month: number, year: number) {
    month = Number(month);
    year = Number(year);

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      include: { company: true },
    });

    const employees = await this.prisma.employee.findMany({
      where: { branchId, isActive: true },
      select: { id: true, name: true, cpf: true, position: true, department: true },
    });

    const timesheets = await this.prisma.timesheet.findMany({
      where: {
        employee: { branchId },
        month,
        year,
      },
      include: {
        employee: {
          select: { id: true, name: true, cpf: true, position: true, department: true },
        },
      },
    });

    const summary = {
      totalEmployees: employees.length,
      processedTimesheets: timesheets.length,
      approvedTimesheets: timesheets.filter((t) => t.status === 'APPROVED').length,
      averageWorkedHours: this.calculateAverageHours(timesheets),
      totalOvertimeHours: this.calculateTotalOvertime(timesheets),
      totalLateMinutes: timesheets.reduce((sum, ts) => sum + ts.totalLateMinutes, 0),
      totalAbsenceMinutes: timesheets.reduce((sum, ts) => sum + ts.totalAbsenceMinutes, 0),
      totalNightMinutes: timesheets.reduce((sum, ts) => sum + ts.totalNightMinutes, 0),
    };

    return {
      branch: branch || branchId,
      month,
      year,
      summary,
      timesheets,
    };
  }

  async getPayrollReport(branchId: string, month: number, year: number) {
    month = Number(month);
    year = Number(year);

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      include: { company: true },
    });

    const timesheets = await this.prisma.timesheet.findMany({
      where: {
        employee: { branchId },
        month,
        year,
        status: { in: ['CALCULATED', 'APPROVED', 'CLOSED'] },
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            cpf: true,
            pis: true,
            position: true,
            department: true,
          },
        },
      },
    });

    const payrollData = timesheets.map((ts) => ({
      employee: ts.employee,
      workedMinutes: ts.totalWorkedMinutes,
      workedHours: (ts.totalWorkedMinutes / 60).toFixed(2),
      overtimeMinutes: ts.totalOvertimeMinutes,
      overtimeHours: (ts.totalOvertimeMinutes / 60).toFixed(2),
      nightMinutes: ts.totalNightMinutes,
      nightHours: (ts.totalNightMinutes / 60).toFixed(2),
      lateMinutes: ts.totalLateMinutes,
      absenceMinutes: ts.totalAbsenceMinutes,
      balanceMinutes: ts.totalBalanceMinutes,
    }));

    return {
      branch: branch || branchId,
      month,
      year,
      totalProcessed: timesheets.length,
      payrollData,
    };
  }

  private calculateAverageHours(timesheets: any[]): number {
    if (timesheets.length === 0) return 0;
    const total = timesheets.reduce((sum, ts) => sum + ts.totalWorkedMinutes, 0);
    return Math.round((total / timesheets.length / 60) * 100) / 100;
  }

  private calculateTotalOvertime(timesheets: any[]): number {
    const total = timesheets.reduce((sum, ts) => sum + ts.totalOvertimeMinutes, 0);
    return Math.round((total / 60) * 100) / 100;
  }
}
