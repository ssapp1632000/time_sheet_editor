import { format } from "date-fns";
import type { EmployeeXlsxData, TimeEntry } from "@/types/xlsx";
import type {
  ComparisonData,
  DayComparison,
  Discrepancies,
  XlsxDayData,
  MongoDayData,
} from "@/types/comparison";
import type { AttendanceDayDocument } from "@/lib/db/mongodb";
import {
  secondsToHoursMinutes,
  timeStringToHours,
  utcToDubaiTime,
  utcToDubaiDate,
  detectCheckoutDate,
} from "@/lib/utils/time";

const LOW_HOURS_MIN = 3; // Minimum hours threshold
const LOW_HOURS_MAX = 4; // Maximum hours threshold for warning

/**
 * Compare XLSX data with MongoDB attendance records
 */
export function compareTimeData(
  xlsxData: EmployeeXlsxData,
  mongoAttendance: AttendanceDayDocument[]
): ComparisonData {
  // Create a map of MongoDB attendance by date string (dd/MM/yyyy)
  const mongoByDate = new Map<string, AttendanceDayDocument>();
  mongoAttendance.forEach((record) => {
    const dateKey = format(new Date(record.day), "dd/MM/yyyy");
    mongoByDate.set(dateKey, record);
  });

  const days: DayComparison[] = [];

  for (const entry of xlsxData.entries) {
    const mongoRecord = mongoByDate.get(entry.date);

    const xlsxDay = extractXlsxData(entry);
    const mongoDay = extractMongoData(mongoRecord);

    const discrepancies = detectDiscrepancies(xlsxDay, mongoDay);
    const issues = generateIssues(discrepancies);

    days.push({
      date: entry.date,
      dayName: entry.day,
      xlsx: xlsxDay,
      mongo: mongoDay,
      discrepancies,
      issues,
      // Default selection: prefer XLSX values
      selection: {
        checkIn: "xlsx",
        checkOut: "xlsx",
      },
    });
  }

  return {
    days,
    totalIssues: days.reduce((sum, day) => sum + day.issues.length, 0),
  };
}

/**
 * Extract relevant XLSX data for a day
 * Note: XLSX times are already in Dubai timezone
 * Includes auto-detection of overnight shifts for checkout date
 */
function extractXlsxData(entry: TimeEntry): XlsxDayData {
  // Check-in date is always the row date
  const in1Date = entry.date;

  // Check-out date: auto-detect overnight shift
  // If checkout time <= checkin time, assume next day
  const out2Date = detectCheckoutDate(entry.date, entry.in1, entry.out2);

  return {
    in1: entry.in1,
    in1Date,
    out2: entry.out2,
    out2Date,
    netWorkHours: entry.netWorkHours,
  };
}

/**
 * Extract first check-in and last check-out from MongoDB record
 * Note: MongoDB stores UTC times, we convert them to Dubai timezone for display
 * Now includes both date and time for each value
 */
function extractMongoData(
  record: AttendanceDayDocument | undefined
): MongoDayData {
  if (!record) {
    return {
      firstCheckIn: null,
      firstCheckInDate: null,
      lastCheckOut: null,
      lastCheckOutDate: null,
      totalHours: null,
    };
  }

  let firstCheckIn: string | null = null;
  let firstCheckInDate: string | null = null;
  let lastCheckOut: string | null = null;
  let lastCheckOutDate: string | null = null;

  // Try periods first
  if (record.periods && record.periods.length > 0) {
    const firstPeriod = record.periods[0];
    if (firstPeriod.startTime) {
      // Convert UTC to Dubai timezone for display (both time and date)
      firstCheckIn = utcToDubaiTime(firstPeriod.startTime);
      firstCheckInDate = utcToDubaiDate(firstPeriod.startTime);
    }

    const lastPeriod = record.periods[record.periods.length - 1];
    if (lastPeriod.endTime) {
      // Convert UTC to Dubai timezone for display (both time and date)
      lastCheckOut = utcToDubaiTime(lastPeriod.endTime);
      lastCheckOutDate = utcToDubaiDate(lastPeriod.endTime);
    }
  }

  // Fallback to intervals
  if (!firstCheckIn && record.intervals && record.intervals.length > 0) {
    // Convert UTC to Dubai timezone for display
    firstCheckIn = utcToDubaiTime(record.intervals[0]);
    firstCheckInDate = utcToDubaiDate(record.intervals[0]);
  }

  if (!lastCheckOut && record.intervals && record.intervals.length > 1) {
    // Convert UTC to Dubai timezone for display
    lastCheckOut = utcToDubaiTime(record.intervals[record.intervals.length - 1]);
    lastCheckOutDate = utcToDubaiDate(record.intervals[record.intervals.length - 1]);
  }

  // Calculate total hours from totalSeconds
  const totalHours =
    record.totalSeconds > 0
      ? secondsToHoursMinutes(record.totalSeconds)
      : null;

  return {
    firstCheckIn,
    firstCheckInDate,
    lastCheckOut,
    lastCheckOutDate,
    totalHours,
  };
}

/**
 * Detect discrepancies between XLSX and MongoDB data
 */
function detectDiscrepancies(
  xlsx: XlsxDayData,
  mongo: MongoDayData
): Discrepancies {
  // Check for missing 1 IN in xlsx but present in mongo
  const in1Missing = !xlsx.in1 && !!mongo.firstCheckIn;

  // Check for missing 2 OUT in xlsx but present in mongo
  const out2Missing = !xlsx.out2 && !!mongo.lastCheckOut;

  // Check for low work hours (between 3-4 hours)
  let lowHours = false;
  if (xlsx.netWorkHours) {
    const totalHours = timeStringToHours(xlsx.netWorkHours);
    lowHours = totalHours > 0 && totalHours >= LOW_HOURS_MIN && totalHours < LOW_HOURS_MAX;
  }

  return {
    in1Missing,
    out2Missing,
    lowHours,
  };
}

/**
 * Generate human-readable issue descriptions
 */
function generateIssues(discrepancies: Discrepancies): string[] {
  const issues: string[] = [];

  if (discrepancies.in1Missing) {
    issues.push("Missing 1 IN - MongoDB has check-in record");
  }

  if (discrepancies.out2Missing) {
    issues.push("Missing 2 OUT - MongoDB has check-out record");
  }

  if (discrepancies.lowHours) {
    issues.push("Net work hours between 3-4 hours - verify with MongoDB");
  }

  return issues;
}
