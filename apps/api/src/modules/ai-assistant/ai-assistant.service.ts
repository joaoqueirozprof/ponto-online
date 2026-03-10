import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);
  private readonly OPENAI_API_KEY = process.env.OPENAI_API_KEY || (process.env.OPENAI_KEY_B64 ? Buffer.from(process.env.OPENAI_KEY_B64, 'base64').toString('utf-8') : '');

  constructor(private prisma: PrismaService) {}

  // ==================== TOOL DEFINITIONS ====================
  private getTools() {
    return [
      {
        type: 'function' as const,
        function: {
          name: 'query_employees',
          description: 'Consultar funcionários. Pode filtrar por nome, CPF, departamento, cargo, status ativo/inativo, escala, etc.',
          parameters: {
            type: 'object',
            properties: {
              search: { type: 'string', description: 'Busca por nome, CPF ou matrícula' },
              department: { type: 'string', description: 'Filtrar por departamento' },
              isActive: { type: 'boolean', description: 'Filtrar ativos/inativos' },
              scheduleId: { type: 'string', description: 'Filtrar por escala' },
              limit: { type: 'number', description: 'Limite de resultados (padrão 20)' },
            },
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'get_employee_details',
          description: 'Obter detalhes completos de um funcionário específico, incluindo escala, folha de ponto, batidas recentes.',
          parameters: {
            type: 'object',
            properties: {
              employeeId: { type: 'string', description: 'ID do funcionário' },
              employeeName: { type: 'string', description: 'Nome do funcionário (busca parcial)' },
            },
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'query_punches',
          description: 'Consultar batidas/registros de ponto. Pode filtrar por funcionário, data, tipo de batida.',
          parameters: {
            type: 'object',
            properties: {
              employeeId: { type: 'string', description: 'ID do funcionário' },
              employeeName: { type: 'string', description: 'Nome do funcionário' },
              startDate: { type: 'string', description: 'Data inicial (YYYY-MM-DD)' },
              endDate: { type: 'string', description: 'Data final (YYYY-MM-DD)' },
              punchType: { type: 'string', description: 'Tipo: ENTRY, EXIT, BREAK_START, BREAK_END' },
              limit: { type: 'number', description: 'Limite de resultados (padrão 50)' },
            },
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'query_timesheets',
          description: 'Consultar folhas de ponto (timesheets) com totais de horas trabalhadas, extras, faltas, atrasos.',
          parameters: {
            type: 'object',
            properties: {
              employeeId: { type: 'string', description: 'ID do funcionário' },
              employeeName: { type: 'string', description: 'Nome do funcionário' },
              month: { type: 'number', description: 'Mês (1-12)' },
              year: { type: 'number', description: 'Ano' },
              status: { type: 'string', description: 'Status: OPEN, CALCULATED, APPROVED, LOCKED' },
            },
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'query_timesheet_days',
          description: 'Consultar dias detalhados de uma folha de ponto — mostra cada dia com horas trabalhadas, extras, faltas, status.',
          parameters: {
            type: 'object',
            properties: {
              employeeId: { type: 'string', description: 'ID do funcionário' },
              employeeName: { type: 'string', description: 'Nome do funcionário' },
              month: { type: 'number', description: 'Mês (1-12)' },
              year: { type: 'number', description: 'Ano' },
            },
            required: ['month', 'year'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'query_schedules',
          description: 'Consultar escalas de trabalho e suas entradas (horários por dia da semana).',
          parameters: {
            type: 'object',
            properties: {
              scheduleId: { type: 'string', description: 'ID da escala' },
              scheduleName: { type: 'string', description: 'Nome da escala' },
            },
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'generate_overtime_report',
          description: 'Gerar relatório de horas extras. Retorna dados de todos os funcionários com horas extras em um período.',
          parameters: {
            type: 'object',
            properties: {
              month: { type: 'number', description: 'Mês (1-12)' },
              year: { type: 'number', description: 'Ano' },
              department: { type: 'string', description: 'Filtrar por departamento' },
              minOvertimeMinutes: { type: 'number', description: 'Mínimo de minutos extras para incluir' },
            },
            required: ['month', 'year'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'generate_absence_report',
          description: 'Gerar relatório de faltas e ausências. Retorna funcionários com faltas em um período.',
          parameters: {
            type: 'object',
            properties: {
              month: { type: 'number', description: 'Mês (1-12)' },
              year: { type: 'number', description: 'Ano' },
              department: { type: 'string', description: 'Filtrar por departamento' },
            },
            required: ['month', 'year'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'generate_attendance_report',
          description: 'Gerar relatório de presença/frequência diária ou mensal.',
          parameters: {
            type: 'object',
            properties: {
              date: { type: 'string', description: 'Data específica (YYYY-MM-DD) para relatório diário' },
              month: { type: 'number', description: 'Mês para relatório mensal' },
              year: { type: 'number', description: 'Ano' },
            },
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'adjust_punch',
          description: 'Ajustar/alterar uma batida de ponto de um funcionário. Pode alterar o horário ou adicionar uma batida manual.',
          parameters: {
            type: 'object',
            properties: {
              employeeId: { type: 'string', description: 'ID do funcionário' },
              employeeName: { type: 'string', description: 'Nome do funcionário' },
              punchId: { type: 'string', description: 'ID da batida a ajustar (se alterando existente)' },
              date: { type: 'string', description: 'Data da batida (YYYY-MM-DD)' },
              originalTime: { type: 'string', description: 'Horário original (HH:MM)' },
              newTime: { type: 'string', description: 'Novo horário (HH:MM)' },
              punchType: { type: 'string', description: 'Tipo: ENTRY, EXIT, BREAK_START, BREAK_END' },
              reason: { type: 'string', description: 'Motivo do ajuste' },
            },
            required: ['reason'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'add_manual_punch',
          description: 'Adicionar uma batida manual de ponto para um funcionário que esqueceu de bater ou teve problema.',
          parameters: {
            type: 'object',
            properties: {
              employeeId: { type: 'string', description: 'ID do funcionário' },
              employeeName: { type: 'string', description: 'Nome do funcionário' },
              date: { type: 'string', description: 'Data (YYYY-MM-DD)' },
              time: { type: 'string', description: 'Horário (HH:MM)' },
              punchType: { type: 'string', description: 'Tipo: ENTRY, EXIT, BREAK_START, BREAK_END' },
              reason: { type: 'string', description: 'Motivo da batida manual' },
            },
            required: ['date', 'time', 'punchType', 'reason'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'run_custom_query',
          description: 'Executar uma consulta SQL de leitura (SELECT) no banco de dados para obter qualquer informação. Use somente SELECT.',
          parameters: {
            type: 'object',
            properties: {
              description: { type: 'string', description: 'O que a consulta faz' },
              sql: { type: 'string', description: 'Query SQL (apenas SELECT)' },
            },
            required: ['description', 'sql'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'generate_summary_report',
          description: 'Gerar relatório resumo geral do mês com totais de horas trabalhadas, extras, faltas, atrasos por funcionário.',
          parameters: {
            type: 'object',
            properties: {
              month: { type: 'number', description: 'Mês (1-12)' },
              year: { type: 'number', description: 'Ano' },
            },
            required: ['month', 'year'],
          },
        },
      },
    ];
  }

  // ==================== TOOL EXECUTORS ====================

  private async executeFunction(name: string, args: any): Promise<string> {
    try {
      switch (name) {
        case 'query_employees': return await this.queryEmployees(args);
        case 'get_employee_details': return await this.getEmployeeDetails(args);
        case 'query_punches': return await this.queryPunches(args);
        case 'query_timesheets': return await this.queryTimesheets(args);
        case 'query_timesheet_days': return await this.queryTimesheetDays(args);
        case 'query_schedules': return await this.querySchedules(args);
        case 'generate_overtime_report': return await this.generateOvertimeReport(args);
        case 'generate_absence_report': return await this.generateAbsenceReport(args);
        case 'generate_attendance_report': return await this.generateAttendanceReport(args);
        case 'adjust_punch': return await this.adjustPunch(args);
        case 'add_manual_punch': return await this.addManualPunch(args);
        case 'run_custom_query': return await this.runCustomQuery(args);
        case 'generate_summary_report': return await this.generateSummaryReport(args);
        default: return JSON.stringify({ error: `Função desconhecida: ${name}` });
      }
    } catch (error: any) {
      this.logger.error(`Erro executando ${name}: ${error.message}`);
      return JSON.stringify({ error: error.message });
    }
  }

  private async resolveEmployeeId(args: { employeeId?: string; employeeName?: string }): Promise<string | null> {
    if (args.employeeId) return args.employeeId;
    if (args.employeeName) {
      const emp = await this.prisma.employee.findFirst({
        where: { name: { contains: args.employeeName, mode: 'insensitive' } },
        select: { id: true },
      });
      return emp?.id || null;
    }
    return null;
  }

  private async queryEmployees(args: any): Promise<string> {
    const where: any = {};
    if (args.search) {
      where.OR = [
        { name: { contains: args.search, mode: 'insensitive' } },
        { cpf: { contains: args.search } },
        { registration: { contains: args.search } },
      ];
    }
    if (args.department) where.department = { contains: args.department, mode: 'insensitive' };
    if (args.isActive !== undefined) where.isActive = args.isActive;
    if (args.scheduleId) where.scheduleId = args.scheduleId;

    const employees = await this.prisma.employee.findMany({
      where,
      take: args.limit || 20,
      include: { schedule: { select: { id: true, name: true } }, branch: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });

    return JSON.stringify({
      total: employees.length,
      employees: employees.map(e => ({
        id: e.id,
        name: e.name,
        cpf: e.cpf,
        pis: e.pis,
        position: e.position,
        department: e.department,
        schedule: e.schedule?.name,
        branch: e.branch?.name,
        isActive: e.isActive,
        admissionDate: e.admissionDate,
      })),
    });
  }

  private async getEmployeeDetails(args: any): Promise<string> {
    const empId = await this.resolveEmployeeId(args);
    if (!empId) return JSON.stringify({ error: 'Funcionário não encontrado' });

    const now = new Date();
    const employee = await this.prisma.employee.findUnique({
      where: { id: empId },
      include: {
        schedule: { include: { scheduleEntries: true } },
        branch: { select: { name: true } },
        timesheets: {
          where: { month: now.getMonth() + 1, year: now.getFullYear() },
          take: 1,
        },
        normalizedPunches: {
          orderBy: { punchTime: 'desc' },
          take: 10,
          select: { id: true, punchTime: true, punchType: true, status: true },
        },
      },
    });

    if (!employee) return JSON.stringify({ error: 'Funcionário não encontrado' });

    return JSON.stringify({
      id: employee.id,
      name: employee.name,
      cpf: employee.cpf,
      pis: employee.pis,
      registration: employee.registration,
      email: employee.email,
      phone: employee.phone,
      position: employee.position,
      department: employee.department,
      branch: employee.branch?.name,
      isActive: employee.isActive,
      admissionDate: employee.admissionDate,
      terminationDate: employee.terminationDate,
      schedule: employee.schedule ? {
        name: employee.schedule.name,
        entries: employee.schedule.scheduleEntries.map(se => ({
          day: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][se.dayOfWeek],
          start: se.startTime,
          end: se.endTime,
          breakStart: se.breakStartTime,
          breakEnd: se.breakEndTime,
          isWorkDay: se.isWorkDay,
        })),
      } : null,
      currentTimesheet: employee.timesheets[0] ? {
        status: employee.timesheets[0].status,
        workedMinutes: employee.timesheets[0].totalWorkedMinutes,
        overtimeMinutes: employee.timesheets[0].totalOvertimeMinutes,
        absenceMinutes: employee.timesheets[0].totalAbsenceMinutes,
        lateMinutes: employee.timesheets[0].totalLateMinutes,
      } : null,
      recentPunches: employee.normalizedPunches.map(p => ({
        id: p.id,
        time: p.punchTime,
        type: p.punchType,
        status: p.status,
      })),
    });
  }

  private async queryPunches(args: any): Promise<string> {
    const where: any = {};
    const empId = await this.resolveEmployeeId(args);
    if (empId) where.employeeId = empId;
    if (args.punchType) where.punchType = args.punchType;
    if (args.startDate || args.endDate) {
      where.punchTime = {};
      if (args.startDate) where.punchTime.gte = new Date(`${args.startDate}T00:00:00.000Z`);
      if (args.endDate) where.punchTime.lte = new Date(`${args.endDate}T23:59:59.999Z`);
    }

    const punches = await this.prisma.normalizedPunch.findMany({
      where,
      take: args.limit || 50,
      orderBy: { punchTime: 'desc' },
      include: { employee: { select: { id: true, name: true } } },
    });

    return JSON.stringify({
      total: punches.length,
      punches: punches.map(p => ({
        id: p.id,
        employee: p.employee?.name,
        employeeId: p.employeeId,
        time: p.punchTime,
        type: p.punchType,
        status: p.status,
        adjustedBy: p.adjustedBy,
        adjustmentReason: p.adjustmentReason,
      })),
    });
  }

  private async queryTimesheets(args: any): Promise<string> {
    const where: any = {};
    const empId = await this.resolveEmployeeId(args);
    if (empId) where.employeeId = empId;
    if (args.month) where.month = args.month;
    if (args.year) where.year = args.year;
    if (args.status) where.status = args.status;

    const timesheets = await this.prisma.timesheet.findMany({
      where,
      take: 50,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: { employee: { select: { id: true, name: true, department: true } } },
    });

    return JSON.stringify({
      total: timesheets.length,
      timesheets: timesheets.map(ts => ({
        id: ts.id,
        employee: ts.employee?.name,
        employeeId: ts.employeeId,
        department: ts.employee?.department,
        month: ts.month,
        year: ts.year,
        status: ts.status,
        workedMinutes: ts.totalWorkedMinutes,
        overtimeMinutes: ts.totalOvertimeMinutes,
        absenceMinutes: ts.totalAbsenceMinutes,
        lateMinutes: ts.totalLateMinutes,
        nightMinutes: ts.totalNightMinutes,
        balanceMinutes: ts.totalBalanceMinutes,
      })),
    });
  }

  private async queryTimesheetDays(args: any): Promise<string> {
    const empId = await this.resolveEmployeeId(args);
    const where: any = { month: args.month, year: args.year };
    if (empId) where.employeeId = empId;

    const timesheet = await this.prisma.timesheet.findFirst({
      where,
      include: {
        employee: { select: { name: true } },
        timesheetDays: { orderBy: { date: 'asc' }, include: { scheduleEntry: true } },
      },
    });

    if (!timesheet) return JSON.stringify({ error: 'Folha de ponto não encontrada' });

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return JSON.stringify({
      employee: timesheet.employee?.name,
      month: timesheet.month,
      year: timesheet.year,
      status: timesheet.status,
      totals: {
        worked: timesheet.totalWorkedMinutes,
        overtime: timesheet.totalOvertimeMinutes,
        absence: timesheet.totalAbsenceMinutes,
        late: timesheet.totalLateMinutes,
      },
      days: timesheet.timesheetDays.map(d => ({
        date: d.date,
        dayOfWeek: dayNames[new Date(d.date).getDay()],
        status: d.status,
        workedMinutes: d.workedMinutes,
        overtimeMinutes: d.overtimeMinutes,
        absenceMinutes: d.absenceMinutes,
        lateMinutes: d.lateMinutes,
        punchCount: d.punchCount,
        notes: d.notes,
      })),
    });
  }

  private async querySchedules(args: any): Promise<string> {
    const where: any = {};
    if (args.scheduleId) where.id = args.scheduleId;
    if (args.scheduleName) where.name = { contains: args.scheduleName, mode: 'insensitive' };

    const schedules = await this.prisma.workSchedule.findMany({
      where,
      include: {
        scheduleEntries: { orderBy: { dayOfWeek: 'asc' } },
        _count: { select: { employees: true } },
      },
    });

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return JSON.stringify({
      total: schedules.length,
      schedules: schedules.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
        weeklyHours: s.weeklyHours,
        employeeCount: s._count.employees,
        entries: s.scheduleEntries.map(se => ({
          day: dayNames[se.dayOfWeek],
          start: se.startTime,
          end: se.endTime,
          breakStart: se.breakStartTime,
          breakEnd: se.breakEndTime,
          isWorkDay: se.isWorkDay,
        })),
      })),
    });
  }

  private async generateOvertimeReport(args: any): Promise<string> {
    const timesheets = await this.prisma.timesheet.findMany({
      where: {
        month: args.month,
        year: args.year,
        totalOvertimeMinutes: { gt: args.minOvertimeMinutes || 0 },
        ...(args.department ? { employee: { department: { contains: args.department, mode: 'insensitive' as any } } } : {}),
      },
      include: { employee: { select: { name: true, department: true, position: true } } },
      orderBy: { totalOvertimeMinutes: 'desc' },
    });

    const totalOvertime = timesheets.reduce((sum, ts) => sum + ts.totalOvertimeMinutes, 0);
    return JSON.stringify({
      report: 'Relatório de Horas Extras',
      period: `${String(args.month).padStart(2, '0')}/${args.year}`,
      totalEmployees: timesheets.length,
      totalOvertimeMinutes: totalOvertime,
      totalOvertimeFormatted: `${Math.floor(totalOvertime / 60)}h${String(totalOvertime % 60).padStart(2, '0')}min`,
      employees: timesheets.map(ts => ({
        name: ts.employee?.name,
        department: ts.employee?.department,
        position: ts.employee?.position,
        overtimeMinutes: ts.totalOvertimeMinutes,
        overtimeFormatted: `${Math.floor(ts.totalOvertimeMinutes / 60)}h${String(ts.totalOvertimeMinutes % 60).padStart(2, '0')}min`,
        workedMinutes: ts.totalWorkedMinutes,
      })),
    });
  }

  private async generateAbsenceReport(args: any): Promise<string> {
    const timesheets = await this.prisma.timesheet.findMany({
      where: {
        month: args.month,
        year: args.year,
        totalAbsenceMinutes: { gt: 0 },
        ...(args.department ? { employee: { department: { contains: args.department, mode: 'insensitive' as any } } } : {}),
      },
      include: { employee: { select: { name: true, department: true } } },
      orderBy: { totalAbsenceMinutes: 'desc' },
    });

    const totalAbsence = timesheets.reduce((sum, ts) => sum + ts.totalAbsenceMinutes, 0);
    return JSON.stringify({
      report: 'Relatório de Faltas/Ausências',
      period: `${String(args.month).padStart(2, '0')}/${args.year}`,
      totalEmployees: timesheets.length,
      totalAbsenceMinutes: totalAbsence,
      employees: timesheets.map(ts => ({
        name: ts.employee?.name,
        department: ts.employee?.department,
        absenceMinutes: ts.totalAbsenceMinutes,
        absenceFormatted: `${Math.floor(ts.totalAbsenceMinutes / 60)}h${String(ts.totalAbsenceMinutes % 60).padStart(2, '0')}min`,
      })),
    });
  }

  private async generateAttendanceReport(args: any): Promise<string> {
    if (args.date) {
      // Daily report
      const startOfDay = new Date(`${args.date}T00:00:00.000Z`);
      const endOfDay = new Date(`${args.date}T23:59:59.999Z`);
      const punches = await this.prisma.normalizedPunch.findMany({
        where: { punchTime: { gte: startOfDay, lte: endOfDay } },
        include: { employee: { select: { id: true, name: true, department: true } } },
        orderBy: { punchTime: 'asc' },
      });

      const presentIds = new Set(punches.map(p => p.employeeId));
      const totalEmployees = await this.prisma.employee.count({ where: { isActive: true } });

      return JSON.stringify({
        report: 'Relatório de Presença Diário',
        date: args.date,
        totalActive: totalEmployees,
        present: presentIds.size,
        absent: totalEmployees - presentIds.size,
        attendanceRate: `${((presentIds.size / totalEmployees) * 100).toFixed(1)}%`,
        presentEmployees: [...new Set(punches.map(p => p.employee?.name))].filter(Boolean),
      });
    }

    // Monthly summary
    const month = args.month || new Date().getMonth() + 1;
    const year = args.year || new Date().getFullYear();
    const timesheets = await this.prisma.timesheet.findMany({
      where: { month, year },
      include: { employee: { select: { name: true, department: true } } },
      orderBy: { totalWorkedMinutes: 'desc' },
    });

    return JSON.stringify({
      report: 'Relatório de Frequência Mensal',
      period: `${String(month).padStart(2, '0')}/${year}`,
      totalEmployees: timesheets.length,
      employees: timesheets.map(ts => ({
        name: ts.employee?.name,
        department: ts.employee?.department,
        workedMinutes: ts.totalWorkedMinutes,
        absenceMinutes: ts.totalAbsenceMinutes,
        lateMinutes: ts.totalLateMinutes,
        status: ts.status,
      })),
    });
  }

  private async adjustPunch(args: any): Promise<string> {
    const empId = await this.resolveEmployeeId(args);
    if (!empId) return JSON.stringify({ error: 'Funcionário não encontrado' });

    if (args.punchId) {
      // Adjust existing punch
      const punch = await this.prisma.normalizedPunch.findUnique({ where: { id: args.punchId } });
      if (!punch) return JSON.stringify({ error: 'Batida não encontrada' });

      const newDateTime = new Date(punch.punchTime);
      if (args.newTime) {
        const [h, m] = args.newTime.split(':').map(Number);
        newDateTime.setUTCHours(h, m, 0, 0);
      }

      await this.prisma.normalizedPunch.update({
        where: { id: args.punchId },
        data: {
          punchTime: newDateTime,
          originalTime: punch.originalTime || punch.punchTime,
          adjustedBy: 'AI_ASSISTANT_RH',
          adjustmentReason: args.reason,
          status: 'ADJUSTED',
        },
      });

      await this.prisma.punchAdjustment.create({
        data: {
          normalizedPunchId: args.punchId,
          employeeId: empId,
          adjustedBy: 'AI_ASSISTANT_RH',
          originalTime: punch.punchTime,
          newTime: newDateTime,
          reason: args.reason,
        },
      });

      return JSON.stringify({ success: true, message: `Batida ajustada de ${punch.punchTime} para ${newDateTime.toISOString()}`, reason: args.reason });
    }

    // Find punch by date and approximate time
    if (args.date && args.originalTime) {
      const [h, m] = args.originalTime.split(':').map(Number);
      const searchStart = new Date(`${args.date}T${String(h).padStart(2, '0')}:${String(Math.max(0, m - 5)).padStart(2, '0')}:00.000Z`);
      const searchEnd = new Date(`${args.date}T${String(h).padStart(2, '0')}:${String(Math.min(59, m + 5)).padStart(2, '0')}:59.999Z`);

      const punch = await this.prisma.normalizedPunch.findFirst({
        where: { employeeId: empId, punchTime: { gte: searchStart, lte: searchEnd } },
      });

      if (punch && args.newTime) {
        const newDateTime = new Date(`${args.date}T${args.newTime}:00.000Z`);
        await this.prisma.normalizedPunch.update({
          where: { id: punch.id },
          data: {
            punchTime: newDateTime,
            originalTime: punch.originalTime || punch.punchTime,
            adjustedBy: 'AI_ASSISTANT_RH',
            adjustmentReason: args.reason,
            status: 'ADJUSTED',
          },
        });

        await this.prisma.punchAdjustment.create({
          data: {
            normalizedPunchId: punch.id,
            employeeId: empId,
            adjustedBy: 'AI_ASSISTANT_RH',
            originalTime: punch.punchTime,
            newTime: newDateTime,
            reason: args.reason,
          },
        });

        return JSON.stringify({ success: true, message: `Batida ajustada de ${args.originalTime} para ${args.newTime} em ${args.date}`, reason: args.reason });
      }
      return JSON.stringify({ error: 'Batida não encontrada no horário informado' });
    }

    return JSON.stringify({ error: 'Informe punchId ou date+originalTime para identificar a batida' });
  }

  private async addManualPunch(args: any): Promise<string> {
    const empId = await this.resolveEmployeeId(args);
    if (!empId) return JSON.stringify({ error: 'Funcionário não encontrado' });

    const punchTime = new Date(`${args.date}T${args.time}:00.000Z`);

    // Create raw event
    const rawEvent = await this.prisma.rawPunchEvent.create({
      data: {
        employeeId: empId,
        punchTime,
        source: 'MANUAL_AI',
        rawData: { addedBy: 'AI_ASSISTANT_RH', reason: args.reason },
      },
    });

    // Create normalized punch
    await this.prisma.normalizedPunch.create({
      data: {
        rawPunchEventId: rawEvent.id,
        employeeId: empId,
        punchTime,
        punchType: args.punchType,
        status: 'MANUAL',
        adjustedBy: 'AI_ASSISTANT_RH',
        adjustmentReason: args.reason,
      },
    });

    const employee = await this.prisma.employee.findUnique({ where: { id: empId }, select: { name: true } });
    return JSON.stringify({
      success: true,
      message: `Batida manual adicionada para ${employee?.name}: ${args.punchType} às ${args.time} em ${args.date}`,
      reason: args.reason,
    });
  }

  private async runCustomQuery(args: any): Promise<string> {
    const sql = args.sql.trim().toUpperCase();
    if (!sql.startsWith('SELECT')) {
      return JSON.stringify({ error: 'Apenas consultas SELECT são permitidas por segurança' });
    }
    try {
      const result = await this.prisma.$queryRawUnsafe(args.sql);
      return JSON.stringify({ description: args.description, data: result });
    } catch (error: any) {
      return JSON.stringify({ error: `Erro na query: ${error.message}` });
    }
  }

  private async generateSummaryReport(args: any): Promise<string> {
    const timesheets = await this.prisma.timesheet.findMany({
      where: { month: args.month, year: args.year },
      include: { employee: { select: { name: true, department: true, position: true, schedule: { select: { name: true } } } } },
      orderBy: { employee: { name: 'asc' } },
    });

    const totalWorked = timesheets.reduce((s, t) => s + t.totalWorkedMinutes, 0);
    const totalOvertime = timesheets.reduce((s, t) => s + t.totalOvertimeMinutes, 0);
    const totalAbsence = timesheets.reduce((s, t) => s + t.totalAbsenceMinutes, 0);
    const totalLate = timesheets.reduce((s, t) => s + t.totalLateMinutes, 0);

    const fmtHM = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}min`;

    return JSON.stringify({
      report: 'Relatório Resumo Mensal',
      period: `${String(args.month).padStart(2, '0')}/${args.year}`,
      totalEmployees: timesheets.length,
      totals: {
        worked: fmtHM(totalWorked),
        overtime: fmtHM(totalOvertime),
        absence: fmtHM(totalAbsence),
        late: fmtHM(totalLate),
      },
      employees: timesheets.map(ts => ({
        name: ts.employee?.name,
        department: ts.employee?.department,
        position: ts.employee?.position,
        schedule: ts.employee?.schedule?.name,
        worked: fmtHM(ts.totalWorkedMinutes),
        overtime: fmtHM(ts.totalOvertimeMinutes),
        absence: fmtHM(ts.totalAbsenceMinutes),
        late: fmtHM(ts.totalLateMinutes),
        balance: fmtHM(ts.totalBalanceMinutes),
        status: ts.status,
      })),
    });
  }

  // ==================== MAIN CHAT ====================

  async chat(message: string, conversationHistory: { role: string; content: string }[]) {
    const systemPrompt = `Você é o Assistente de RH do sistema Ponto Online. Você tem acesso COMPLETO ao banco de dados do sistema de ponto eletrônico.

SUAS CAPACIDADES:
- Consultar qualquer informação sobre funcionários, batidas, escalas, folhas de ponto
- Gerar relatórios detalhados (horas extras, faltas, presença, resumo mensal)
- Ajustar batidas de ponto (alterar horário, adicionar batida manual)
- Executar consultas SQL de leitura para dados específicos
- Responder QUALQUER pergunta sobre QUALQUER funcionário

REGRAS:
- Sempre responda em português brasileiro
- Seja direto e objetivo nas respostas
- Quando mostrar horas, use o formato Xh XXmin (ex: 8h30min)
- Para relatórios, organize as informações de forma clara com formatação
- Quando o RH pedir para alterar uma batida, SEMPRE peça confirmação antes de executar a alteração mostrando o que vai mudar
- Para ajustes de batida, sempre registre o motivo
- Se não encontrar um funcionário, sugira nomes similares
- Data atual: ${new Date().toLocaleDateString('pt-BR')} | Mês atual: ${new Date().getMonth() + 1}/${new Date().getFullYear()}

FORMATAÇÃO:
- Use **negrito** para destacar informações importantes
- Use tabelas markdown quando listar múltiplos funcionários
- Organize relatórios com cabeçalhos e seções claras`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-20).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    try {
      let response = await this.callOpenAI(messages, this.getTools());
      let assistantMessage = response.choices[0].message;
      const allMessages = [...messages];

      // Tool call loop - max 10 iterations
      let iterations = 0;
      while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0 && iterations < 10) {
        iterations++;
        allMessages.push(assistantMessage);

        // Execute all tool calls
        for (const toolCall of assistantMessage.tool_calls) {
          const fnName = toolCall.function.name;
          const fnArgs = JSON.parse(toolCall.function.arguments);
          this.logger.log(`Tool call: ${fnName}(${JSON.stringify(fnArgs)})`);

          const result = await this.executeFunction(fnName, fnArgs);
          allMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result,
          });
        }

        // Call OpenAI again with tool results
        response = await this.callOpenAI(allMessages, this.getTools());
        assistantMessage = response.choices[0].message;
      }

      return {
        reply: assistantMessage.content || 'Desculpe, não consegui processar sua solicitação.',
        toolsUsed: iterations > 0,
      };
    } catch (error: any) {
      this.logger.error(`Chat error: ${error.message}`);
      return {
        reply: `Desculpe, ocorreu um erro ao processar sua mensagem: ${error.message}`,
        toolsUsed: false,
      };
    }
  }

  private async callOpenAI(messages: any[], tools: any[]) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errorBody}`);
    }

    return response.json();
  }
}
