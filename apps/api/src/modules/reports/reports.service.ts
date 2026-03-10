import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface DayCalc {
  date: string;
  dayOfWeek: number;
  workedMinutes: number;
  expectedMinutes: number;
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

// Mapping of new employee IDs to their old IDs (for punch lookup)
// Some employees were re-created with updated names, but punches remain on old IDs
const OLD_ID_MAP: Record<string, string> = {
  'cmmh3hqb70xn6gw0wqjwfuv7y': 'cmmh29yp30059bz9p0zcu9ftn', // MARIA VILANEIDE
  'cmmh3hq900xn4gw0wfou371lj': 'cmmh29xql0047bz9p07dyq3mp', // MARCOS VINICIUS
  'cmmh3hq6z0xn2gw0wh7hlsipp': 'cmmh29zg10063bz9pu8p89ent', // JOSENILTON BARBALHO
  'cmmh3hq4y0xn0gw0w674z4wh7': 'cmmh2a08p006zbz9pgg70c6bf', // JOSE LEUDOMAR
  'cmmh3hq2n0xmygw0wseb0zse4': 'cmmh2a01g006rbz9px6efy5il', // JOCELIO BEZERRA
  'cmmh3hq0i0xmwgw0wkg7izpcj': 'cmmh29ywl005hbz9pk4lvy25b', // JOAO VITOR
  'cmmh3hpyd0xmugw0wixtbnfeb': 'cmmh29yht0051bz9prr3pi0b1', // THIAGO PEREIRA
  'cmmh3hpwf0xmsgw0wjufmae43': 'cmmh29yun005fbz9prd50t65g', // LUAN
  'cmmh3hpuj0xmqgw0wtss4hmfc': 'cmmh29yjl0053bz9pws1a67eg', // FRANCISCI ISAC
  'cmmh3hpso0xmogw0wj1rjpzwu': 'cmmh2a2ap0099bz9pawsa338m', // CANINDE CHAVES
  'cmmh3hpqt0xmmgw0wkdtx9rpd': 'cmmh2a2k5009jbz9p8wzz1mkm', // F ARTHUR LOPES
  'cmmh3hpow0xmkgw0w3ls1en7x': 'cmmh29zch005zbz9p5owtjgo1', // ANTONIO MARCOS
  'cmmh3hpmu0xmigw0w9urwqrpd': 'cmmh29yli0055bz9plq51a4kf', // FRANCISCO EVERTON
  'cmmh3hpkv0xmggw0wkwjd7bqu': 'cmmh2a1ci0087bz9puge9tlpa', // ERIDAN PEREIRA
  'cmmh3hpj20xmegw0wvtyour9i': 'cmmh29zhv0065bz9p4fs1tjev', // DORIAN DIMAS
  'cmmh3hph00xmcgw0wobsuj8km': 'cmmh29xbz003rbz9pb7ov8x58', // CICERO UBIRATAN
  'cmmh3hpf10xmagw0wtnpkpzjs': 'cmmh2a0c80073bz9p67l0bxuy', // AMANDA CARVALHO
};

// ── BRT Timezone Helpers (UTC-3, no DST) ──
const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;

function utcToBrtDateStr(utcDate: Date): string {
  const brt = new Date(utcDate.getTime() + BRT_OFFSET_MS);
  return brt.toISOString().split('T')[0];
}

function getBrtMonthBoundsUtc(month: number, year: number): { startDate: Date; endDate: Date } {
  // BRT month start: 1st of month 00:00 BRT = 03:00 UTC
  const startDate = new Date(Date.UTC(year, month - 1, 1, 3, 0, 0, 0));
  // BRT month end: last day 23:59:59.999 BRT = next month 1st 02:59:59.999 UTC
  const daysInMonth = new Date(year, month, 0).getDate();
  const endDate = new Date(Date.UTC(year, month - 1, daysInMonth + 1, 2, 59, 59, 999));
  return { startDate, endDate };
}

function getBrtTodayStr(): string {
  return utcToBrtDateStr(new Date());
}

function makeBrtDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function brtDayOfWeek(year: number, month: number, day: number): number {
  // 03:00 UTC on that calendar date = 00:00 BRT, so getUTCDay() gives BRT day of week
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0)).getUTCDay();
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Shared helper: calculate daily data from actual normalized punches for an employee in a given month.
   * Uses BRT timezone (UTC-3) for all date boundaries and grouping.
   */
  private async calculateEmployeeMonth(
    employeeId: string,
    month: number,
    year: number,
  ): Promise<{
    days: DayCalc[];
    punchesByDate: Record<string, Array<{ time: string; type: string; status: string }>>;
    totalWorkedMinutes: number;
    totalExpectedMinutes: number;
    totalOvertimeMinutes: number;
    totalNightMinutes: number;
    totalLateMinutes: number;
    totalAbsenceMinutes: number;
    totalBalanceMinutes: number;
  }> {
    // BRT month boundaries in UTC
    const { startDate, endDate } = getBrtMonthBoundsUtc(month, year);
    const daysInMonth = new Date(year, month, 0).getDate();

    // Get employee with schedule
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { schedule: { include: { scheduleEntries: true } } },
    });

    // Get all normalized punches for this employee in the month
    // Also check the old employee ID if this is a re-created employee
    const employeeIds = [employeeId];
    const oldId = OLD_ID_MAP[employeeId];
    if (oldId) employeeIds.push(oldId);

    const monthPunches = await this.prisma.normalizedPunch.findMany({
      where: {
        employeeId: { in: employeeIds },
        punchTime: { gte: startDate, lte: endDate },
      },
      orderBy: { punchTime: 'asc' },
    });

    // Group punches by BRT date
    const punchesByDate: Record<string, Array<{ time: string; type: string; status: string }>> = {};
    for (const punch of monthPunches) {
      const dateKey = utcToBrtDateStr(punch.punchTime);
      if (!punchesByDate[dateKey]) punchesByDate[dateKey] = [];
      punchesByDate[dateKey].push({
        time: punch.punchTime.toISOString(),
        type: punch.punchType,
        status: punch.status,
      });
    }

    // Build schedule map (dayOfWeek -> scheduleEntry)
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
    let totalExpected = 0;
    let totalOvertime = 0;
    let totalLate = 0;
    let totalAbsence = 0;
    let totalNight = 0;
    const todayStr = getBrtTodayStr();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = makeBrtDateStr(year, month, day);
      const dayOfWeek = brtDayOfWeek(year, month, day);
      const dayPunches = punchesByDate[dateStr] || [];
      const scheduleEntry = scheduleByDay[dayOfWeek];
      const isHoliday = holidayDates.has(dateStr);
      const isWorkDay = scheduleEntry?.isWorkDay && !isHoliday;

      // Skip future BRT days
      if (dateStr > todayStr) continue;

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
      } else if (isWorkDay) {
        status = 'ABSENCE';
      }

      // Calculate expected minutes for this day
      let expectedMinutes = 0;
      if (isWorkDay && scheduleEntry?.startTime && scheduleEntry?.endTime) {
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
              // Schedule start in UTC: BRT time sh:sm = UTC (sh+3):sm on that calendar day
              const schedStartUtc = new Date(Date.UTC(year, month - 1, day, sh + 3, sm, 0, 0));
              const diff = Math.floor((entryDate.getTime() - schedStartUtc.getTime()) / 60000);
              if (diff > 5) lateMinutes = diff; // 5 min tolerance
            }
          }
        } else if (workedMinutes === 0 && dayPunches.length === 0) {
          absenceMinutes = expectedMinutes;
        }
      } else if (!isWorkDay && workedMinutes > 0) {
        overtimeMinutes = workedMinutes;
      }

      // Night hours (22:00 - 05:00 BRT) - simplified
      let nightMinutes = 0;
      if (dayPunches.length >= 2) {
        const sorted = [...dayPunches].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        for (let i = 0; i < sorted.length - 1; i += 2) {
          const start = new Date(sorted[i].time);
          const end = sorted[i + 1] ? new Date(sorted[i + 1].time) : start;
          // Convert to BRT hours
          const startBrt = new Date(start.getTime() + BRT_OFFSET_MS);
          const endBrt = new Date(end.getTime() + BRT_OFFSET_MS);
          const startH = startBrt.getUTCHours();
          const endH = endBrt.getUTCHours();
          if (startH >= 22 || startH < 5 || endH >= 22 || endH < 5) {
            const diffMin = Math.floor((end.getTime() - start.getTime()) / 60000);
            if (startH >= 22 || startH < 5) nightMinutes += Math.min(diffMin, 60);
          }
        }
      }

      totalWorked += workedMinutes;
      totalExpected += isWorkDay ? expectedMinutes : 0;
      totalOvertime += overtimeMinutes;
      totalLate += lateMinutes;
      totalAbsence += absenceMinutes;
      totalNight += nightMinutes;

      days.push({
        date: dateStr,
        dayOfWeek,
        workedMinutes,
        expectedMinutes: isWorkDay ? expectedMinutes : 0,
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

    return {
      days,
      punchesByDate,
      totalWorkedMinutes: totalWorked,
      totalExpectedMinutes: totalExpected,
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

    return {
      employee,
      timesheet,
      punchesByDate: calc.punchesByDate,
      expectedMonthMinutes: calc.totalExpectedMinutes,
      daysWorked: calc.days.filter(d => d.workedMinutes > 0).length,
      daysAbsent: calc.days.filter(d => d.status === 'ABSENCE').length,
      daysIncomplete: calc.days.filter(d => d.status === 'INCOMPLETE').length,
      _build: 'v69-brt-fix',
      _resolvedIds: OLD_ID_MAP[employeeId] ? [employeeId, OLD_ID_MAP[employeeId]] : [employeeId],
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

    // Use BRT boundaries for batch punch query
    const { startDate, endDate } = getBrtMonthBoundsUtc(month, year);

    // Batch get all punches for the branch (include old employee IDs too)
    const allOldIds = Object.values(OLD_ID_MAP);
    const allPunches = await this.prisma.normalizedPunch.findMany({
      where: {
        OR: [
          { employee: { branchId }, punchTime: { gte: startDate, lte: endDate } },
          { employeeId: { in: allOldIds }, punchTime: { gte: startDate, lte: endDate } },
        ],
      },
      orderBy: { punchTime: 'asc' },
    });

    // Build reverse map: old ID -> new ID
    const reverseMap: Record<string, string> = {};
    for (const [newId, oId] of Object.entries(OLD_ID_MAP)) {
      reverseMap[oId] = newId;
    }

    // Group punches by employee (mapping old IDs to new IDs)
    const punchesByEmployee: Record<string, any[]> = {};
    for (const punch of allPunches) {
      const resolvedId = reverseMap[punch.employeeId] || punch.employeeId;
      if (!punchesByEmployee[resolvedId]) punchesByEmployee[resolvedId] = [];
      punchesByEmployee[resolvedId].push(punch);
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

      // Net overtime = gross overtime - total absence/late deficit (floored at 0)
      // This transparently shows: employee earned X extra hours but was absent/late Y hours
      const netOvertimeMinutes = Math.max(0, calc.totalOvertimeMinutes - calc.totalAbsenceMinutes);

      // Build per-day breakdown for transparency
      const dayDetails = calc.days.map(d => ({
        date: d.date,
        dayOfWeek: d.dayOfWeek,
        status: d.status,
        workedMinutes: d.workedMinutes,
        expectedMinutes: d.expectedMinutes,
        overtimeMinutes: d.overtimeMinutes,
        lateMinutes: d.lateMinutes,
        absenceMinutes: d.absenceMinutes,
        punchCount: d.punchCount,
        punches: d.punches.map(p => ({
          time: p.time,
          type: p.type,
        })),
      }));

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
        expectedMinutes: calc.totalExpectedMinutes,
        expectedHours: (calc.totalExpectedMinutes / 60).toFixed(2),
        overtimeMinutes: calc.totalOvertimeMinutes,
        overtimeHours: (calc.totalOvertimeMinutes / 60).toFixed(2),
        // NEW: Net overtime after deducting absences/late - transparent for RH
        netOvertimeMinutes,
        netOvertimeHours: (netOvertimeMinutes / 60).toFixed(2),
        nightMinutes: calc.totalNightMinutes,
        nightHours: (calc.totalNightMinutes / 60).toFixed(2),
        lateMinutes: calc.totalLateMinutes,
        absenceMinutes: calc.totalAbsenceMinutes,
        balanceMinutes: calc.totalBalanceMinutes,
        status: stored?.status || 'OPEN',
        hasPunches: calc.days.some(d => d.punchCount > 0),
        daysWorked: calc.days.filter(d => d.workedMinutes > 0).length,
        daysAbsent: calc.days.filter(d => d.status === 'ABSENCE').length,
        daysIncomplete: calc.days.filter(d => d.status === 'INCOMPLETE').length,
        // Per-day transparency
        dayDetails,
      });
    }

    return {
      branch: branch || branchId,
      month,
      year,
      totalProcessed: employees.length,
      payrollData,
      _build: 'v69-brt-net-overtime',
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
