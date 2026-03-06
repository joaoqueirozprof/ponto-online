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

    const punches = await this.prisma.normalizedPunch.findMany({
      where: { employeeId },
      orderBy: { punchTime: 'desc' },
      take: 100,
    });

    return {
      employee,
      timesheet,
      recentPunches: punches,
    };
  }

  async getBranchReport(branchId: string, month: number, year: number) {
    const employees = await this.prisma.employee.findMany({
      where: { branchId, isActive: true },
      select: { id: true, name: true, cpf: true },
    });

    const timesheets = await this.prisma.timesheet.findMany({
      where: {
        employee: { branchId },
        month,
        year,
      },
      include: {
        employee: {
          select: { id: true, name: true, cpf: true },
        },
      },
    });

    const summary = {
      totalEmployees: employees.length,
      processedTimesheets: timesheets.length,
      approvedTimesheets: timesheets.filter((t) => t.status === 'APPROVED').length,
      averageWorkedHours: this.calculateAverageHours(timesheets),
      totalOvertimeHours: this.calculateTotalOvertime(timesheets),
    };

    return {
      branch: branchId,
      month,
      year,
      summary,
      timesheets,
    };
  }

  async getPayrollReport(branchId: string, month: number, year: number) {
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
    }));

    return {
      branch: branchId,
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
