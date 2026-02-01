import { NextResponse } from "next/server";
import {
  getEmployeeList,
  isXlsxLoaded,
  getDateRange,
  getUpdatedEmployees,
  getSuspectDaysCounts,
} from "@/lib/xlsx/store";
import { getUsersCollection } from "@/lib/db/mongodb";

export async function GET() {
  if (!(await isXlsxLoaded())) {
    return NextResponse.json(
      { error: "XLSX file not loaded. Please upload a file first." },
      { status: 400 }
    );
  }

  try {
    const xlsxEmployees = await getEmployeeList();
    const dateRange = await getDateRange();
    const updatedEmployees = await getUpdatedEmployees();
    const suspectDaysCounts = await getSuspectDaysCounts();

    // Get all employee IDs from XLSX
    const employeeIds = xlsxEmployees.map((e) => e.id);

    // Batch query MongoDB to find which employees exist
    const usersCollection = await getUsersCollection();
    const existingUsers = await usersCollection
      .find({ employeeId: { $in: employeeIds } })
      .project({ employeeId: 1 })
      .toArray();

    const existingIds = new Set(existingUsers.map((u) => u.employeeId));

    // Filter to only employees that exist in MongoDB and sort alphabetically by name
    const validEmployees = xlsxEmployees
      .filter((e) => existingIds.has(e.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    const filteredCount = xlsxEmployees.length - validEmployees.length;

    return NextResponse.json({
      employees: validEmployees,
      dateRange,
      count: validEmployees.length,
      totalInXlsx: xlsxEmployees.length,
      filteredCount,
      updatedEmployees: Array.from(updatedEmployees),
      suspectDaysCounts,
    });
  } catch (error) {
    console.error("Error validating employees:", error);
    return NextResponse.json(
      { error: "Failed to validate employees against MongoDB" },
      { status: 500 }
    );
  }
}
