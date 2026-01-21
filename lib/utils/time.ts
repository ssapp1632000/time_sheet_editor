import { format, parse } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

// Dubai timezone (UTC+4)
export const DUBAI_TIMEZONE = "Asia/Dubai";

/**
 * Convert Excel serial time (0-1) to HH:mm format
 */
export function excelTimeToString(value: number): string {
  const totalMinutes = Math.round(value * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

/**
 * Convert seconds to HH:mm format
 */
export function secondsToHoursMinutes(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

/**
 * Convert HH:mm string to total hours (decimal)
 */
export function timeStringToHours(time: string | null): number {
  if (!time) return 0;
  const parts = time.split(":");
  if (parts.length !== 2) return 0;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  return hours + minutes / 60;
}

/**
 * Format UTC Date to HH:mm string in Dubai timezone
 */
export function formatTimeFromDate(date: Date | string | null): string | null {
  if (!date) return null;
  try {
    const d = new Date(date);
    // Convert UTC to Dubai timezone for display
    const dubaiTime = toZonedTime(d, DUBAI_TIMEZONE);
    return format(dubaiTime, "HH:mm");
  } catch {
    return null;
  }
}

/**
 * Format cell value, handling various input types
 */
export function formatCellValue(value: unknown): string | null {
  if (value === undefined || value === null || value === "" || value === "--") {
    return null;
  }
  return String(value).trim();
}

/**
 * Format time value from Excel cell
 */
export function formatTimeValue(value: unknown): string | null {
  if (value === undefined || value === null || value === "" || value === "--") {
    return null;
  }

  // Handle Excel time serial numbers (0 < value < 1)
  if (typeof value === "number" && value >= 0 && value < 1) {
    return excelTimeToString(value);
  }

  // Handle duration values that might be > 1 (e.g., total hours like 99:56)
  if (typeof value === "number" && value >= 1) {
    // This could be a duration in days.fraction format
    const totalMinutes = Math.round(value * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }

  const strValue = String(value).trim();
  // Check if already in HH:mm format
  if (/^\d{1,2}:\d{2}$/.test(strValue)) {
    return strValue;
  }

  return strValue || null;
}

/**
 * Parse DD/MM/YYYY date string to Date object
 */
export function parseDateString(dateStr: string): Date | null {
  try {
    return parse(dateStr, "dd/MM/yyyy", new Date());
  } catch {
    return null;
  }
}

/**
 * Format Date to DD/MM/YYYY string
 */
export function formatDateString(date: Date): string {
  return format(date, "dd/MM/yyyy");
}

/**
 * Convert Dubai time (HH:mm) on a specific date to UTC Date object
 * Used when saving to MongoDB
 */
export function dubaiTimeToUTC(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);

  // Create a date in Dubai timezone
  const dubaiDate = new Date(date);
  dubaiDate.setHours(hours, minutes, 0, 0);

  // Convert from Dubai timezone to UTC
  const utcDate = fromZonedTime(dubaiDate, DUBAI_TIMEZONE);
  return utcDate;
}

/**
 * Convert UTC Date to Dubai time HH:mm string
 * Used when displaying MongoDB data
 */
export function utcToDubaiTime(utcDate: Date | string): string | null {
  if (!utcDate) return null;
  try {
    const d = new Date(utcDate);
    const dubaiTime = toZonedTime(d, DUBAI_TIMEZONE);
    return format(dubaiTime, "HH:mm");
  } catch {
    return null;
  }
}

/**
 * Calculate net hours between two HH:mm time strings (same day only)
 * Returns the difference in HH:mm format
 * @deprecated Use calculateNetHoursWithDates for proper overnight handling
 */
export function calculateNetHours(checkIn: string | null, checkOut: string | null): string | null {
  if (!checkIn || !checkOut) return null;

  // Validate format
  const timeRegex = /^(\d{1,2}):(\d{2})$/;
  const checkInMatch = checkIn.match(timeRegex);
  const checkOutMatch = checkOut.match(timeRegex);

  if (!checkInMatch || !checkOutMatch) return null;

  const checkInMinutes = parseInt(checkInMatch[1], 10) * 60 + parseInt(checkInMatch[2], 10);
  const checkOutMinutes = parseInt(checkOutMatch[1], 10) * 60 + parseInt(checkOutMatch[2], 10);

  // Handle case where checkout is after midnight (next day)
  let diffMinutes = checkOutMinutes - checkInMinutes;
  if (diffMinutes < 0) {
    diffMinutes += 24 * 60; // Add 24 hours
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

/**
 * Convert time string (HH:mm) to total minutes
 */
export function timeToMinutes(time: string): number {
  const timeRegex = /^(\d{1,2}):(\d{2})$/;
  const match = time.match(timeRegex);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/**
 * Detect if checkout is on the next day based on time comparison
 * If checkout time <= checkin time, assume overnight shift
 */
export function detectCheckoutDate(
  rowDate: string,
  checkInTime: string | null,
  checkOutTime: string | null
): string {
  if (!checkInTime || !checkOutTime) return rowDate;

  const inMinutes = timeToMinutes(checkInTime);
  const outMinutes = timeToMinutes(checkOutTime);

  // If checkout <= checkin, it's overnight - return next day
  if (outMinutes <= inMinutes) {
    const date = parseDateString(rowDate);
    if (!date) return rowDate;
    const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    return formatDateString(nextDay);
  }

  return rowDate;
}

/**
 * Parse date and time strings into a Date object
 */
export function parseDateTimeString(dateStr: string, timeStr: string): Date | null {
  const date = parseDateString(dateStr);
  if (!date) return null;

  const timeRegex = /^(\d{1,2}):(\d{2})$/;
  const match = timeStr.match(timeRegex);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * Calculate net hours between two full datetime values (date + time)
 * Properly handles overnight shifts and multi-day periods
 * Returns the difference in HH:mm format
 */
export function calculateNetHoursWithDates(
  checkInDate: string,
  checkInTime: string | null,
  checkOutDate: string,
  checkOutTime: string | null
): string | null {
  if (!checkInTime || !checkOutTime) return null;

  const checkIn = parseDateTimeString(checkInDate, checkInTime);
  const checkOut = parseDateTimeString(checkOutDate, checkOutTime);

  if (!checkIn || !checkOut) return null;

  const diffMs = checkOut.getTime() - checkIn.getTime();
  if (diffMs < 0) return null; // Invalid: checkout before checkin

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

/**
 * Convert UTC Date to Dubai date string (DD/MM/YYYY)
 */
export function utcToDubaiDate(utcDate: Date | string): string | null {
  if (!utcDate) return null;
  try {
    const d = new Date(utcDate);
    const dubaiTime = toZonedTime(d, DUBAI_TIMEZONE);
    return format(dubaiTime, "dd/MM/yyyy");
  } catch {
    return null;
  }
}
