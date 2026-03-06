export class TimeBalanceCalculator {
  private standardMonthlyMinutes = 9600;

  calculateBalance(
    workedMinutes: number,
    previousBalance: number = 0,
  ): number {
    const difference = workedMinutes - this.standardMonthlyMinutes;
    return previousBalance + difference;
  }

  calculateMonthlyBalance(
    workedMinutes: number,
  ): number {
    return workedMinutes - this.standardMonthlyMinutes;
  }

  calculateYearlyBalance(monthlyBalances: number[]): number {
    return monthlyBalances.reduce((a, b) => a + b, 0);
  }

  formatBalance(balanceMinutes: number): {
    hours: number;
    minutes: number;
    sign: string;
  } {
    const sign = balanceMinutes >= 0 ? '+' : '-';
    const absMinutes = Math.abs(balanceMinutes);
    const hours = Math.floor(absMinutes / 60);
    const minutes = absMinutes % 60;

    return { hours, minutes, sign };
  }

  canUsePaidTimeOff(balanceMinutes: number): boolean {
    return balanceMinutes >= 60;
  }

  calculatePaidTimeOffDays(balanceMinutes: number): number {
    const minutesPerDay = 480;
    return Math.floor(balanceMinutes / minutesPerDay);
  }

  deductPaidTimeOff(
    balanceMinutes: number,
    daysToDeduct: number,
  ): number {
    const minutesPerDay = 480;
    const minutesToDeduct = daysToDeduct * minutesPerDay;

    return balanceMinutes - minutesToDeduct;
  }
}
