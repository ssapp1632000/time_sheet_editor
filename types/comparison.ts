/**
 * Source of data for a cell
 */
export type DataSource = "xlsx" | "mongodb";

/**
 * Discrepancies detected for a day
 */
export interface Discrepancies {
  in1Missing: boolean; // 1 IN missing in xlsx but present in MongoDB
  out2Missing: boolean; // 2 OUT missing in xlsx but present in MongoDB
  lowHours: boolean; // Net work hours between 3-4 hours
}

/**
 * XLSX values for a day
 */
export interface XlsxDayData {
  in1: string | null;
  out2: string | null;
  netWorkHours: string | null;
}

/**
 * MongoDB values for a day
 */
export interface MongoDayData {
  firstCheckIn: string | null;
  lastCheckOut: string | null;
  totalHours: string | null;
}

/**
 * User's selection for a cell (which source to use)
 */
export interface CellSelection {
  checkIn: DataSource;
  checkOut: DataSource;
}

/**
 * Comparison data for a single day
 */
export interface DayComparison {
  date: string; // DD/MM/YYYY
  dayName: string; // Day name
  xlsx: XlsxDayData;
  mongo: MongoDayData;
  discrepancies: Discrepancies;
  issues: string[];
  selection: CellSelection; // User's selection for this day
}

/**
 * Full comparison result for an employee
 */
export interface ComparisonData {
  days: DayComparison[];
  totalIssues: number;
}

/**
 * Employee info for display
 */
export interface EmployeeInfo {
  id: string;
  name: string;
  company: string;
}

/**
 * API response for comparison endpoint
 */
export interface ComparisonResponse {
  employee: EmployeeInfo;
  comparison: ComparisonData;
}

/**
 * Update request for a single day
 */
export interface DayUpdate {
  date: string; // DD/MM/YYYY
  checkIn?: string | null; // HH:mm
  checkOut?: string | null; // HH:mm
}

/**
 * Bulk update request
 */
export interface BulkUpdateRequest {
  updates: DayUpdate[];
}

/**
 * Bulk update response
 */
export interface BulkUpdateResponse {
  success: boolean;
  updatedCount: number;
  errors?: string[];
}
