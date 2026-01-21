import * as XLSX from "xlsx";
import type {
  EmployeeXlsxData,
  TimeEntry,
  XlsxStore,
  DateRange,
} from "@/types/xlsx";
import { formatCellValue, formatTimeValue } from "@/lib/utils/time";

/**
 * Parse the XLSX file and extract employee data
 */
export function parseXlsxFile(buffer: ArrayBuffer): XlsxStore {
  const workbook = XLSX.read(buffer, { type: "array" });

  // Get the first sheet (AllPages)
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to 2D array
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  const employees = new Map<string, EmployeeXlsxData>();
  const employeeList: Array<{ id: string; name: string }> = [];
  let dateRange: DateRange | null = null;

  const totalRows = data.length;
  let currentRow = 0;

  // Find first employee to detect structure
  while (currentRow < totalRows) {
    const row = data[currentRow];

    // Look for page header pattern "BINGHATTI Page X of Y"
    if (row && row[0] && String(row[0]).includes("Page")) {
      // Found start of employee block
      const employeeData = parseEmployeeBlock(data, currentRow);

      if (employeeData) {
        employees.set(employeeData.employeeId, employeeData);
        employeeList.push({
          id: employeeData.employeeId,
          name: employeeData.employeeName,
        });

        // Extract date range from first employee
        if (!dateRange && employeeData.entries.length > 0) {
          dateRange = {
            start: employeeData.entries[0].date,
            end: employeeData.entries[employeeData.entries.length - 1].date,
          };
        }

        // Move past this employee block (~27 rows)
        currentRow += 27;
      } else {
        currentRow++;
      }
    } else {
      currentRow++;
    }
  }

  return {
    employees,
    employeeList,
    dateRange,
    isLoaded: true,
    updatedEmployees: new Set(),
  };
}

/**
 * Parse a single employee block starting at rowIndex
 */
function parseEmployeeBlock(
  data: unknown[][],
  startRow: number
): EmployeeXlsxData | null {
  // Row structure:
  // Row 0: Page Header
  // Row 1: Column Headers
  // Row 2: Company Name
  // Row 3: Employee ID (Col A) and Name (Col C)
  // Row 4-23: Daily records (20 days)
  // Row 24: Total Hours
  // Row 25: Summary

  const companyRow = data[startRow + 2];
  const company = formatCellValue(companyRow?.[0]) || "BINGHATTI";

  const employeeRow = data[startRow + 3];
  if (!employeeRow) return null;

  const employeeId = formatCellValue(employeeRow[0]);
  const employeeName = formatCellValue(employeeRow[2]);

  if (!employeeId) return null;

  // Parse daily entries (typically 20 days)
  const entries: TimeEntry[] = [];
  let entryRow = startRow + 4;

  while (entryRow < data.length) {
    const row = data[entryRow];
    if (!row) break;

    const dateVal = row[0];
    // Check if this looks like a date (contains /)
    const dateStr = formatCellValue(dateVal);
    if (!dateStr || !dateStr.includes("/")) {
      break;
    }

    entries.push({
      date: dateStr,
      day: formatCellValue(row[1]) || "",
      in1: formatTimeValue(row[2]),
      out2: formatTimeValue(row[3]),
      in3: formatTimeValue(row[4]),
      out4: formatTimeValue(row[5]),
      in5: formatTimeValue(row[6]),
      out6: formatTimeValue(row[7]),
      lastIn: formatTimeValue(row[8]),
      lastOut: formatTimeValue(row[9]),
      netWorkHours: formatTimeValue(row[10]),
      lessWork: formatTimeValue(row[11]),
      authOT: formatTimeValue(row[12]),
      site: formatCellValue(row[13]),
      remarks: formatCellValue(row[14]),
    });

    entryRow++;
  }

  // Parse total hours row
  const totalRow = data[entryRow];
  const totalHours = totalRow ? formatTimeValue(totalRow[10]) : null;

  // Parse summary row
  const summaryRow = data[entryRow + 1];
  const summaryStats = summaryRow ? formatCellValue(summaryRow[0]) : null;

  return {
    employeeId,
    employeeName: employeeName || "",
    company,
    entries,
    totalHours,
    summaryStats,
  };
}
