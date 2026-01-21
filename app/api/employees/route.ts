import { NextResponse } from "next/server";
import { getEmployeeList, isXlsxLoaded, getDateRange } from "@/lib/xlsx/store";

export async function GET() {
  if (!(await isXlsxLoaded())) {
    return NextResponse.json(
      { error: "XLSX file not loaded. Please upload a file first." },
      { status: 400 }
    );
  }

  const employees = await getEmployeeList();
  const dateRange = await getDateRange();

  return NextResponse.json({
    employees,
    dateRange,
    count: employees.length,
  });
}
