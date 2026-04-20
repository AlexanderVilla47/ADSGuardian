// Date utilities for AdsKiller
// Timezone: America/Argentina/Buenos_Aires

import { format, parse, differenceInDays, isValid, isAfter } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// Fixed timezone for all operations
const TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Validates date string is in YYYY-MM-DD format
 */
export function validateDateFormat(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) {
    return false;
  }
  
  const parsed = parse(dateString, 'yyyy-MM-dd', new Date());
  return isValid(parsed);
}

/**
 * Format a Date or string to YYYY-MM-DD in Buenos Aires timezone
 */
export function formatDateForTimezone(date: Date | string): string {
  let dateObj: Date;
  
  if (typeof date === 'string') {
    dateObj = parse(date, 'yyyy-MM-dd', new Date());
  } else {
    dateObj = date;
  }
  
  // Convert to Buenos Aires timezone and format
  const zonedDate = toZonedTime(dateObj, TIMEZONE);
  return format(zonedDate, 'yyyy-MM-dd');
}

/**
 * Get current date in Buenos Aires timezone as YYYY-MM-DD
 */
export function getCurrentDate(): string {
  return formatDateForTimezone(new Date());
}

/**
 * Calculate days until a given date
 * @returns positive if date is in future, negative if in past, 0 if today
 */
export function daysUntilExpiry(dateString: string): number {
  const targetDate = parse(dateString, 'yyyy-MM-dd', new Date());
  const today = toZonedTime(new Date(), TIMEZONE);
  
  return differenceInDays(targetDate, today);
}

/**
 * Check if a date is expired (before today)
 */
export function isExpired(dateString: string): boolean {
  return daysUntilExpiry(dateString) < 0;
}

/**
 * Check if a date is expiring soon (within specified days)
 */
export function isExpiringSoon(dateString: string, days: number = 48): boolean {
  const daysLeft = daysUntilExpiry(dateString);
  return daysLeft >= 0 && daysLeft <= days / 24; // Convert hours to days
}

/**
 * Check if a date is expiring today
 */
export function isExpiringToday(dateString: string): boolean {
  return daysUntilExpiry(dateString) === 0;
}

/**
 * Parse a YYYY-MM-DD string to Date object
 */
export function parseDate(dateString: string): Date {
  return parse(dateString, 'yyyy-MM-dd', new Date());
}

/**
 * Validate that end_date is after start_date
 */
export function validateDateRange(startDate: string, endDate: string): boolean {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  
  return isAfter(end, start);
}

/**
 * Validate that new_end_date is after current end_date
 */
export function validateNewEndDate(currentEndDate: string, newEndDate: string): boolean {
  return validateDateRange(currentEndDate, newEndDate);
}

/**
 * Format a date for display (e.g., "13 de abril de 2026")
 */
export function formatDateDisplay(dateString: string, locale: string = 'es-AR'): string {
  const date = parseDate(dateString);
  return format(date, "d 'de' MMMM 'de' yyyy", { locale: getDateLocale(locale) });
}

/**
 * Get date-fns locale for formatting
 */
function getDateLocale(_locale: string) {
  // For MVP, using simple formatting - can expand with date-fns/locale later
  return undefined; // Uses default locale
}

/**
 * Get timezone label for display
 */
export function getTimezoneLabel(): string {
  return TIMEZONE;
}