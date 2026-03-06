export class NightShiftCalculator {
  private nightShiftStart = 22;
  private nightShiftEnd = 5;

  isNightShiftTime(hour: number): boolean {
    return hour >= this.nightShiftStart || hour < this.nightShiftEnd;
  }

  calculateNightShiftMinutes(
    punches: Array<{ time: Date; type: string }>,
    breakMinutes: number = 60,
  ): number {
    if (punches.length < 2) return 0;

    const entries = punches.filter((p) => p.type === 'ENTRY');
    const exits = punches.filter((p) => p.type === 'EXIT');

    if (entries.length === 0 || exits.length === 0) return 0;

    const firstEntry = new Date(entries[0].time);
    const lastExit = new Date(exits[exits.length - 1].time);

    let nightMinutes = 0;
    let currentTime = new Date(firstEntry);

    while (currentTime < lastExit) {
      const hour = currentTime.getHours();

      if (this.isNightShiftTime(hour)) {
        nightMinutes += 60;
      }

      currentTime.setHours(currentTime.getHours() + 1);
    }

    return Math.max(0, nightMinutes - breakMinutes);
  }

  calculateNightShiftBonus(nightShiftMinutes: number, bonusPercentage: number = 20): number {
    return Math.round((nightShiftMinutes / 60) * (bonusPercentage / 100) * 60);
  }
}
