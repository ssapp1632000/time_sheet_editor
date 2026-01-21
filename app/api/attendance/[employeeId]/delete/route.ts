import { NextRequest, NextResponse } from "next/server";
import {
  findUserByEmployeeId,
  getAttendanceCollection,
} from "@/lib/db/mongodb";
import { parseDateString } from "@/lib/utils/time";
import type { BulkDeleteRequest, BulkDeleteResponse } from "@/types/comparison";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { employeeId } = await params;
    const body: BulkDeleteRequest = await request.json();

    if (!body.dates || !Array.isArray(body.dates) || body.dates.length === 0) {
      return NextResponse.json(
        { error: "Invalid request body. Expected { dates: [...] }" },
        { status: 400 }
      );
    }

    // Find user in MongoDB
    const user = await findUserByEmployeeId(employeeId);
    if (!user) {
      return NextResponse.json(
        { error: "Employee not found in database" },
        { status: 404 }
      );
    }

    const attendanceCollection = await getAttendanceCollection();
    const errors: string[] = [];
    let deletedCount = 0;

    for (const dateStr of body.dates) {
      try {
        const date = parseDateString(dateStr);
        if (!date) {
          errors.push(`Invalid date format: ${dateStr}`);
          continue;
        }

        // Create UTC date range for the calendar date
        const dayUTC = new Date(
          Date.UTC(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            0,
            0,
            0,
            0
          )
        );

        const dayEndUTC = new Date(
          Date.UTC(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            23,
            59,
            59,
            999
          )
        );

        // Delete the attendance record for this day
        const result = await attendanceCollection.deleteOne({
          user: user._id,
          day: { $gte: dayUTC, $lte: dayEndUTC },
        });

        if (result.deletedCount > 0) {
          deletedCount++;
        }
      } catch (deleteError) {
        console.error(`Error deleting ${dateStr}:`, deleteError);
        errors.push(`Failed to delete ${dateStr}`);
      }
    }

    const response: BulkDeleteResponse = {
      success: errors.length === 0,
      deletedCount,
      errors: errors.length > 0 ? errors : undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Bulk delete error:", error);
    return NextResponse.json(
      { error: "Failed to process bulk delete" },
      { status: 500 }
    );
  }
}
