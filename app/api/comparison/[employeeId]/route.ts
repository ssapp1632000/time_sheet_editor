import { NextRequest, NextResponse } from "next/server";
import { startOfMonth, endOfMonth, parse, format, max, min } from "date-fns";
import { getEmployeeById, isXlsxLoaded, getDateRange } from "@/lib/xlsx/store";
import {
  findUserByEmployeeId,
  getAttendanceForUser,
  getAttendanceCollection,
} from "@/lib/db/mongodb";
import { compareTimeDataForRange } from "@/lib/utils/comparison";
import { parseDateString, formatDateString } from "@/lib/utils/time";
import type {
  ComparisonResponse,
  DateFilter,
  DateFilterMode,
  DateBounds,
} from "@/types/comparison";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { employeeId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Parse filter params
    const mode = (searchParams.get("mode") as DateFilterMode) || "month";
    const monthParam = searchParams.get("month"); // YYYY-MM
    const startDateParam = searchParams.get("startDate"); // DD/MM/YYYY
    const endDateParam = searchParams.get("endDate"); // DD/MM/YYYY

    // Get XLSX data (may be null if not loaded or employee not in XLSX)
    const xlsxLoaded = await isXlsxLoaded();
    const xlsxData = xlsxLoaded ? await getEmployeeById(employeeId) : undefined;
    const dateRange = xlsxLoaded ? await getDateRange() : null;

    // Fetch user from MongoDB
    const user = await findUserByEmployeeId(employeeId);

    if (!xlsxData && !user) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    // Determine date bounds
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let earliest: Date;
    let earliestSource: DateBounds["earliestSource"];

    if (user?.dateOfJoining) {
      earliest = new Date(user.dateOfJoining);
      earliestSource = "dateOfJoining";
    } else if (dateRange) {
      const xlsxStart = parseDateString(dateRange.start);
      earliest = xlsxStart ?? today;
      earliestSource = "xlsx";
    } else if (user) {
      // Try to find the earliest attendance record
      const attendanceCol = await getAttendanceCollection();
      const earliestRecord = await attendanceCol
        .find({ user: user._id })
        .sort({ day: 1 })
        .limit(1)
        .toArray();
      if (earliestRecord.length > 0) {
        earliest = new Date(earliestRecord[0].day);
        earliestSource = "earliestRecord";
      } else {
        earliest = today;
        earliestSource = "earliestRecord";
      }
    } else {
      earliest = today;
      earliestSource = "xlsx";
    }

    const dateBounds: DateBounds = {
      earliest: formatDateString(earliest),
      latest: formatDateString(today),
      xlsxRange: dateRange,
      earliestSource,
    };

    // Apply filter to determine query range
    let queryStart: Date;
    let queryEnd: Date;

    switch (mode) {
      case "month": {
        const monthDate = monthParam
          ? parse(monthParam, "yyyy-MM", new Date())
          : new Date();
        queryStart = max([startOfMonth(monthDate), earliest]);
        queryEnd = min([endOfMonth(monthDate), today]);
        break;
      }
      case "range": {
        const rangeStart = startDateParam
          ? parseDateString(startDateParam)
          : null;
        const rangeEnd = endDateParam ? parseDateString(endDateParam) : null;
        queryStart = max([rangeStart ?? earliest, earliest]);
        queryEnd = min([rangeEnd ?? today, today]);
        break;
      }
      case "all": {
        queryStart = earliest;
        queryEnd = today;
        break;
      }
    }

    // Ensure queryStart <= queryEnd
    if (queryStart > queryEnd) {
      queryStart = queryEnd;
    }

    // Fetch MongoDB attendance for the query range
    let mongoAttendance: Awaited<ReturnType<typeof getAttendanceForUser>> = [];

    try {
      if (user) {
        mongoAttendance = await getAttendanceForUser(
          user._id,
          queryStart,
          queryEnd
        );
      }
    } catch (dbError) {
      console.error("MongoDB fetch error:", dbError);
    }

    // Generate comparison with all days in range
    const comparison = compareTimeDataForRange(
      queryStart,
      queryEnd,
      xlsxData ?? null,
      mongoAttendance
    );

    // Build employee info
    const employeeInfo = {
      id: employeeId,
      name:
        xlsxData?.employeeName ??
        (user ? `${user.firstName} ${user.lastName}` : "Unknown"),
      company: xlsxData?.company ?? "N/A",
    };

    // Build active filter echo
    const activeFilter: DateFilter = { mode };
    if (mode === "month") {
      activeFilter.month =
        monthParam || format(new Date(), "yyyy-MM");
    }
    if (mode === "range") {
      activeFilter.startDate = formatDateString(queryStart);
      activeFilter.endDate = formatDateString(queryEnd);
    }

    const response: ComparisonResponse = {
      employee: employeeInfo,
      comparison,
      dateBounds,
      activeFilter,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Comparison error:", error);
    return NextResponse.json(
      { error: "Failed to generate comparison" },
      { status: 500 }
    );
  }
}
