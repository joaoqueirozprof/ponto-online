export class NormalHoursCalculator {
  private standardDayMinutes = 480;

  calculateWorkedMinutes(
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

    return workedMinutes;
  }

  isCompletDay(
    punches: Array<{ time: Date; type: string }>,
    breakMinutes: number = 60,
  ): boolean {
    const workedMinutes = this.calculateWorkedMinutes(punches, breakMinutes);
    return workedMinutes >= this.standardDayMinutes;
  }

  calculateMissingMinutes(
    punches: Array<{ time: Date; type: string }>,
    breakMinutes: number = 60,
  ): number {
    const workedMinutes = this.calculateWorkedMinutes(punches, breakMinutes);
    return Math.max(0, this.standardDayMinutes - workedMinutes);
  }
}
