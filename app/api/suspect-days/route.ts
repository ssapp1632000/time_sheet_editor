import { NextResponse } from "next/server";
import { markDayAsSuspect, unmarkDayAsSuspect, getSuspectDaysForEmployee } from "@/lib/xlsx/store";

interface SuspectDayRequest {
  employeeId: string;
  date: string;
}

/**
 * POST - Add a suspect day
 */
export async function POST(request: Request) {
  try {
    const body: SuspectDayRequest = await request.json();

    if (!body.employeeId || !body.date) {
      return NextResponse.json(
        { error: "employeeId and date are required" },
        { status: 400 }
      );
    }

    await markDayAsSuspect(body.employeeId, body.date);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error adding suspect day:", error);
    return NextResponse.json(
      { error: "Failed to add suspect day" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Remove a suspect day
 */
export async function DELETE(request: Request) {
  try {
    const body: SuspectDayRequest = await request.json();

    if (!body.employeeId || !body.date) {
      return NextResponse.json(
        { error: "employeeId and date are required" },
        { status: 400 }
      );
    }

    await unmarkDayAsSuspect(body.employeeId, body.date);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing suspect day:", error);
    return NextResponse.json(
      { error: "Failed to remove suspect day" },
      { status: 500 }
    );
  }
}

/**
 * GET - Get suspect days for an employee (optional query param)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");

    if (employeeId) {
      const dates = await getSuspectDaysForEmployee(employeeId);
      return NextResponse.json({ employeeId, dates });
    }

    return NextResponse.json(
      { error: "employeeId query parameter is required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error getting suspect days:", error);
    return NextResponse.json(
      { error: "Failed to get suspect days" },
      { status: 500 }
    );
  }
}
