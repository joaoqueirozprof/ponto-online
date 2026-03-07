import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class HolidaysService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: any) {
    return this.prisma.holiday.create({
      data: dto,
      include: {
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async findAll(branchId?: string, skip: any = 0, take: any = 50, search?: string, year?: number) {
    skip = Number(skip) || 0;
    take = Number(take) || 50;
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (year) {
      const startDate = new Date(Number(year), 0, 1);
      const endDate = new Date(Number(year) + 1, 0, 1);
      where.date = { gte: startDate, lt: endDate };
    }

    const [data, total] = await Promise.all([
      this.prisma.holiday.findMany({
        where,
        skip,
        take,
        include: {
          branch: { select: { id: true, name: true } },
        },
        orderBy: { date: 'asc' },
      }),
      this.prisma.holiday.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async findOne(id: string) {
    const holiday = await this.prisma.holiday.findUnique({
      where: { id },
      include: {
        branch: true,
      },
    });

    if (!holiday) {
      throw new NotFoundException(`Holiday with ID ${id} not found`);
    }

    return holiday;
  }

  async update(id: string, dto: any) {
    await this.findOne(id);

    return this.prisma.holiday.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.holiday.delete({
      where: { id },
    });
  }

  // Easter calculation (Meeus/Jones/Butcher algorithm)
  private getEasterDate(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  async seedNationalHolidays(year: number) {
    const easter = this.getEasterDate(year);
    const easterMs = easter.getTime();

    // Carnival: 47 days before Easter (Tuesday)
    const carnival = new Date(easterMs - 47 * 24 * 60 * 60 * 1000);
    // Carnival Monday
    const carnivalMonday = new Date(easterMs - 48 * 24 * 60 * 60 * 1000);
    // Good Friday: 2 days before Easter
    const goodFriday = new Date(easterMs - 2 * 24 * 60 * 60 * 1000);
    // Corpus Christi: 60 days after Easter
    const corpusChristi = new Date(easterMs + 60 * 24 * 60 * 60 * 1000);

    const holidays = [
      { name: 'Confraternização Universal', date: new Date(year, 0, 1), type: 'NATIONAL' },
      { name: 'Carnaval (Segunda)', date: carnivalMonday, type: 'NATIONAL' },
      { name: 'Carnaval (Terça)', date: carnival, type: 'NATIONAL' },
      { name: 'Quarta-feira de Cinzas (até 14h)', date: new Date(easterMs - 46 * 24 * 60 * 60 * 1000), type: 'NATIONAL' },
      { name: 'Sexta-feira Santa', date: goodFriday, type: 'NATIONAL' },
      { name: 'Tiradentes', date: new Date(year, 3, 21), type: 'NATIONAL' },
      { name: 'Dia do Trabalho', date: new Date(year, 4, 1), type: 'NATIONAL' },
      { name: 'Corpus Christi', date: corpusChristi, type: 'NATIONAL' },
      { name: 'Independência do Brasil', date: new Date(year, 8, 7), type: 'NATIONAL' },
      { name: 'Nossa Senhora Aparecida', date: new Date(year, 9, 12), type: 'NATIONAL' },
      { name: 'Finados', date: new Date(year, 10, 2), type: 'NATIONAL' },
      { name: 'Proclamação da República', date: new Date(year, 10, 15), type: 'NATIONAL' },
      { name: 'Dia da Consciência Negra', date: new Date(year, 10, 20), type: 'NATIONAL' },
      { name: 'Natal', date: new Date(year, 11, 25), type: 'NATIONAL' },
    ];

    const results = [];
    for (const h of holidays) {
      // Check if already exists for this date
      const existing = await this.prisma.holiday.findFirst({
        where: {
          date: h.date,
          type: 'NATIONAL',
        },
      });
      if (!existing) {
        const created = await this.prisma.holiday.create({
          data: h,
          include: { branch: { select: { id: true, name: true } } },
        });
        results.push(created);
      }
    }

    return { created: results.length, holidays: results, message: `${results.length} feriados nacionais criados para ${year}` };
  }
}
