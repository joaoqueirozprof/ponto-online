import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEmployeeReport(employeeId: string, month: number, year: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        branch: true,
        schedule: { include: { scheduleEntries: true } },
      },
    });

    const timesheet = await this.prisma.timesheet.findUnique({
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

    return {
      employee,
      timesheet,
      punchesByDate,
    };
  }

  async getBranchReport(branchId: string, month: number, year: number) {
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
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      include: { company: true },
    });

    const timesheets = await this.prisma.timesheet.findMany({
      where: {
        employee: { branchId },
        month,
        year,
        status: 'APPROVED',
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
