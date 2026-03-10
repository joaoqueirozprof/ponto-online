import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);
  private readonly OPENAI_API_KEY = process.env.OPENAI_API_KEY || (process.env.OPENAI_KEY_B64 ? Buffer.from(process.env.OPENAI_KEY_B64, 'base64').toString('utf-8') : '');
  private readonly PDF_DIR = path.join(process.cwd(), 'generated-pdfs');

  // Translation maps
  private readonly PUNCH_TYPE_PT: Record<string, string> = {
    ENTRY: 'Entrada', EXIT: 'Saída', BREAK_START: 'Início Intervalo', BREAK_END: 'Fim Intervalo',
  };
  private readonly STATUS_PT: Record<string, string> = {
    NORMAL: 'Normal', ADJUSTED: 'Ajustado', MANUAL: 'Manual', OPEN: 'Aberta', CALCULATED: 'Calculada', APPROVED: 'Aprovada', LOCKED: 'Fechada',
    WORK_DAY: 'Dia Útil', DAY_OFF: 'Folga', HOLIDAY: 'Feriado', ABSENCE: 'Falta', JUSTIFIED_ABSENCE: 'Falta Justificada',
  };

  constructor(private prisma: PrismaService) {}

  private fmtHM(m: number): string {
    if (!m || isNaN(m)) return '0h00min';
    const h = Math.floor(Math.abs(m) / 60);
    const min = Math.abs(m) % 60;
    const sign = m < 0 ? '-' : '';
    return `${sign}${h}h${String(min).padStart(2, '0')}min`;
  }

  private translateType(type: string): string { return this.PUNCH_TYPE_PT[type] || type; }
  private translateStatus(status: string): string { return this.STATUS_PT[status] || status; }

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
          description: 'Consultar batidas/registros de ponto. Retorna TODAS as batidas (Entrada, Saída, Intervalos) agrupadas por funcionário e dia, COM cálculo automático de horas trabalhadas e extras.',
          parameters: {
            type: 'object',
            properties: {
              employeeId: { type: 'string', description: 'ID do funcionário' },
              employeeName: { type: 'string', description: 'Nome do funcionário' },
              startDate: { type: 'string', description: 'Data inicial (YYYY-MM-DD)' },
              endDate: { type: 'string', description: 'Data final (YYYY-MM-DD)' },
              limit: { type: 'number', description: 'Limite de resultados (padrão 100)' },
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
      {
        type: 'function' as const,
        function: {
          name: 'generate_pdf_report',
          description: 'Gerar um relatório em formato PDF para download e impressão. Use quando o usuário pedir para gerar PDF, imprimir, exportar, ou baixar relatório. Suporta: horas_extras, faltas, presenca, resumo_mensal, batidas_funcionario.',
          parameters: {
            type: 'object',
            properties: {
              reportType: { type: 'string', description: 'Tipo: horas_extras, faltas, presenca, resumo_mensal, batidas_funcionario', enum: ['horas_extras', 'faltas', 'presenca', 'resumo_mensal', 'batidas_funcionario'] },
              month: { type: 'number', description: 'Mês (1-12)' },
              year: { type: 'number', description: 'Ano' },
              employeeName: { type: 'string', description: 'Nome do funcionário (para relatório individual)' },
              department: { type: 'string', description: 'Filtrar por departamento' },
            },
            required: ['reportType', 'month', 'year'],
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
        case 'generate_pdf_report': return await this.generatePdfReport(args);
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
      funcionarios: employees.map(e => ({
        id: e.id,
        nome: e.name,
        cpf: e.cpf,
        pis: e.pis,
        cargo: e.position,
        departamento: e.department,
        escala: e.schedule?.name,
        filial: e.branch?.name,
        ativo: e.isActive,
        dataAdmissao: e.admissionDate,
      })),
    });
  }

  private async getEmployeeDetails(args: any): Promise<string> {
    const empId = await this.resolveEmployeeId(args);
    if (!empId) return JSON.stringify({ erro: 'Funcionário não encontrado' });

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

    if (!employee) return JSON.stringify({ erro: 'Funcionário não encontrado' });

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return JSON.stringify({
      id: employee.id,
      nome: employee.name,
      cpf: employee.cpf,
      pis: employee.pis,
      matricula: employee.registration,
      email: employee.email,
      telefone: employee.phone,
      cargo: employee.position,
      departamento: employee.department,
      filial: employee.branch?.name,
      ativo: employee.isActive,
      dataAdmissao: employee.admissionDate,
      dataDemissao: employee.terminationDate,
      escala: employee.schedule ? {
        nome: employee.schedule.name,
        horarios: employee.schedule.scheduleEntries.map(se => ({
          dia: dayNames[se.dayOfWeek],
          entrada: se.startTime,
          saida: se.endTime,
          inicioIntervalo: se.breakStartTime,
          fimIntervalo: se.breakEndTime,
          diaTrabalho: se.isWorkDay,
        })),
      } : null,
      folhaPontoAtual: employee.timesheets[0] ? {
        status: this.translateStatus(employee.timesheets[0].status),
        horasTrabalhadas: this.fmtHM(employee.timesheets[0].totalWorkedMinutes),
        horasExtras: this.fmtHM(employee.timesheets[0].totalOvertimeMinutes),
        horasFaltas: this.fmtHM(employee.timesheets[0].totalAbsenceMinutes),
        horasAtraso: this.fmtHM(employee.timesheets[0].totalLateMinutes),
      } : null,
      ultimasBatidas: employee.normalizedPunches.map(p => ({
        id: p.id,
        horario: new Date(p.punchTime).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        tipo: this.translateType(p.punchType),
        status: this.translateStatus(p.status),
      })),
    });
  }

  private async queryPunches(args: any): Promise<string> {
    const where: any = {};
    const empId = await this.resolveEmployeeId(args);
    if (empId) where.employeeId = empId;
    // Do NOT filter by punchType - always return ALL types
    if (args.startDate || args.endDate) {
      where.punchTime = {};
      if (args.startDate) where.punchTime.gte = new Date(`${args.startDate}T00:00:00.000Z`);
      if (args.endDate) where.punchTime.lte = new Date(`${args.endDate}T23:59:59.999Z`);
    }

    const punches = await this.prisma.normalizedPunch.findMany({
      where,
      take: args.limit || 100,
      orderBy: { punchTime: 'asc' },
      include: { employee: { select: { id: true, name: true, department: true, schedule: { select: { weeklyHours: true } } } } },
    });

    // Group punches by employee + day for overtime calculation
    const grouped: Record<string, { employeeName: string; department: string; weeklyHours: number; days: Record<string, any[]> }> = {};
    punches.forEach(p => {
      const empKey = p.employeeId;
      if (!grouped[empKey]) {
        grouped[empKey] = {
          employeeName: p.employee?.name || '',
          department: p.employee?.department || '',
          weeklyHours: p.employee?.schedule?.weeklyHours || 44,
          days: {},
        };
      }
      const dayKey = new Date(p.punchTime).toISOString().split('T')[0];
      if (!grouped[empKey].days[dayKey]) grouped[empKey].days[dayKey] = [];
      grouped[empKey].days[dayKey].push({
        id: p.id,
        horario: new Date(p.punchTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
        tipo: this.translateType(p.punchType),
        tipoOriginal: p.punchType,
        status: this.translateStatus(p.status),
      });
    });

    // Calculate hours per day
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const resultado: any[] = [];
    let totalMinutosTrabalhados = 0;
    let totalMinutosExtras = 0;

    for (const [empId, data] of Object.entries(grouped)) {
      const dailyExpectedHours = data.weeklyHours / 6; // 6 working days
      const empResult: any = {
        funcionario: data.employeeName,
        departamento: data.department,
        dias: [],
      };

      for (const [dayStr, dayPunches] of Object.entries(data.days)) {
        const d = new Date(dayStr + 'T12:00:00Z');
        const entries = dayPunches.filter((p: any) => p.tipoOriginal === 'ENTRY');
        const exits = dayPunches.filter((p: any) => p.tipoOriginal === 'EXIT');

        // Calculate worked minutes from entry/exit pairs
        let workedMinutes = 0;
        const minPairs = Math.min(entries.length, exits.length);
        for (let i = 0; i < minPairs; i++) {
          const entryTime = dayPunches.find((p: any) => p.tipoOriginal === 'ENTRY' && dayPunches.indexOf(p) >= i * 2);
          const exitTime = dayPunches.find((p: any) => p.tipoOriginal === 'EXIT' && dayPunches.indexOf(p) > dayPunches.indexOf(entryTime));
          if (entryTime && exitTime) {
            const [eh, em] = entryTime.horario.split(':').map(Number);
            const [xh, xm] = exitTime.horario.split(':').map(Number);
            workedMinutes += (xh * 60 + xm) - (eh * 60 + em);
          }
        }

        // Subtract break time
        const breakStarts = dayPunches.filter((p: any) => p.tipoOriginal === 'BREAK_START');
        const breakEnds = dayPunches.filter((p: any) => p.tipoOriginal === 'BREAK_END');
        for (let i = 0; i < Math.min(breakStarts.length, breakEnds.length); i++) {
          const [bsh, bsm] = breakStarts[i].horario.split(':').map(Number);
          const [beh, bem] = breakEnds[i].horario.split(':').map(Number);
          workedMinutes -= (beh * 60 + bem) - (bsh * 60 + bsm);
        }

        const expectedMinutes = dailyExpectedHours * 60;
        const overtimeMinutes = Math.max(0, workedMinutes - expectedMinutes);
        totalMinutosTrabalhados += workedMinutes;
        totalMinutosExtras += overtimeMinutes;

        empResult.dias.push({
          data: d.toLocaleDateString('pt-BR'),
          diaSemana: dayNames[d.getDay()],
          batidas: dayPunches.map((p: any) => `${p.horario} (${p.tipo})`),
          totalBatidas: dayPunches.length,
          horasTrabalhadas: this.fmtHM(workedMinutes),
          horasExtras: overtimeMinutes > 0 ? this.fmtHM(overtimeMinutes) : '0h00min',
        });
      }
      resultado.push(empResult);
    }

    return JSON.stringify({
      totalBatidas: punches.length,
      totalHorasTrabalhadas: this.fmtHM(totalMinutosTrabalhados),
      totalHorasExtras: this.fmtHM(totalMinutosExtras),
      funcionarios: resultado,
      instrucao: 'Os dados acima já incluem TODAS as batidas (Entrada, Saída, Início/Fim Intervalo) com cálculo de horas trabalhadas e extras. Apresente TODAS as batidas ao usuário, organizadas por dia.',
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
      folhasPonto: timesheets.map(ts => ({
        id: ts.id,
        funcionario: ts.employee?.name,
        departamento: ts.employee?.department,
        mes: ts.month,
        ano: ts.year,
        status: this.translateStatus(ts.status),
        horasTrabalhadas: this.fmtHM(ts.totalWorkedMinutes),
        horasExtras: this.fmtHM(ts.totalOvertimeMinutes),
        horasFaltas: this.fmtHM(ts.totalAbsenceMinutes),
        horasAtraso: this.fmtHM(ts.totalLateMinutes),
        horasNoturnas: this.fmtHM(ts.totalNightMinutes),
        saldo: this.fmtHM(ts.totalBalanceMinutes),
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

    if (!timesheet) return JSON.stringify({ erro: 'Folha de ponto não encontrada' });

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return JSON.stringify({
      funcionario: timesheet.employee?.name,
      mes: timesheet.month,
      ano: timesheet.year,
      status: this.translateStatus(timesheet.status),
      totais: {
        horasTrabalhadas: this.fmtHM(timesheet.totalWorkedMinutes),
        horasExtras: this.fmtHM(timesheet.totalOvertimeMinutes),
        horasFaltas: this.fmtHM(timesheet.totalAbsenceMinutes),
        horasAtraso: this.fmtHM(timesheet.totalLateMinutes),
      },
      dias: timesheet.timesheetDays.map(d => ({
        data: new Date(d.date).toLocaleDateString('pt-BR'),
        diaSemana: dayNames[new Date(d.date).getDay()],
        status: this.translateStatus(d.status),
        horasTrabalhadas: this.fmtHM(d.workedMinutes),
        horasExtras: this.fmtHM(d.overtimeMinutes),
        horasFaltas: this.fmtHM(d.absenceMinutes),
        horasAtraso: this.fmtHM(d.lateMinutes),
        quantidadeBatidas: d.punchCount,
        observacoes: d.notes,
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
      escalas: schedules.map(s => ({
        id: s.id,
        nome: s.name,
        tipo: s.type,
        horasSemanais: s.weeklyHours,
        totalFuncionarios: s._count.employees,
        horarios: s.scheduleEntries.map(se => ({
          dia: dayNames[se.dayOfWeek],
          entrada: se.startTime,
          saida: se.endTime,
          inicioIntervalo: se.breakStartTime,
          fimIntervalo: se.breakEndTime,
          diaTrabalho: se.isWorkDay,
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
      relatorio: 'Relatório de Horas Extras',
      periodo: `${String(args.month).padStart(2, '0')}/${args.year}`,
      totalFuncionarios: timesheets.length,
      totalHorasExtras: this.fmtHM(totalOvertime),
      funcionarios: timesheets.map(ts => ({
        nome: ts.employee?.name,
        departamento: ts.employee?.department,
        cargo: ts.employee?.position,
        horasExtras: this.fmtHM(ts.totalOvertimeMinutes),
        horasTrabalhadas: this.fmtHM(ts.totalWorkedMinutes),
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
      relatorio: 'Relatório de Faltas/Ausências',
      periodo: `${String(args.month).padStart(2, '0')}/${args.year}`,
      totalFuncionarios: timesheets.length,
      totalHorasFaltas: this.fmtHM(totalAbsence),
      funcionarios: timesheets.map(ts => ({
        nome: ts.employee?.name,
        departamento: ts.employee?.department,
        horasFaltas: this.fmtHM(ts.totalAbsenceMinutes),
        horasAtraso: this.fmtHM(ts.totalLateMinutes),
      })),
    });
  }

  private async generateAttendanceReport(args: any): Promise<string> {
    if (args.date) {
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
        relatorio: 'Relatório de Presença Diário',
        data: args.date,
        totalAtivos: totalEmployees,
        presentes: presentIds.size,
        ausentes: totalEmployees - presentIds.size,
        taxaPresenca: `${((presentIds.size / totalEmployees) * 100).toFixed(1)}%`,
        funcionariosPresentes: [...new Set(punches.map(p => p.employee?.name))].filter(Boolean),
      });
    }

    const month = args.month || new Date().getMonth() + 1;
    const year = args.year || new Date().getFullYear();
    const timesheets = await this.prisma.timesheet.findMany({
      where: { month, year },
      include: { employee: { select: { name: true, department: true } } },
      orderBy: { totalWorkedMinutes: 'desc' },
    });

    return JSON.stringify({
      relatorio: 'Relatório de Frequência Mensal',
      periodo: `${String(month).padStart(2, '0')}/${year}`,
      totalFuncionarios: timesheets.length,
      funcionarios: timesheets.map(ts => ({
        nome: ts.employee?.name,
        departamento: ts.employee?.department,
        horasTrabalhadas: this.fmtHM(ts.totalWorkedMinutes),
        horasFaltas: this.fmtHM(ts.totalAbsenceMinutes),
        horasAtraso: this.fmtHM(ts.totalLateMinutes),
        status: this.translateStatus(ts.status),
      })),
    });
  }

  private async adjustPunch(args: any): Promise<string> {
    const empId = await this.resolveEmployeeId(args);
    if (!empId) return JSON.stringify({ erro: 'Funcionário não encontrado' });

    if (args.punchId) {
      const punch = await this.prisma.normalizedPunch.findUnique({ where: { id: args.punchId } });
      if (!punch) return JSON.stringify({ erro: 'Batida não encontrada' });

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

      return JSON.stringify({ sucesso: true, mensagem: `Batida ajustada de ${punch.punchTime} para ${newDateTime.toISOString()}`, motivo: args.reason });
    }

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

        return JSON.stringify({ sucesso: true, mensagem: `Batida ajustada de ${args.originalTime} para ${args.newTime} em ${args.date}`, motivo: args.reason });
      }
      return JSON.stringify({ erro: 'Batida não encontrada no horário informado' });
    }

    return JSON.stringify({ erro: 'Informe punchId ou date+originalTime para identificar a batida' });
  }

  private async addManualPunch(args: any): Promise<string> {
    const empId = await this.resolveEmployeeId(args);
    if (!empId) return JSON.stringify({ erro: 'Funcionário não encontrado' });

    const punchTime = new Date(`${args.date}T${args.time}:00.000Z`);

    const rawEvent = await this.prisma.rawPunchEvent.create({
      data: {
        employeeId: empId,
        punchTime,
        source: 'MANUAL_AI',
        rawData: { addedBy: 'AI_ASSISTANT_RH', reason: args.reason },
      },
    });

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
      sucesso: true,
      mensagem: `Batida manual adicionada para ${employee?.name}: ${this.translateType(args.punchType)} às ${args.time} em ${args.date}`,
      motivo: args.reason,
    });
  }

  private async runCustomQuery(args: any): Promise<string> {
    const sql = args.sql.trim().toUpperCase();
    if (!sql.startsWith('SELECT')) {
      return JSON.stringify({ erro: 'Apenas consultas SELECT são permitidas por segurança' });
    }
    try {
      const result = await this.prisma.$queryRawUnsafe(args.sql);
      return JSON.stringify({ descricao: args.description, dados: result });
    } catch (error: any) {
      return JSON.stringify({ erro: `Erro na query: ${error.message}` });
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

    return JSON.stringify({
      relatorio: 'Relatório Resumo Mensal',
      periodo: `${String(args.month).padStart(2, '0')}/${args.year}`,
      totalFuncionarios: timesheets.length,
      totaisGerais: {
        horasTrabalhadas: this.fmtHM(totalWorked),
        horasExtras: this.fmtHM(totalOvertime),
        horasFaltas: this.fmtHM(totalAbsence),
        horasAtraso: this.fmtHM(totalLate),
      },
      funcionarios: timesheets.map(ts => ({
        nome: ts.employee?.name,
        departamento: ts.employee?.department,
        cargo: ts.employee?.position,
        escala: ts.employee?.schedule?.name,
        horasTrabalhadas: this.fmtHM(ts.totalWorkedMinutes),
        horasExtras: this.fmtHM(ts.totalOvertimeMinutes),
        horasFaltas: this.fmtHM(ts.totalAbsenceMinutes),
        horasAtraso: this.fmtHM(ts.totalLateMinutes),
        saldo: this.fmtHM(ts.totalBalanceMinutes),
        status: this.translateStatus(ts.status),
      })),
    });
  }

  // ==================== PDF GENERATION (IMPROVED) ====================

  private async generatePdfReport(args: any): Promise<string> {
    try {
      const PDFDocument = (await import('pdfkit')).default;
      if (!fs.existsSync(this.PDF_DIR)) fs.mkdirSync(this.PDF_DIR, { recursive: true });

      const monthNames = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      const fileName = `relatorio-${args.reportType}-${args.month}-${args.year}-${Date.now()}.pdf`;
      const filePath = path.join(this.PDF_DIR, fileName);

      const doc = new PDFDocument({ size: 'A4', margin: 35, bufferPages: true });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const pageW = doc.page.width;
      const contentW = pageW - 70; // 35px margins each side

      // ==================== HEADER ====================
      const drawHeader = (title: string, subtitle: string) => {
        // Gradient-like header
        doc.rect(0, 0, pageW, 90).fill('#1E293B');
        doc.rect(0, 85, pageW, 5).fill('#4F46E5');

        doc.fontSize(22).fillColor('#FFFFFF').font('Helvetica-Bold').text('PONTO ONLINE', 40, 18);
        doc.fontSize(9).fillColor('#94A3B8').font('Helvetica').text('Sistema de Controle de Ponto Eletrônico', 40, 44);

        // Right-aligned date
        doc.fontSize(8).fillColor('#94A3B8').text(
          `Gerado: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
          pageW - 200, 18, { width: 160, align: 'right' }
        );

        doc.y = 105;

        // Report title
        doc.fontSize(18).fillColor('#1E293B').font('Helvetica-Bold').text(title, 35);
        doc.fontSize(11).fillColor('#64748B').font('Helvetica').text(subtitle, 35);
        doc.moveDown(0.8);
      };

      // ==================== SUMMARY BOXES ====================
      const drawSummaryBox = (x: number, y: number, w: number, label: string, value: string, bgColor: string, borderColor: string, textColor: string) => {
        // Rounded box effect
        doc.rect(x, y, w, 55).fill(bgColor);
        doc.rect(x, y, 4, 55).fill(borderColor); // Left accent bar
        doc.fontSize(9).fillColor(textColor).font('Helvetica-Bold').text(label.toUpperCase(), x + 14, y + 10, { width: w - 20 });
        doc.fontSize(20).fillColor('#1E293B').font('Helvetica-Bold').text(value, x + 14, y + 28, { width: w - 20 });
      };

      // ==================== TABLE ====================
      const drawTableHeader = (headers: string[], colWidths: number[], y: number) => {
        let x = 35;
        const totalW = colWidths.reduce((a, b) => a + b, 0);
        doc.rect(35, y, totalW, 26).fill('#1E293B');
        headers.forEach((h, i) => {
          doc.fontSize(8).fillColor('#FFFFFF').font('Helvetica-Bold').text(h.toUpperCase(), x + 5, y + 8, { width: colWidths[i] - 10 });
          x += colWidths[i];
        });
        return y + 26;
      };

      const drawTableRow = (cells: string[], colWidths: number[], y: number, isEven: boolean, highlights?: Record<number, string>) => {
        let x = 35;
        const totalW = colWidths.reduce((a, b) => a + b, 0);
        const rowH = 20;
        const rowColor = isEven ? '#F8FAFC' : '#FFFFFF';
        doc.rect(35, y, totalW, rowH).fill(rowColor);

        // Bottom border
        doc.rect(35, y + rowH - 0.5, totalW, 0.5).fill('#E2E8F0');

        cells.forEach((c, i) => {
          const color = highlights?.[i] || '#334155';
          doc.fontSize(7.5).fillColor(color).font(highlights?.[i] ? 'Helvetica-Bold' : 'Helvetica').text(c || '-', x + 5, y + 6, { width: colWidths[i] - 10 });
          x += colWidths[i];
        });
        return y + rowH;
      };

      // ==================== TOTALS ROW ====================
      const drawTotalsRow = (cells: string[], colWidths: number[], y: number) => {
        let x = 35;
        const totalW = colWidths.reduce((a, b) => a + b, 0);
        doc.rect(35, y, totalW, 24).fill('#EEF2FF');
        doc.rect(35, y, totalW, 1).fill('#4F46E5');
        cells.forEach((c, i) => {
          doc.fontSize(8).fillColor('#1E293B').font('Helvetica-Bold').text(c, x + 5, y + 7, { width: colWidths[i] - 10 });
          x += colWidths[i];
        });
        return y + 24;
      };

      const checkPage = (y: number, headers: string[], widths: number[]): number => {
        if (y > 740) {
          doc.addPage();
          return drawTableHeader(headers, widths, 35);
        }
        return y;
      };

      // ==================== REPORT TYPES ====================

      switch (args.reportType) {
        case 'horas_extras': {
          const timesheets = await this.prisma.timesheet.findMany({
            where: {
              month: args.month, year: args.year,
              totalOvertimeMinutes: { gt: 0 },
              ...(args.department ? { employee: { department: { contains: args.department, mode: 'insensitive' as any } } } : {}),
            },
            include: { employee: { select: { name: true, department: true, position: true } } },
            orderBy: { totalOvertimeMinutes: 'desc' },
          });

          const totalOT = timesheets.reduce((s, t) => s + t.totalOvertimeMinutes, 0);
          const totalW = timesheets.reduce((s, t) => s + t.totalWorkedMinutes, 0);

          drawHeader('Relatório de Horas Extras', `${monthNames[args.month]} de ${args.year} — ${timesheets.length} funcionários`);

          const boxY = doc.y;
          drawSummaryBox(35, boxY, 165, 'Funcionários', `${timesheets.length}`, '#EEF2FF', '#4F46E5', '#4F46E5');
          drawSummaryBox(210, boxY, 165, 'Total H. Extras', this.fmtHM(totalOT), '#FEF3C7', '#F59E0B', '#D97706');
          drawSummaryBox(385, boxY, 170, 'Total Trabalhadas', this.fmtHM(totalW), '#DCFCE7', '#22C55E', '#16A34A');

          doc.y = boxY + 70;

          const headers = ['#', 'Nome', 'Departamento', 'Cargo', 'H. Extras', 'H. Trabalhadas'];
          const widths = [25, 140, 95, 95, 80, 80];
          let y = drawTableHeader(headers, widths, doc.y);

          timesheets.forEach((ts, i) => {
            y = checkPage(y, headers, widths);
            // Highlight overtime > 20h in red
            const otColor = ts.totalOvertimeMinutes > 1200 ? '#DC2626' : ts.totalOvertimeMinutes > 600 ? '#D97706' : '#334155';
            y = drawTableRow([
              `${i + 1}`,
              ts.employee?.name || '',
              ts.employee?.department || '',
              ts.employee?.position || '',
              this.fmtHM(ts.totalOvertimeMinutes),
              this.fmtHM(ts.totalWorkedMinutes),
            ], widths, y, i % 2 === 0, { 4: otColor });
          });

          // TOTALS ROW
          y = checkPage(y, headers, widths);
          y = drawTotalsRow(['', 'TOTAL GERAL', `${timesheets.length} func.`, '', this.fmtHM(totalOT), this.fmtHM(totalW)], widths, y);
          break;
        }

        case 'faltas': {
          const timesheets = await this.prisma.timesheet.findMany({
            where: {
              month: args.month, year: args.year,
              totalAbsenceMinutes: { gt: 0 },
              ...(args.department ? { employee: { department: { contains: args.department, mode: 'insensitive' as any } } } : {}),
            },
            include: { employee: { select: { name: true, department: true } } },
            orderBy: { totalAbsenceMinutes: 'desc' },
          });

          const totalAbs = timesheets.reduce((s, t) => s + t.totalAbsenceMinutes, 0);
          const totalLate = timesheets.reduce((s, t) => s + t.totalLateMinutes, 0);

          drawHeader('Relatório de Faltas e Ausências', `${monthNames[args.month]} de ${args.year}`);

          const boxY = doc.y;
          drawSummaryBox(35, boxY, 165, 'Com Faltas', `${timesheets.length}`, '#FEE2E2', '#EF4444', '#DC2626');
          drawSummaryBox(210, boxY, 165, 'Total Faltas', this.fmtHM(totalAbs), '#FEE2E2', '#EF4444', '#DC2626');
          drawSummaryBox(385, boxY, 170, 'Total Atrasos', this.fmtHM(totalLate), '#FEF3C7', '#F59E0B', '#D97706');

          doc.y = boxY + 70;

          const headers = ['#', 'Nome', 'Departamento', 'Horas Faltas', 'Horas Atraso'];
          const widths = [25, 190, 140, 80, 80];
          let y = drawTableHeader(headers, widths, doc.y);

          timesheets.forEach((ts, i) => {
            y = checkPage(y, headers, widths);
            const absColor = ts.totalAbsenceMinutes > 2400 ? '#DC2626' : ts.totalAbsenceMinutes > 480 ? '#D97706' : '#334155';
            y = drawTableRow([
              `${i + 1}`,
              ts.employee?.name || '',
              ts.employee?.department || '',
              this.fmtHM(ts.totalAbsenceMinutes),
              this.fmtHM(ts.totalLateMinutes),
            ], widths, y, i % 2 === 0, { 3: absColor });
          });

          y = checkPage(y, headers, widths);
          y = drawTotalsRow(['', 'TOTAL GERAL', `${timesheets.length} func.`, this.fmtHM(totalAbs), this.fmtHM(totalLate)], widths, y);
          break;
        }

        case 'resumo_mensal': {
          const timesheets = await this.prisma.timesheet.findMany({
            where: { month: args.month, year: args.year },
            include: { employee: { select: { name: true, department: true, position: true } } },
            orderBy: { employee: { name: 'asc' } },
          });

          const totalW = timesheets.reduce((s, t) => s + t.totalWorkedMinutes, 0);
          const totalOT = timesheets.reduce((s, t) => s + t.totalOvertimeMinutes, 0);
          const totalAbs = timesheets.reduce((s, t) => s + t.totalAbsenceMinutes, 0);
          const totalLate = timesheets.reduce((s, t) => s + t.totalLateMinutes, 0);

          drawHeader('Relatório Resumo Mensal', `${monthNames[args.month]} de ${args.year} — ${timesheets.length} funcionários`);

          const boxY = doc.y;
          const bw = (contentW - 15) / 4; // 4 boxes
          drawSummaryBox(35, boxY, bw, 'Trabalhadas', this.fmtHM(totalW), '#EEF2FF', '#4F46E5', '#4F46E5');
          drawSummaryBox(35 + bw + 5, boxY, bw, 'Extras', this.fmtHM(totalOT), '#FEF3C7', '#F59E0B', '#D97706');
          drawSummaryBox(35 + (bw + 5) * 2, boxY, bw, 'Faltas', this.fmtHM(totalAbs), '#FEE2E2', '#EF4444', '#DC2626');
          drawSummaryBox(35 + (bw + 5) * 3, boxY, bw, 'Atrasos', this.fmtHM(totalLate), '#FFF7ED', '#F97316', '#EA580C');

          doc.y = boxY + 70;

          const headers = ['#', 'Nome', 'Depto', 'Trabalhadas', 'Extras', 'Faltas', 'Atrasos'];
          const widths = [22, 130, 80, 75, 70, 70, 68];
          let y = drawTableHeader(headers, widths, doc.y);

          timesheets.forEach((ts, i) => {
            y = checkPage(y, headers, widths);
            const otColor = ts.totalOvertimeMinutes > 600 ? '#D97706' : '#334155';
            const absColor = ts.totalAbsenceMinutes > 480 ? '#DC2626' : '#334155';
            y = drawTableRow([
              `${i + 1}`,
              ts.employee?.name || '',
              ts.employee?.department || '',
              this.fmtHM(ts.totalWorkedMinutes),
              this.fmtHM(ts.totalOvertimeMinutes),
              this.fmtHM(ts.totalAbsenceMinutes),
              this.fmtHM(ts.totalLateMinutes),
            ], widths, y, i % 2 === 0, { 4: otColor, 5: absColor });
          });

          y = checkPage(y, headers, widths);
          y = drawTotalsRow([
            '', 'TOTAL GERAL', `${timesheets.length} func.`,
            this.fmtHM(totalW), this.fmtHM(totalOT), this.fmtHM(totalAbs), this.fmtHM(totalLate),
          ], widths, y);
          break;
        }

        case 'batidas_funcionario': {
          const empId = await this.resolveEmployeeId({ employeeName: args.employeeName });
          if (!empId) {
            doc.end();
            try { fs.unlinkSync(filePath); } catch (e) {}
            return JSON.stringify({ erro: 'Funcionário não encontrado para gerar PDF de batidas' });
          }

          const employee = await this.prisma.employee.findUnique({ where: { id: empId }, select: { name: true, department: true, position: true } });
          const startDate = new Date(args.year, args.month - 1, 1);
          const endDate = new Date(args.year, args.month, 0, 23, 59, 59);

          const punches = await this.prisma.normalizedPunch.findMany({
            where: { employeeId: empId, punchTime: { gte: startDate, lte: endDate } },
            orderBy: { punchTime: 'asc' },
          });

          drawHeader('Relatório de Batidas Individual', `${employee?.name || ''} — ${monthNames[args.month]} de ${args.year}`);

          // Employee info box
          const infoY = doc.y;
          doc.rect(35, infoY, contentW, 45).fill('#F8FAFC');
          doc.rect(35, infoY, contentW, 0.5).fill('#E2E8F0');
          doc.rect(35, infoY + 45, contentW, 0.5).fill('#E2E8F0');
          doc.fontSize(9).fillColor('#64748B').font('Helvetica').text('Funcionário:', 45, infoY + 8);
          doc.fontSize(10).fillColor('#1E293B').font('Helvetica-Bold').text(employee?.name || '', 120, infoY + 7);
          doc.fontSize(9).fillColor('#64748B').font('Helvetica').text('Departamento:', 45, infoY + 22);
          doc.fontSize(9).fillColor('#1E293B').font('Helvetica-Bold').text(employee?.department || '-', 130, infoY + 22);
          doc.fontSize(9).fillColor('#64748B').font('Helvetica').text('Cargo:', 280, infoY + 22);
          doc.fontSize(9).fillColor('#1E293B').font('Helvetica-Bold').text(employee?.position || '-', 320, infoY + 22);
          doc.fontSize(9).fillColor('#64748B').font('Helvetica').text('Total de batidas:', 45, infoY + 35);
          doc.fontSize(10).fillColor('#4F46E5').font('Helvetica-Bold').text(`${punches.length}`, 140, infoY + 34);

          doc.y = infoY + 58;

          const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
          const headers = ['Data', 'Dia', 'Tipo', 'Horário', 'Status'];
          const widths = [85, 55, 130, 80, 165];
          let y = drawTableHeader(headers, widths, doc.y);

          punches.forEach((p, i) => {
            y = checkPage(y, headers, widths);
            const d = new Date(p.punchTime);
            const typeColor = p.punchType === 'ENTRY' ? '#16A34A' : p.punchType === 'EXIT' ? '#DC2626' : '#D97706';
            y = drawTableRow([
              d.toLocaleDateString('pt-BR'),
              dayNames[d.getDay()],
              this.translateType(p.punchType),
              d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              this.translateStatus(p.status || 'NORMAL'),
            ], widths, y, i % 2 === 0, { 2: typeColor });
          });

          // Summary at end
          y = checkPage(y, headers, widths);
          y += 5;
          const totalW = widths.reduce((a, b) => a + b, 0);
          doc.rect(35, y, totalW, 24).fill('#EEF2FF');
          doc.rect(35, y, totalW, 1).fill('#4F46E5');
          const entries = punches.filter(p => p.punchType === 'ENTRY').length;
          const exits = punches.filter(p => p.punchType === 'EXIT').length;
          doc.fontSize(8).fillColor('#1E293B').font('Helvetica-Bold')
            .text(`RESUMO: ${punches.length} batidas total — ${entries} entradas, ${exits} saídas — ${monthNames[args.month]} ${args.year}`, 45, y + 7, { width: totalW - 20 });
          break;
        }

        case 'presenca': {
          const timesheets = await this.prisma.timesheet.findMany({
            where: { month: args.month, year: args.year },
            include: { employee: { select: { name: true, department: true } } },
            orderBy: { totalWorkedMinutes: 'desc' },
          });

          const totalActive = await this.prisma.employee.count({ where: { isActive: true } });
          const withWork = timesheets.filter(t => t.totalWorkedMinutes > 0).length;
          const totalW = timesheets.reduce((s, t) => s + t.totalWorkedMinutes, 0);
          const totalAbs = timesheets.reduce((s, t) => s + t.totalAbsenceMinutes, 0);

          drawHeader('Relatório de Frequência/Presença', `${monthNames[args.month]} de ${args.year}`);

          const boxY = doc.y;
          drawSummaryBox(35, boxY, 130, 'Com Registro', `${withWork}/${totalActive}`, '#DCFCE7', '#22C55E', '#16A34A');
          drawSummaryBox(175, boxY, 130, 'Taxa Presença', `${((withWork / totalActive) * 100).toFixed(1)}%`, '#EEF2FF', '#4F46E5', '#4F46E5');
          drawSummaryBox(315, boxY, 115, 'H. Trabalhadas', this.fmtHM(totalW), '#FFF7ED', '#F97316', '#EA580C');
          drawSummaryBox(440, boxY, 115, 'H. Faltas', this.fmtHM(totalAbs), '#FEE2E2', '#EF4444', '#DC2626');

          doc.y = boxY + 70;

          const headers = ['#', 'Nome', 'Departamento', 'Trabalhadas', 'Faltas', 'Atrasos', 'Status'];
          const widths = [22, 130, 95, 75, 70, 70, 53];
          let y = drawTableHeader(headers, widths, doc.y);

          timesheets.forEach((ts, i) => {
            y = checkPage(y, headers, widths);
            const absColor = ts.totalAbsenceMinutes > 480 ? '#DC2626' : '#334155';
            const statusColor = ts.totalWorkedMinutes > 0 ? '#16A34A' : '#DC2626';
            y = drawTableRow([
              `${i + 1}`,
              ts.employee?.name || '',
              ts.employee?.department || '',
              this.fmtHM(ts.totalWorkedMinutes),
              this.fmtHM(ts.totalAbsenceMinutes),
              this.fmtHM(ts.totalLateMinutes),
              this.translateStatus(ts.status),
            ], widths, y, i % 2 === 0, { 4: absColor, 6: statusColor });
          });

          y = checkPage(y, headers, widths);
          y = drawTotalsRow([
            '', 'TOTAL GERAL', `${timesheets.length} func.`,
            this.fmtHM(totalW), this.fmtHM(totalAbs), this.fmtHM(timesheets.reduce((s, t) => s + t.totalLateMinutes, 0)), '',
          ], widths, y);
          break;
        }
      }

      // Footer on all pages
      const pages = doc.bufferedPageRange();
      for (let i = pages.start; i < pages.start + pages.count; i++) {
        doc.switchToPage(i);
        // Footer bar
        doc.rect(0, doc.page.height - 35, pageW, 35).fill('#1E293B');
        doc.fontSize(7).fillColor('#94A3B8').font('Helvetica')
          .text(
            `Ponto Online — Relatório gerado pelo Assistente IA — ${new Date().toLocaleDateString('pt-BR')}`,
            40, doc.page.height - 22, { width: 300 }
          );
        doc.fontSize(7).fillColor('#94A3B8')
          .text(
            `Página ${i - pages.start + 1} de ${pages.count}`,
            pageW - 120, doc.page.height - 22, { width: 80, align: 'right' }
          );
      }

      doc.end();
      await new Promise<void>((resolve) => stream.on('finish', resolve));

      const downloadUrl = `/api/v1/ai-assistant/pdf/${fileName}`;
      return JSON.stringify({
        sucesso: true,
        mensagem: `PDF gerado com sucesso! Use o botão abaixo para baixar.`,
        downloadUrl,
        nomeArquivo: fileName,
      });
    } catch (error: any) {
      this.logger.error(`PDF generation error: ${error.message}`, error.stack);
      return JSON.stringify({ erro: `Erro ao gerar PDF: ${error.message}` });
    }
  }

  // Method to get PDF file path for controller
  getPdfPath(fileName: string): string | null {
    const filePath = path.join(this.PDF_DIR, fileName);
    if (fs.existsSync(filePath)) return filePath;
    return null;
  }

  // ==================== MAIN CHAT ====================

  async chat(message: string, conversationHistory: { role: string; content: string }[]) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const systemPrompt = `Você é o Assistente de RH do sistema Ponto Online. Você é ESPECIALISTA em gestão de ponto eletrônico e recursos humanos.

## SUAS CAPACIDADES
- Consultar QUALQUER informação: funcionários, batidas, escalas, folhas de ponto, horas extras
- Gerar relatórios detalhados em tabela ou PDF para download/impressão
- Ajustar e adicionar batidas manualmente
- Executar consultas SQL de leitura
- Guiar o RH pelo sistema com links diretos para cada página
- Calcular horas extras, faltas, atrasos automaticamente

## REGRA NÚMERO 1: IDIOMA
Você DEVE responder SEMPRE e EXCLUSIVAMENTE em português brasileiro. NUNCA use inglês.
Traduções obrigatórias:
- ENTRY = Entrada | EXIT = Saída | BREAK_START = Início Intervalo | BREAK_END = Fim Intervalo
- NORMAL = Normal | ADJUSTED = Ajustado | MANUAL = Manual
- OPEN = Aberta | CALCULATED = Calculada | APPROVED = Aprovada | LOCKED = Fechada
- WORK_DAY = Dia Útil | DAY_OFF = Folga | HOLIDAY = Feriado | ABSENCE = Falta

## REGRAS DE BATIDAS
Quando o usuário pedir batidas de hoje ou de qualquer período:
1. SEMPRE mostre TODAS as batidas (Entrada + Saída + Intervalos) de cada funcionário
2. Organize por funcionário e por dia
3. Calcule automaticamente as horas trabalhadas (diferença entre Entrada e Saída, descontando intervalo)
4. Calcule horas extras (trabalhadas - jornada esperada)
5. Mostre um resumo ao final com totais

## REGRAS DE PDF
Quando o usuário pedir PDF, relatório para download, imprimir, ou exportar:
1. Use a ferramenta generate_pdf_report
2. Após gerar, responda com o botão de download EXATAMENTE neste formato:
   [📥 Baixar Relatório PDF](/api/v1/ai-assistant/pdf/NOME_DO_ARQUIVO.pdf)
3. O link DEVE começar com /api/v1/ (URL relativa)

## MAPA DO SISTEMA (para guiar o usuário)
1. **Dashboard** (/dashboard) - Painel com estatísticas gerais
2. **Filiais** (/branches) - Cadastro de filiais
3. **Colaboradores** (/employees) - Cadastro de funcionários
4. **Dispositivos** (/devices) - Relógios de ponto
5. **Escalas** (/schedules) - Escalas de trabalho
6. **Registros de Ponto** (/punches) - Todas as batidas
7. **Folhas de Ponto** (/timesheets) - Folhas mensais com cálculos
8. **Relatórios** (/reports) - Central de relatórios
9. **Horas Extras** (/overtime) - Gestão de horas extras
10. **Assistente IA** (/ai-assistant) - Este assistente em tela cheia

## COMO GUIAR O USUÁRIO
Use botões de navegação: [🔗 Nome da Página](/caminho)
Exemplo: "Acesse: [🔗 Colaboradores](/employees) para cadastrar um novo funcionário."

## FORMATAÇÃO DAS RESPOSTAS
- Use **negrito** para destaques
- Use tabelas markdown para listar dados (com cabeçalho | e separador |---|)
- Inclua somatórios ao final das tabelas
- Inclua botões de navegação relevantes
- Seja objetivo e claro
- Quando mostrar horas, use formato Xh XXmin (ex: 8h30min)

## CONTEXTO ATUAL
- Data: ${now.toLocaleDateString('pt-BR')}
- Mês/Ano atual: ${currentMonth}/${currentYear}
- Quando o usuário dizer "hoje", "este mês", etc., use as datas acima`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-20).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    try {
      let response = await this.callOpenAI(messages, this.getTools());
      let assistantMessage = response.choices[0].message;
      const allMessages = [...messages];

      let iterations = 0;
      while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0 && iterations < 10) {
        iterations++;
        allMessages.push(assistantMessage);

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
