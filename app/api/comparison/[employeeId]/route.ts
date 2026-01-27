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

    if (!(await isXlsxLoaded())) {
      return NextResponse.json(
        { error: "XLSX file not loaded. Please upload a file first." },
        { status: 400 }
      );
    }

    // Get XLSX data for this employee (may be undefined or have empty entries)
    const xlsxData = await getEmployeeById(employeeId);

    // Get date range from XLSX (needed for MongoDB query)
    const dateRange = await getDateRange();

    // Fetch user from MongoDB to verify they exist
    const user = await findUserByEmployeeId(employeeId);

    // If employee doesn't exist in XLSX AND doesn't exist in MongoDB, return 404
    if (!xlsxData && !user) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    // Fetch MongoDB data
    let mongoAttendance: Awaited<ReturnType<typeof getAttendanceForUser>> = [];

    try {
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

    // Perform comparison (now handles null/empty xlsxData)
    const comparison = compareTimeData(xlsxData ?? null, mongoAttendance);

    // Build employee info - prefer XLSX, fall back to MongoDB user
    const employeeInfo = {
      id: employeeId,
      name: xlsxData?.employeeName ?? (user ? `${user.firstName} ${user.lastName}` : "Unknown"),
      company: xlsxData?.company ?? "N/A",
    };

    const response: ComparisonResponse = {
      employee: employeeInfo,
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
