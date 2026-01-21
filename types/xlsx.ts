/**
 * Single time entry for a day from the XLSX file
 */
export interface TimeEntry {
  date: string; // DD/MM/YYYY
  day: string; // Day name (Monday, Tuesday, etc.)
  in1: string | null; // 1 IN - HH:mm
  out2: string | null; // 2 OUT - HH:mm
  in3: string | null; // 3 IN - HH:mm
  out4: string | null; // 4 OUT - HH:mm
  in5: string | null; // 5 IN - HH:mm
  out6: string | null; // 6 OUT - HH:mm
  lastIn: string | null; // Last IN - HH:mm
  lastOut: string | null; // Last OUT - HH:mm
  netWorkHours: string | null; // Net-Work Hours - HH:mm
  lessWork: string | null; // Less Work - HH:mm
  authOT: string | null; // Auth OT - HH:mm
  site: string | null; // Site name
  remarks: string | null; // Remarks
}

/**
 * Employee data parsed from XLSX
 */
export interface EmployeeXlsxData {
  employeeId: string;
  employeeName: string;
  company: string;
  entries: TimeEntry[];
  totalHours: string | null;
  summaryStats: string | null;
}

/**
 * Date range detected from XLSX
 */
export interface DateRange {
  start: string; // DD/MM/YYYY
  end: string; // DD/MM/YYYY
}

/**
 * In-memory store for parsed XLSX data
 */
export interface XlsxStore {
  employees: Map<string, EmployeeXlsxData>;
  employeeList: Array<{ id: string; name: string }>;
  dateRange: DateRange | null;
  isLoaded: boolean;
  updatedEmployees: Set<string>;
}
