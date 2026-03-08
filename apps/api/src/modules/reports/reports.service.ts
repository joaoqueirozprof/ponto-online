import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

interface DayCalc {
  date: string;
  dayOfWeek: number;
  workedMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
  lateMinutes: number;
  absenceMinutes: number;
  breakMinutes: number;
  punchCount: number;
  status: string;
  notes: string | null;
  punches: { time: string; type: string; status: string }[];
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Shared helper: calculate daily data from actual normalized punches for an employee in a given month.
   * This ensures consistency across all 3 reports.
   */
  private async calculateEmployeeMonth(
    employeeId: string,
    month: number,
    year: number,
  ): Promise<{
    days: DayCalc[];
    punchesByDate: Record<string, Array<{ time: string; type: string; status: string }>>;
    totalWorkedMinutes: number;
    totalOvertimeMinutes: number;
    totalNightMinutes: number;
    totalLateMinutes: number;
    totalAbsenceMinutes: number;
    totalBalanceMinutes: number;
  }> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    const daysInMonth = new Date(year, month, 0).getDate();

    // Get employee with schedule
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { schedule: { include: { scheduleEntries: true } } },
    });

    // Get all normalized punches for this employee in the month
    const monthPunches = await this.prisma.normalizedPunch.findMany({
      where: {
        employeeId,
        punchTime: { gte: startDate, lte: endDate },
        status: { not: 'DELETED' as any },
      },
      orderBy: { punchTime: 'asc' },
    });

    // Group punches by date
    const punchesByDate: Record<string, Array<{ time: string; type: string; status: string }>> = {};
    for (const punch of monthPunches) {
      // Use Fortaleza timezone for date key
      const punchDate = new Date(punch.punchTime);
      const brDate = new Date(punchDate.getTime() - 3 * 60 * 60 * 1000); // UTC-3
      const dateKey = brDate.toISOString().split('T')[0];
      if (!punchesByDate[dateKey]) punchesByDate[dateKey] = [];
      punchesByDate[dateKey].push({
        time: punch.punchTime.toISOString(),
        type: punch.punchType,
        status: punch.status,
      });
    }

    // Build schedule map
    const scheduleByDay: Record<number, any> = {};
    if (employee?.schedule?.scheduleEntries) {
      for (const entry of employee.schedule.scheduleEntries) {
        scheduleByDay[entry.dayOfWeek] = entry;
      }
    }

    // Get holidays
    const holidays = await this.prisma.holiday.findMany({
      where: { date: { gte: startDate, lte: endDate } },
    });
    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

    const days: DayCalc[] = [];
    let totalWorked = 0;
    let totalOvertime = 0;
    let totalLate = 0;
    let totalAbsence = 0;
    let totalNight = 0;
    const today = new Date();

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
        // If still tracking (entry without exit), use last punch time
        if (entryTime && sorted.length > 0) {
          const lastT = new Date(sorted[sorted.length - 1].time).getTime();
          if (lastT !== entryTime) workedMinutes += Math.floor((lastT - entryTime) / 60000);
        }
      } else if (dayPunches.length === 1) {
        status = isWorkDay ? 'INCOMPLETE' : status;
      } else if (isWorkDay && date <= today) {
        status = 'ABSENCE';
      }

      // Only count days up to today
      if (date <= today) {
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
        let lateMinutes = 0;

        if (isWorkDay && expectedMinutes > 0) {
          if (workedMinutes > expectedMinutes) {
            overtimeMinutes = workedMinutes - expectedMinutes;
          } else if (workedMinutes < expectedMinutes && workedMinutes > 0) {
            absenceMinutes = expectedMinutes - workedMinutes;
            // Check late arrival
            if (dayPunches.length > 0 && scheduleEntry.startTime) {
              const entry = dayPunches.find(p => p.type === 'ENTRY');
              if (entry) {
                const entryDate = new Date(entry.time);
                const [sh, sm] = scheduleEntry.startTime.split(':').map(Number);
                const schedStart = new Date(date);
                schedStart.setHours(sh + 3, sm, 0, 0); // UTC offset
                const diff = Math.floor((entryDate.getTime() - schedStart.getTime()) / 60000);
                if (diff > 5) lateMinutes = diff; // 5 min tolerance
              }
            }
          } else if (workedMinutes === 0 && dayPunches.length === 0) {
            absenceMinutes = expectedMinutes;
          }
        } else if (!isWorkDay && workedMinutes > 0) {
          overtimeMinutes = workedMinutes;
        }

        // Night hours (22:00 - 05:00)
        let nightMinutes = 0;
        if (dayPunches.length >= 2) {
          const sorted = [...dayPunches].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
          for (let i = 0; i < sorted.length - 1; i += 2) {
            const start = new Date(sorted[i].time);
            const end = sorted[i + 1] ? new Date(sorted[i + 1].time) : start;
            const startH = start.getHours() - 3; // UTC-3
            const endH = end.getHours() - 3;
            if (startH >= 22 || startH < 5 || endH >= 22 || endH < 5) {
              // Simplified night calculation
              const diffMin = Math.floor((end.getTime() - start.getTime()) / 60000);
              if (startH >= 22 || startH < 5) nightMinutes += Math.min(diffMin, 60);
            }
          }
        }

        totalWorked += workedMinutes;
        totalOvertime += overtimeMinutes;
        totalLate += lateMinutes;
        totalAbsence += absenceMinutes;
        totalNight += nightMinutes;

        days.push({
          date: date.toISOString(),
          dayOfWeek,
          workedMinutes,
          overtimeMinutes,
          nightMinutes,
          lateMinutes,
          absenceMinutes,
          breakMinutes: 0,
          punchCount: dayPunches.length,
          status,
          notes: null,
          punches: dayPunches,
        });
      }
    }

    return {
      days,
      punchesByDate,
      totalWorkedMinutes: totalWorked,
      totalOvertimeMinutes: totalOvertime,
      totalNightMinutes: totalNight,
      totalLateMinutes: totalLate,
      totalAbsenceMinutes: totalAbsence,
      totalBalanceMinutes: totalWorked - totalAbsence,
    };
  }

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

    // Always calculate from actual punches for consistency
    const calc = await this.calculateEmployeeMonth(employeeId, month, year);

    // Get stored timesheet for status info only
    const storedTimesheet = await this.prisma.timesheet.findUnique({
      where: {
        employeeId_month_year: { employeeId, month, year },
      },
    });

    const timesheet = {
      id: storedTimesheet?.id || 'calculated',
      month,
      year,
      status: storedTimesheet?.status || 'OPEN',
      totalWorkedMinutes: calc.totalWorkedMinutes,
      totalOvertimeMinutes: calc.totalOvertimeMinutes,
      totalNightMinutes: calc.totalNightMinutes,
      totalAbsenceMinutes: calc.totalAbsenceMinutes,
      totalLateMinutes: calc.totalLateMinutes,
      totalBalanceMinutes: calc.totalBalanceMinutes,
      timesheetDays: calc.days,
    };

    // Calculate expected hours for the month
    let expectedMonthMinutes = 0;
    if (employee?.schedule?.scheduleEntries) {
      for (const day of calc.days) {
        const entry = employee.schedule.scheduleEntries.find(
          (e) => e.dayOfWeek === day.dayOfWeek && e.isWorkDay,
        );
        if (entry?.startTime && entry?.endTime) {
          const [sh, sm] = entry.startTime.split(':').map(Number);
          const [eh, em] = entry.endTime.split(':').map(Number);
          let expected = (eh * 60 + em) - (sh * 60 + sm);
          if (entry.breakStartTime && entry.breakEndTime) {
            const [bsh, bsm] = entry.breakStartTime.split(':').map(Number);
            const [beh, bem] = entry.breakEndTime.split(':').map(Number);
            expected -= (beh * 60 + bem) - (bsh * 60 + bsm);
          }
          if (day.status !== 'HOLIDAY' && day.status !== 'WEEKEND') {
            expectedMonthMinutes += expected;
          }
        }
      }
    }

    return {
      employee,
      timesheet,
      punchesByDate: calc.punchesByDate,
      expectedMonthMinutes,
      daysWorked: calc.days.filter(d => d.workedMinutes > 0).length,
      daysAbsent: calc.days.filter(d => d.status === 'ABSENCE').length,
      daysIncomplete: calc.days.filter(d => d.status === 'INCOMPLETE').length,
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
      include: {
        schedule: { include: { scheduleEntries: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Calculate from actual punches for each employee
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Batch get all punches for the branch
    const allPunches = await this.prisma.normalizedPunch.findMany({
      where: {
        employee: { branchId },
        punchTime: { gte: startDate, lte: endDate },
        status: { not: 'DELETED' as any },
      },
      orderBy: { punchTime: 'asc' },
    });

    // Group punches by employee
    const punchesByEmployee: Record<string, any[]> = {};
    for (const punch of allPunches) {
      if (!punchesByEmployee[punch.employeeId]) punchesByEmployee[punch.employeeId] = [];
      punchesByEmployee[punch.employeeId].push(punch);
    }

    // Get holidays
    const holidays = await this.prisma.holiday.findMany({
      where: { date: { gte: startDate, lte: endDate } },
    });
    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

    // Get stored timesheets for status info
    const storedTimesheets = await this.prisma.timesheet.findMany({
      where: {
        employee: { branchId },
        month,
        year,
      },
    });
    const tsMap = new Map(storedTimesheets.map(t => [t.employeeId, t]));

    const employeeResults: any[] = [];
    let totalWorked = 0;
    let totalOvertime = 0;
    let totalLate = 0;
    let totalAbsence = 0;
    let totalNight = 0;

    for (const emp of employees) {
      const hasPunches = !!punchesByEmployee[emp.id]?.length;
      const calc = await this.calculateEmployeeMonth(emp.id, month, year);
      const stored = tsMap.get(emp.id);

      employeeResults.push({
        employee: {
          id: emp.id,
          name: emp.name,
          cpf: emp.cpf,
          position: emp.position,
          department: emp.department,
        },
        totalWorkedMinutes: calc.totalWorkedMinutes,
        totalOvertimeMinutes: calc.totalOvertimeMinutes,
        totalNightMinutes: calc.totalNightMinutes,
        totalLateMinutes: calc.totalLateMinutes,
        totalAbsenceMinutes: calc.totalAbsenceMinutes,
        totalBalanceMinutes: calc.totalBalanceMinutes,
        status: stored?.status || 'OPEN',
        hasPunches,
        daysWorked: calc.days.filter(d => d.workedMinutes > 0).length,
        daysAbsent: calc.days.filter(d => d.status === 'ABSENCE').length,
        punchCount: punchesByEmployee[emp.id]?.length || 0,
      });

      totalWorked += calc.totalWorkedMinutes;
      totalOvertime += calc.totalOvertimeMinutes;
      totalLate += calc.totalLateMinutes;
      totalAbsence += calc.totalAbsenceMinutes;
      totalNight += calc.totalNightMinutes;
    }

    const employeesWithPunches = employeeResults.filter(e => e.hasPunches).length;

    const summary = {
      totalEmployees: employees.length,
      employeesWithPunches,
      employeesWithoutPunches: employees.length - employeesWithPunches,
      processedTimesheets: storedTimesheets.length,
      approvedTimesheets: storedTimesheets.filter(t => t.status === 'APPROVED').length,
      averageWorkedHours: employeesWithPunches > 0
        ? Math.round((totalWorked / employeesWithPunches / 60) * 100) / 100
        : 0,
      totalWorkedMinutes: totalWorked,
      totalOvertimeMinutes: totalOvertime,
      totalLateMinutes: totalLate,
      totalAbsenceMinutes: totalAbsence,
      totalNightMinutes: totalNight,
      totalBalanceMinutes: totalWorked - totalAbsence,
    };

    return {
      branch: branch || branchId,
      month,
      year,
      summary,
      employees: employeeResults,
    };
  }

  async getPayrollReport(branchId: string, month: number, year: number) {
    month = Number(month);
    year = Number(year);

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      include: { company: true },
    });

    const employees = await this.prisma.employee.findMany({
      where: { branchId, isActive: true },
      include: {
        schedule: { include: { scheduleEntries: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Get stored timesheets
    const storedTimesheets = await this.prisma.timesheet.findMany({
      where: {
        employee: { branchId },
        month,
        year,
      },
    });
    const tsMap = new Map(storedTimesheets.map(t => [t.employeeId, t]));

    const payrollData: any[] = [];

    for (const emp of employees) {
      const calc = await this.calculateEmployeeMonth(emp.id, month, year);
      const stored = tsMap.get(emp.id);

      // Calculate expected hours
      let expectedMinutes = 0;
      if (emp.schedule?.scheduleEntries) {
        for (const day of calc.days) {
          const entry = emp.schedule.scheduleEntries.find(
            (e) => e.dayOfWeek === day.dayOfWeek && e.isWorkDay,
          );
          if (entry?.startTime && entry?.endTime) {
            const [sh, sm] = entry.startTime.split(':').map(Number);
            const [eh, em] = entry.endTime.split(':').map(Number);
            let exp = (eh * 60 + em) - (sh * 60 + sm);
            if (entry.breakStartTime && entry.breakEndTime) {
              const [bsh, bsm] = entry.breakStartTime.split(':').map(Number);
              const [beh, bem] = entry.breakEndTime.split(':').map(Number);
              exp -= (beh * 60 + bem) - (bsh * 60 + bsm);
            }
            if (day.status !== 'HOLIDAY' && day.status !== 'WEEKEND') {
              expectedMinutes += exp;
            }
          }
        }
      }

      payrollData.push({
        employee: {
          id: emp.id,
          name: emp.name,
          cpf: emp.cpf,
          pis: (emp as any).pis || '',
          position: emp.position,
          department: emp.department,
        },
        workedMinutes: calc.totalWorkedMinutes,
        workedHours: (calc.totalWorkedMinutes / 60).toFixed(2),
        expectedMinutes,
        expectedHours: (expectedMinutes / 60).toFixed(2),
        overtimeMinutes: calc.totalOvertimeMinutes,
        overtimeHours: (calc.totalOvertimeMinutes / 60).toFixed(2),
        nightMinutes: calc.totalNightMinutes,
        nightHours: (calc.totalNightMinutes / 60).toFixed(2),
        lateMinutes: calc.totalLateMinutes,
        absenceMinutes: calc.totalAbsenceMinutes,
        balanceMinutes: calc.totalBalanceMinutes,
        status: stored?.status || 'OPEN',
        hasPunches: calc.days.some(d => d.punchCount > 0),
        daysWorked: calc.days.filter(d => d.workedMinutes > 0).length,
      });
    }

    return {
      branch: branch || branchId,
      month,
      year,
      totalProcessed: employees.length,
      payrollData,
    };
  }

  /**
   * One-time migration: transfer punches from old employee IDs to new updated employee IDs.
   * Safe to call multiple times (idempotent).
   */
  async migrateEmployeePunches() {
    const mapping = [
      { oldId: 'cmmh29yp30059bz9p0zcu9ftn', newId: 'cmmh3hqb70xn6gw0wqjwfuv7y', name: 'MARIA VILANEIDE' },
      { oldId: 'cmmh29xql0047bz9p07dyq3mp', newId: 'cmmh3hq900xn4gw0wfou371lj', name: 'MARCOS VINICIUS' },
      { oldId: 'cmmh29zg10063bz9pu8p89ent', newId: 'cmmh3hq6z0xn2gw0wh7hlsipp', name: 'JOSENILTON BARBALHO' },
      { oldId: 'cmmh2a08p006zbz9pgg70c6bf', newId: 'cmmh3hq4y0xn0gw0w674z4wh7', name: 'JOSE LEUDOMAR' },
      { oldId: 'cmmh2a01g006rbz9px6efy5il', newId: 'cmmh3hq2n0xmygw0wseb0zse4', name: 'JOCELIO BEZERRA' },
      { oldId: 'cmmh29ywl005hbz9pk4lvy25b', newId: 'cmmh3hq0i0xmwgw0wkg7izpcj', name: 'JOAO VITOR' },
      { oldId: 'cmmh29yht0051bz9prr3pi0b1', newId: 'cmmh3hpyd0xmugw0wixtbnfeb', name: 'THIAGO PEREIRA' },
      { oldId: 'cmmh29yun005fbz9prd50t65g', newId: 'cmmh3hpwf0xmsgw0wjufmae43', name: 'LUAN' },
      { oldId: 'cmmh29yjl0053bz9pws1a67eg', newId: 'cmmh3hpuj0xmqgw0wtss4hmfc', name: 'FRANCISCI ISAC' },
      { oldId: 'cmmh2a2ap0099bz9pawsa338m', newId: 'cmmh3hpso0xmogw0wj1rjpzwu', name: 'CANINDE CHAVES' },
      { oldId: 'cmmh2a2k5009jbz9p8wzz1mkm', newId: 'cmmh3hpqt0xmmgw0wkdtx9rpd', name: 'F ARTHUR LOPES' },
      { oldId: 'cmmh29zch005zbz9p5owtjgo1', newId: 'cmmh3hpow0xmkgw0w3ls1en7x', name: 'ANTONIO MARCOS' },
      { oldId: 'cmmh29yli0055bz9plq51a4kf', newId: 'cmmh3hpmu0xmigw0w9urwqrpd', name: 'FRANCISCO EVERTON' },
      { oldId: 'cmmh2a1ci0087bz9puge9tlpa', newId: 'cmmh3hpkv0xmggw0wkwjd7bqu', name: 'ERIDAN PEREIRA' },
      { oldId: 'cmmh29zhv0065bz9p4fs1tjev', newId: 'cmmh3hpj20xmegw0wvtyour9i', name: 'DORIAN DIMAS' },
      { oldId: 'cmmh29xbz003rbz9pb7ov8x58', newId: 'cmmh3hph00xmcgw0wobsuj8km', name: 'CICERO UBIRATAN' },
      { oldId: 'cmmh2a0c80073bz9p67l0bxuy', newId: 'cmmh3hpf10xmagw0wtnpkpzjs', name: 'AMANDA CARVALHO' },
    ];

    const results: any[] = [];

    for (const { oldId, newId, name } of mapping) {
      const punchCount = await this.prisma.normalizedPunch.count({ where: { employeeId: oldId } });
      const timesheetCount = await this.prisma.timesheet.count({ where: { employeeId: oldId } });

      if (punchCount === 0 && timesheetCount === 0) {
        results.push({ name, status: 'skipped', punchCount: 0, timesheetCount: 0 });
        continue;
      }

      // Migrate punches
      if (punchCount > 0) {
        await this.prisma.normalizedPunch.updateMany({
          where: { employeeId: oldId },
          data: { employeeId: newId },
        });
      }

      // Migrate timesheets
      if (timesheetCount > 0) {
        await this.prisma.timesheet.updateMany({
          where: { employeeId: oldId },
          data: { employeeId: newId },
        });
      }

      // Deactivate old employee
      await this.prisma.employee.update({
        where: { id: oldId },
        data: { isActive: false },
      });

      results.push({ name, status: 'migrated', punchCount, timesheetCount });
    }

    return {
      message: 'Employee punch migration complete',
      results,
      totalMigrated: results.filter(r => r.status === 'migrated').length,
      totalSkipped: results.filter(r => r.status === 'skipped').length,
    };
  }
}
