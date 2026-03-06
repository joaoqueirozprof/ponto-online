export class OvertimeCalculator {
  private standardDayMinutes = 480;
  private standardWeekMinutes = 2400;

  calculateDailyOvertime(
    punches: Array<{ time: Date; type: string }>,
    breakMinutes: number = 60,
  ): number {
    if (punches.length === 0) return 0;

    const entries = punches.filter((p) => p.type === 'ENTRY');
    const exits = punches.filter((p) => p.type === 'EXIT');

    if (entries.length === 0 || exits.length === 0) return 0;

    const firstEntry = new Date(entries[0].time);
    const lastExit = new Date(exits[exits.length - 1].time);

    const totalMinutes = Math.round((lastExit.getTime() - firstEntry.getTime()) / 60000);
    const workedMinutes = Math.max(0, totalMinutes - breakMinutes);

    return Math.max(0, workedMinutes - this.standardDayMinutes);
  }

  calculateWeeklyOvertime(dailyOvertimes: number[]): number {
    const totalOvertime = dailyOvertimes.reduce((a, b) => a + b, 0);
    return Math.max(0, totalOvertime);
  }

  calculateMonthlyOvertime(weeklyOvertimes: number[]): number {
    return weeklyOvertimes.reduce((a, b) => a + b, 0);
  }

  hasOvertimeExceeded(monthlyOvertime: number, maxMonthlyOvertime: number = 20 * 60): boolean {
    return monthlyOvertime > maxMonthlyOvertime;
  }
}
