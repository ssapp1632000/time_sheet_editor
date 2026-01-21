import { NextRequest, NextResponse } from "next/server";
import { getEmployeeById, isXlsxLoaded, getDateRange } from "@/lib/xlsx/store";
import {
  findUserByEmployeeId,
  getAttendanceForUser,
} from "@/lib/db/mongodb";
import { compareTimeData } from "@/lib/utils/comparison";
import { parseDateString } from "@/lib/utils/time";
import type { ComparisonResponse } from "@/types/comparison";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { employeeId } = await params;

    if (!isXlsxLoaded()) {
      return NextResponse.json(
        { error: "XLSX file not loaded. Please upload a file first." },
        { status: 400 }
      );
    }

    // Get XLSX data for this employee
    const xlsxData = getEmployeeById(employeeId);
    if (!xlsxData) {
      return NextResponse.json(
        { error: "Employee not found in XLSX data" },
        { status: 404 }
      );
    }

    // Get date range from XLSX
    const dateRange = getDateRange();

    // Fetch MongoDB data
    let mongoAttendance: Awaited<ReturnType<typeof getAttendanceForUser>> = [];

    try {
      const user = await findUserByEmployeeId(employeeId);

      if (user && dateRange) {
        const startDate = parseDateString(dateRange.start);
        const endDate = parseDateString(dateRange.end);

        if (startDate && endDate) {
          mongoAttendance = await getAttendanceForUser(
            user._id,
            startDate,
            endDate
          );
        }
      }
    } catch (dbError) {
      console.error("MongoDB fetch error:", dbError);
      // Continue without MongoDB data - comparison will show xlsx only
    }

    // Perform comparison
    const comparison = compareTimeData(xlsxData, mongoAttendance);

    const response: ComparisonResponse = {
      employee: {
        id: employeeId,
        name: xlsxData.employeeName,
        company: xlsxData.company,
      },
      comparison,
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
