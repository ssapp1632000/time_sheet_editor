import { NextRequest, NextResponse } from "next/server";
import { markEmployeeUpdated, getUpdatedEmployees } from "@/lib/xlsx/store";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { employeeId } = await params;

    if (!employeeId) {
      return NextResponse.json(
        { error: "Employee ID is required" },
        { status: 400 }
      );
    }

    await markEmployeeUpdated(employeeId);
    const updatedEmployees = await getUpdatedEmployees();

    return NextResponse.json({
      success: true,
      employeeId,
      updatedEmployees: Array.from(updatedEmployees),
    });
  } catch (error) {
    console.error("Error marking employee as updated:", error);
    return NextResponse.json(
      { error: "Failed to mark employee as updated" },
      { status: 500 }
    );
  }
}
