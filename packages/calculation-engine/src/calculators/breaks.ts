export class BreaksCalculator {
  calculateBreakDuration(
    breakStartTime: Date,
    breakEndTime: Date,
  ): number {
    return Math.round((breakEndTime.getTime() - breakStartTime.getTime()) / 60000);
  }

  hasMinimumBreak(
    breakDuration: number,
    minimumBreakMinutes: number = 60,
  ): boolean {
    return breakDuration >= minimumBreakMinutes;
  }

  identifyMissingBreaks(
    punches: Array<{ time: Date; type: string }>,
    minimumBreakMinutes: number = 60,
  ): boolean {
    const breakStarts = punches.filter((p) => p.type === 'BREAK_START');
    const breakEnds = punches.filter((p) => p.type === 'BREAK_END');

    if (breakStarts.length === 0 || breakEnds.length === 0) {
      return true;
    }

    for (let i = 0; i < breakStarts.length; i++) {
      const duration = this.calculateBreakDuration(
        breakStarts[i].time,
        breakEnds[i].time,
      );

      if (duration < minimumBreakMinutes) {
        return true;
      }
    }

    return false;
  }

  calculateTotalBreakTime(
    breakStarts: Date[],
    breakEnds: Date[],
  ): number {
    let totalBreakMinutes = 0;

    for (let i = 0; i < Math.min(breakStarts.length, breakEnds.length); i++) {
      totalBreakMinutes += this.calculateBreakDuration(breakStarts[i], breakEnds[i]);
    }

    return totalBreakMinutes;
  }
}
