import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import {
  findUserByEmployeeId,
  getAttendanceCollection,
} from "@/lib/db/mongodb";
import { parseDateString, dubaiTimeToUTC } from "@/lib/utils/time";
import type { BulkUpdateRequest, BulkUpdateResponse } from "@/types/comparison";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { employeeId } = await params;
    const body: BulkUpdateRequest = await request.json();

    if (!body.updates || !Array.isArray(body.updates)) {
      return NextResponse.json(
        { error: "Invalid request body. Expected { updates: [...] }" },
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
    let updatedCount = 0;

    for (const update of body.updates) {
      try {
        // Parse the row date (used for record lookup)
        const rowDate = parseDateString(update.date);
        if (!rowDate) {
          errors.push(`Invalid row date format: ${update.date}`);
          continue;
        }

        // Parse the check-in date (can be different from row date)
        const checkInDate = parseDateString(update.checkInDate);
        if (!checkInDate && update.checkInTime) {
          errors.push(`Invalid check-in date format: ${update.checkInDate}`);
          continue;
        }

        // Parse the check-out date (can be different from row date for overnight shifts)
        const checkOutDate = parseDateString(update.checkOutDate);
        if (!checkOutDate && update.checkOutTime) {
          errors.push(`Invalid check-out date format: ${update.checkOutDate}`);
          continue;
        }

        // The "day" field represents the calendar date from XLSX (e.g., 01/01/2026)
        // Store it as UTC midnight of that date - NOT converted from Dubai timezone
        // This ensures the day field always matches the XLSX date regardless of check-in time
        const dayUTC = new Date(
          Date.UTC(
            rowDate.getFullYear(),
            rowDate.getMonth(),
            rowDate.getDate(),
            0,
            0,
            0,
            0
          )
        );

        // Query range: find records where day matches this calendar date
        const dayEndUTC = new Date(
          Date.UTC(
            rowDate.getFullYear(),
            rowDate.getMonth(),
            rowDate.getDate(),
            23,
            59,
            59,
            999
          )
        );

        // Find existing attendance record for this day
        const existingRecord = await attendanceCollection.findOne({
          user: user._id,
          day: { $gte: dayUTC, $lte: dayEndUTC },
        });

        // Convert times to UTC using their respective dates
        // This properly handles overnight shifts where check-out is on a different day
        const checkInTimeUTC =
          update.checkInTime && checkInDate
            ? dubaiTimeToUTC(checkInDate, update.checkInTime)
            : null;

        const checkOutTimeUTC =
          update.checkOutTime && checkOutDate
            ? dubaiTimeToUTC(checkOutDate, update.checkOutTime)
            : null;

        // Calculate totalSeconds - now works correctly for overnight shifts
        let totalSeconds = 0;
        if (checkInTimeUTC && checkOutTimeUTC) {
          totalSeconds = Math.floor(
            (checkOutTimeUTC.getTime() - checkInTimeUTC.getTime()) / 1000
          );
          // Ensure positive value (should always be positive now with proper dates)
          if (totalSeconds < 0) {
            totalSeconds = 0;
          }
        }

        if (existingRecord) {
          // Update existing record
          const existingPeriods = existingRecord.periods || [];

          // Get checkInLocation from first period
          const firstPeriod = existingPeriods[0];
          const checkInLocation = firstPeriod?.checkInLocation;

          // Get checkOutLocation and checkoutType from last period
          const lastPeriod = existingPeriods[existingPeriods.length - 1];
          const checkOutLocation = lastPeriod?.checkOutLocation;
          const checkoutType = lastPeriod?.checkoutType || "manual";

          // Create single new period with all data
          const newPeriod = {
            startTime: checkInTimeUTC as Date,
            endTime: checkOutTimeUTC,
            checkoutType,
            ...(checkInLocation && { checkInLocation }),
            ...(checkOutLocation && { checkOutLocation }),
          };

          // Update with new periods array (single object) and remove intervals
          await attendanceCollection.updateOne(
            { _id: existingRecord._id },
            {
              $set: {
                periods: [newPeriod],
                totalSeconds,
                forgotToCheckOut: false,
                updatedAt: new Date(),
              },
              $unset: {
                intervals: "",
              },
            }
          );
          updatedCount++;
        } else {
          // Create new attendance record
          const newRecord = {
            _id: new ObjectId(),
            user: user._id,
            day: dayUTC,
            periods: [
              {
                startTime: checkInTimeUTC,
                endTime: checkOutTimeUTC,
                checkoutType: "manual" as const,
              },
            ],
            totalSeconds,
            isActive: false,
            isNightWork: false,
            forgotToCheckOut: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await attendanceCollection.insertOne(newRecord);
          updatedCount++;
        }
      } catch (updateError) {
        console.error(`Error updating ${update.date}:`, updateError);
        errors.push(`Failed to update ${update.date}`);
      }
    }

    const response: BulkUpdateResponse = {
      success: errors.length === 0,
      updatedCount,
      errors: errors.length > 0 ? errors : undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Bulk update error:", error);
    return NextResponse.json(
      { error: "Failed to process bulk update" },
      { status: 500 }
    );
  }
}
