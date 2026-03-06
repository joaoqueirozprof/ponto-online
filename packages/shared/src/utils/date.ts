import { DEFAULT_TIMEZONE } from '../constants';

export function convertToTimezone(date: Date, timezone: string = DEFAULT_TIMEZONE): Date {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const dateObj = {
    year: parseInt(parts.find((p) => p.type === 'year')?.value || '2024', 10),
    month: parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10),
    day: parseInt(parts.find((p) => p.type === 'day')?.value || '1', 10),
    hour: parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10),
    minute: parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10),
    second: parseInt(parts.find((p) => p.type === 'second')?.value || '0', 10),
  };

  return new Date(dateObj.year, dateObj.month - 1, dateObj.day, dateObj.hour, dateObj.minute, dateObj.second);
}

export function formatDate(date: Date, format: string = 'YYYY-MM-DD'): string {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();

  switch (format) {
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    default:
      return d.toISOString();
  }
}

export function formatTime(date: Date, format: string = 'HH:mm:ss'): string {
  const d = new Date(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  switch (format) {
    case 'HH:mm:ss':
      return `${hours}:${minutes}:${seconds}`;
    case 'HH:mm':
      return `${hours}:${minutes}`;
    default:
      return d.toISOString();
  }
}

export function formatDateTime(
  date: Date,
  dateFormat: string = 'YYYY-MM-DD',
  timeFormat: string = 'HH:mm:ss',
): string {
  return `${formatDate(date, dateFormat)} ${formatTime(date, timeFormat)}`;
}

export function getMonthName(month: number, locale: string = 'pt-BR'): string {
  const monthNames = {
    'pt-BR': [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ],
    'en-US': [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
  };

  const names = monthNames[locale as keyof typeof monthNames] || monthNames['pt-BR'];
  return names[month - 1];
}

export function getDayName(day: number, locale: string = 'pt-BR'): string {
  const dayNames = {
    'pt-BR': ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
    'en-US': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  };

  const names = dayNames[locale as keyof typeof dayNames] || dayNames['pt-BR'];
  return names[day];
}

export function isWorkDay(date: Date, scheduleEntries: any[]): boolean {
  const dayOfWeek = date.getDay();
  const entry = scheduleEntries.find((e) => e.dayOfWeek === dayOfWeek);
  return entry ? entry.isWorkDay : false;
}

export function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

export function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getEndOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

export function subtractMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() - minutes * 60000);
}

export function getDifferenceInMinutes(date1: Date, date2: Date): number {
  return Math.round((date1.getTime() - date2.getTime()) / 60000);
}

export function getDifferenceInHours(date1: Date, date2: Date): number {
  return Math.round((date1.getTime() - date2.getTime()) / 3600000 * 100) / 100;
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function isYesterday(date: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  );
}
