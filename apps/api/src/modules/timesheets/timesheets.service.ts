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
