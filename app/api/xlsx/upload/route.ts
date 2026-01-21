import { NextRequest, NextResponse } from "next/server";
import { parseXlsxFile } from "@/lib/xlsx/parser";
import { setXlsxStore } from "@/lib/xlsx/store";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (!validTypes.includes(file.type) && !file.name.endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload an XLSX file." },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const store = parseXlsxFile(buffer);
    await setXlsxStore(store);

    return NextResponse.json({
      success: true,
      employeeCount: store.employeeList.length,
      dateRange: store.dateRange,
    });
  } catch (error) {
    console.error("XLSX upload error:", error);
    return NextResponse.json(
      { error: "Failed to parse XLSX file" },
      { status: 500 }
    );
  }
}
