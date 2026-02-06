import { format, eachDayOfInterval } from "date-fns";
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
 * Generate a DayComparison from MongoDB data only (no XLSX data)
 */
function createMongoOnlyDayComparison(record: AttendanceDayDocument): DayComparison {
  const dateKey = format(new Date(record.day), "dd/MM/yyyy");
  const dayName = format(new Date(record.day), "EEEE");

  const mongoDay = extractMongoData(record);

  const xlsxDay: XlsxDayData = {
    in1: null,
    in1Date: dateKey,
    out2: null,
    out2Date: dateKey,
    netWorkHours: null,
  };

  return {
    date: dateKey,
    dayName,
    xlsx: xlsxDay,
    mongo: mongoDay,
    discrepancies: { in1Missing: false, out2Missing: false, lowHours: false },
    issues: [],
    selection: { checkIn: "mongodb", checkOut: "mongodb" },
  };
}

/**
 * Compare XLSX data with MongoDB attendance records
 * If xlsxData is null or has no entries, generate comparison from MongoDB records only
 */
export function compareTimeData(
  xlsxData: EmployeeXlsxData | null,
  mongoAttendance: AttendanceDayDocument[]
): ComparisonData {
  // Create a map of MongoDB attendance by date string (dd/MM/yyyy)
  const mongoByDate = new Map<string, AttendanceDayDocument>();
  mongoAttendance.forEach((record) => {
    const dateKey = format(new Date(record.day), "dd/MM/yyyy");
    mongoByDate.set(dateKey, record);
  });

  const days: DayComparison[] = [];

  // Check if XLSX has any entries with actual time data
  const hasXlsxTimeData = xlsxData?.entries.some(
    (entry) => entry.in1 || entry.out2
  );

  // Case 1: We have XLSX entries with time data - use them as base
  if (xlsxData && xlsxData.entries.length > 0 && hasXlsxTimeData) {
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
  }
  // Case 2: No XLSX entries - use MongoDB records as base
  else {
    const sortedRecords = [...mongoAttendance].sort(
      (a, b) => new Date(a.day).getTime() - new Date(b.day).getTime()
    );

    for (const record of sortedRecords) {
      days.push(createMongoOnlyDayComparison(record));
    }
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
  // Check for missing MongoDB check-in when XLSX has data
  const in1Missing = !!xlsx.in1 && !mongo.firstCheckIn;

  // Check for missing MongoDB check-out when XLSX has data
  const out2Missing = !!xlsx.out2 && !mongo.lastCheckOut;

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
    issues.push("XLSX has check-in but MongoDB is missing");
  }

  if (discrepancies.out2Missing) {
    issues.push("XLSX has check-out but MongoDB is missing");
  }

  if (discrepancies.lowHours) {
    issues.push("Net work hours between 3-4 hours - verify with MongoDB");
  }

  return issues;
}

/**
 * Create an empty DayComparison for a date with no data in either source
 */
function createEmptyDayComparison(date: Date): DayComparison {
  const dateKey = format(date, "dd/MM/yyyy");
  const dayName = format(date, "EEEE");

  return {
    date: dateKey,
    dayName,
    xlsx: {
      in1: null,
      in1Date: dateKey,
      out2: null,
      out2Date: dateKey,
      netWorkHours: null,
    },
    mongo: {
      firstCheckIn: null,
      firstCheckInDate: null,
      lastCheckOut: null,
      lastCheckOutDate: null,
      totalHours: null,
    },
    discrepancies: { in1Missing: false, out2Missing: false, lowHours: false },
    issues: [],
    selection: { checkIn: "xlsx", checkOut: "xlsx" },
  };
}

/**
 * Generate comparison data for a full date range, including empty days.
 * Every day in the range gets a DayComparison row, even if no data exists.
 */
export function compareTimeDataForRange(
  startDate: Date,
  endDate: Date,
  xlsxData: EmployeeXlsxData | null,
  mongoAttendance: AttendanceDayDocument[]
): ComparisonData {
  // Build maps for O(1) lookup by date key (dd/MM/yyyy)
  const xlsxByDate = new Map<string, TimeEntry>();
  if (xlsxData) {
    for (const entry of xlsxData.entries) {
      xlsxByDate.set(entry.date, entry);
    }
  }

  const mongoByDate = new Map<string, AttendanceDayDocument>();
  for (const record of mongoAttendance) {
    const dateKey = format(new Date(record.day), "dd/MM/yyyy");
    mongoByDate.set(dateKey, record);
  }

  // Generate every day in the interval
  const allDays = eachDayOfInterval({ start: startDate, end: endDate });

  const days: DayComparison[] = allDays.map((date) => {
    const dateKey = format(date, "dd/MM/yyyy");
    const xlsxEntry = xlsxByDate.get(dateKey);
    const mongoRecord = mongoByDate.get(dateKey);

    if (xlsxEntry || mongoRecord) {
      const xlsxDay: XlsxDayData = xlsxEntry
        ? extractXlsxData(xlsxEntry)
        : {
            in1: null,
            in1Date: dateKey,
            out2: null,
            out2Date: dateKey,
            netWorkHours: null,
          };
      const mongoDay = extractMongoData(mongoRecord);
      const discrepancies = detectDiscrepancies(xlsxDay, mongoDay);
      const issues = generateIssues(discrepancies);

      return {
        date: dateKey,
        dayName: xlsxEntry?.day ?? format(date, "EEEE"),
        xlsx: xlsxDay,
        mongo: mongoDay,
        discrepancies,
        issues,
        selection: {
          checkIn: xlsxEntry ? "xlsx" as const : "mongodb" as const,
          checkOut: xlsxEntry ? "xlsx" as const : "mongodb" as const,
        },
      };
    }

    return createEmptyDayComparison(date);
  });

  return {
    days,
    totalIssues: days.reduce((sum, day) => sum + day.issues.length, 0),
  };
}
