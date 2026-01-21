import { NextResponse } from "next/server";
import { getEmployeeList, isXlsxLoaded, getDateRange } from "@/lib/xlsx/store";

export async function GET() {
  if (!isXlsxLoaded()) {
    return NextResponse.json(
      { error: "XLSX file not loaded. Please upload a file first." },
      { status: 400 }
    );
  }

  const employees = getEmployeeList();
  const dateRange = getDateRange();

  return NextResponse.json({
    employees,
    dateRange,
    count: employees.length,
  });
}
