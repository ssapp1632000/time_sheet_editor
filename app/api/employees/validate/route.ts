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

    // Create a map of XLSX employees by ID for quick lookup
    const xlsxEmployeeMap = new Map(xlsxEmployees.map((e) => [e.id, e]));
    const xlsxIds = new Set(xlsxEmployees.map((e) => e.id));

    // Fetch ALL MongoDB users (excluding nightWork)
    const usersCollection = await getUsersCollection();
    const allMongoUsers = await usersCollection
      .find({
        nightWork: { $ne: true },
      })
      .project({ employeeId: 1, firstName: 1, lastName: 1, dateOfJoining: 1 })
      .toArray();

    const mongoIds = new Set(allMongoUsers.map((u) => u.employeeId));

    // Build the merged employee list from all MongoDB users
    const mergedEmployees = allMongoUsers.map((mongoUser) => {
      const xlsxEmployee = xlsxEmployeeMap.get(mongoUser.employeeId);
      return {
        id: mongoUser.employeeId,
        // Prefer XLSX name if available, otherwise construct from MongoDB
        name: xlsxEmployee?.name ?? `${mongoUser.firstName} ${mongoUser.lastName}`,
        hasXlsx: xlsxIds.has(mongoUser.employeeId),
        dateOfJoining: mongoUser.dateOfJoining ?? null,
      };
    });

    // Sort alphabetically by name
    mergedEmployees.sort((a, b) => a.name.localeCompare(b.name));

    // Calculate counts
    const mongoOnlyCount = allMongoUsers.filter(
      (u) => !xlsxIds.has(u.employeeId)
    ).length;
    const filteredCount = xlsxEmployees.filter(
      (e) => !mongoIds.has(e.id)
    ).length;

    return NextResponse.json({
      employees: mergedEmployees,
      dateRange,
      count: mergedEmployees.length,
      totalInXlsx: xlsxEmployees.length,
      totalInMongo: allMongoUsers.length,
      mongoOnlyCount,
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
