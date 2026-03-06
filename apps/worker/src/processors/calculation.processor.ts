import { PrismaClient } from '@prisma/client';
import { Job } from 'bull';

export class CalculationProcessor {
  constructor(private prisma: PrismaClient) {}

  async process(job: Job<{ branchId: string; month: number; year: number }>) {
    const { branchId, month, year } = job.data;

    const calculationRun = await this.prisma.calculationRun.create({
      data: {
        branchId,
        month,
        year,
        status: 'RUNNING',
      },
    });

    try {
      const employees = await this.prisma.employee.findMany({
        where: { branchId, isActive: true },
      });

      let employeesProcessed = 0;
      let errorsFound = 0;

      for (const employee of employees) {
        try {
          await this.calculateEmployeeTimesheet(employee.id, month, year, calculationRun.id);
          employeesProcessed++;
        } catch (error) {
          errorsFound++;
          console.error(
            `Error calculating timesheet for employee ${employee.id}:`,
            error,
          );

          await this.prisma.calculationIssue.create({
            data: {
              calculationRunId: calculationRun.id,
              employeeId: employee.id,
              issueType: 'OTHER',
              description: `Calculation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          });
        }
      }

      await this.prisma.calculationRun.update({
        where: { id: calculationRun.id },
        data: {
          status: 'COMPLETED',
          employeesProcessed,
          errorsFound,
          finishedAt: new Date(),
        },
      });

      return {
        success: true,
        calculationRunId: calculationRun.id,
        employeesProcessed,
        errorsFound,
      };
    } catch (error) {
      await this.prisma.calculationRun.update({
        where: { id: calculationRun.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
        },
      });

      throw error;
    }
  }

  private async calculateEmployeeTimesheet(
    employeeId: string,
    month: number,
    year: number,
    calculationRunId: string,
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { schedule: { include: { scheduleEntries: true } } },
    });

    if (!employee) {
      throw new Error(`Employee ${employeeId} not found`);
    }

    let timesheet = await this.prisma.timesheet.findUnique({
      where: {
        employeeId_month_year: { employeeId, month, year },
      },
    });

    if (!timesheet) {
      timesheet = await this.prisma.timesheet.create({
        data: {
          employeeId,
          month,
          year,
          status: 'CALCULATED',
          calculatedAt: new Date(),
        },
      });
    }

    const punches = await this.prisma.normalizedPunch.findMany({
      where: { employeeId },
      orderBy: { punchTime: 'asc' },
    });

    let totalWorkedMinutes = 0;
    let totalOvertimeMinutes = 0;
    let totalNightMinutes = 0;

    const daysMap = new Map();

    for (const punch of punches) {
      const punchDate = new Date(punch.punchTime);
      if (punchDate.getMonth() + 1 === month && punchDate.getFullYear() === year) {
        const dateKey = punchDate.toISOString().split('T')[0];

        if (!daysMap.has(dateKey)) {
          daysMap.set(dateKey, {
            date: punchDate,
            punches: [],
            workedMinutes: 0,
          });
        }

        daysMap.get(dateKey).punches.push(punch);
      }
    }

    for (const [dateKey, dayData] of daysMap) {
      const schedule = employee.schedule;
      const dayOfWeek = dayData.date.getDay();
      const scheduleEntry = schedule?.scheduleEntries.find(
        (se) => se.dayOfWeek === dayOfWeek,
      );

      let dayWorkedMinutes = 0;

      if (scheduleEntry && scheduleEntry.isWorkDay && dayData.punches.length > 0) {
        const firstPunch = dayData.punches[0].punchTime;
        const lastPunch = dayData.punches[dayData.punches.length - 1].punchTime;
        dayWorkedMinutes =
          Math.round(
            (new Date(lastPunch).getTime() - new Date(firstPunch).getTime()) /
              60000,
          ) - (scheduleEntry.breakMinutes || 0);

        const punchHour = new Date(firstPunch).getHours();
        if (punchHour >= 22 || punchHour < 5) {
          totalNightMinutes += dayWorkedMinutes;
        }

        totalWorkedMinutes += dayWorkedMinutes;

        if (dayWorkedMinutes > scheduleEntry.startTime !== '00:00' ? 480 : 0) {
          totalOvertimeMinutes += dayWorkedMinutes - 480;
        }
      }

      await this.prisma.timesheetDay.upsert({
        where: {
          id: `${timesheet.id}-${dateKey}`,
        },
        update: {
          workedMinutes: dayWorkedMinutes,
        },
        create: {
          timesheetId: timesheet.id,
          date: dayData.date,
          workedMinutes: dayWorkedMinutes,
          status: 'NORMAL',
        },
      });
    }

    await this.prisma.timesheet.update({
      where: { id: timesheet.id },
      data: {
        totalWorkedMinutes,
        totalOvertimeMinutes,
        totalNightMinutes,
        calculatedAt: new Date(),
      },
    });
  }
}
