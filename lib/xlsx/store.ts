import fs from "fs";
import path from "path";
import type { XlsxStore, EmployeeXlsxData, DateRange } from "@/types/xlsx";

// File path for persistent storage
const STORE_FILE_PATH = path.join(process.cwd(), ".xlsx-store.json");

// Serializable version of the store (Map and Set converted to arrays)
interface SerializableStore {
  employees: Array<[string, EmployeeXlsxData]>;
  employeeList: Array<{ id: string; name: string }>;
  dateRange: DateRange | null;
  isLoaded: boolean;
  updatedEmployees: string[];
}

// Module-level in-memory store (persists across requests in same process)
let xlsxStore: XlsxStore = {
  employees: new Map(),
  employeeList: [],
  dateRange: null,
  isLoaded: false,
  updatedEmployees: new Set(),
};

// Flag to track if we've tried loading from file
let hasTriedFileLoad = false;

/**
 * Load store from file if it exists
 */
function loadFromFile(): void {
  if (hasTriedFileLoad) return;
  hasTriedFileLoad = true;

  try {
    if (fs.existsSync(STORE_FILE_PATH)) {
      const data = fs.readFileSync(STORE_FILE_PATH, "utf-8");
      const parsed: SerializableStore = JSON.parse(data);

      xlsxStore = {
        employees: new Map(parsed.employees),
        employeeList: parsed.employeeList,
        dateRange: parsed.dateRange,
        isLoaded: parsed.isLoaded,
        updatedEmployees: new Set(parsed.updatedEmployees || []),
      };
      console.log("XLSX store loaded from file");
    }
  } catch (error) {
    console.error("Error loading XLSX store from file:", error);
  }
}

/**
 * Save store to file
 */
function saveToFile(): void {
  try {
    const serializable: SerializableStore = {
      employees: Array.from(xlsxStore.employees.entries()),
      employeeList: xlsxStore.employeeList,
      dateRange: xlsxStore.dateRange,
      isLoaded: xlsxStore.isLoaded,
      updatedEmployees: Array.from(xlsxStore.updatedEmployees),
    };

    fs.writeFileSync(STORE_FILE_PATH, JSON.stringify(serializable), "utf-8");
    console.log("XLSX store saved to file");
  } catch (error) {
    console.error("Error saving XLSX store to file:", error);
  }
}

/**
 * Get the current XLSX store
 */
export function getXlsxStore(): XlsxStore {
  loadFromFile();
  return xlsxStore;
}

/**
 * Set the XLSX store with new data
 */
export function setXlsxStore(store: XlsxStore): void {
  xlsxStore = store;
  saveToFile();
}

/**
 * Check if XLSX data has been loaded
 */
export function isXlsxLoaded(): boolean {
  loadFromFile();
  return xlsxStore.isLoaded;
}

/**
 * Get employee data by ID
 */
export function getEmployeeById(
  employeeId: string
): EmployeeXlsxData | undefined {
  loadFromFile();
  return xlsxStore.employees.get(employeeId);
}

/**
 * Get list of all employees
 */
export function getEmployeeList(): Array<{ id: string; name: string }> {
  loadFromFile();
  return xlsxStore.employeeList;
}

/**
 * Get the date range from the XLSX
 */
export function getDateRange(): DateRange | null {
  loadFromFile();
  return xlsxStore.dateRange;
}

/**
 * Mark an employee as updated
 */
export function markEmployeeUpdated(employeeId: string): void {
  loadFromFile();
  xlsxStore.updatedEmployees.add(employeeId);
  saveToFile();
}

/**
 * Get set of updated employee IDs
 */
export function getUpdatedEmployees(): Set<string> {
  loadFromFile();
  return new Set(xlsxStore.updatedEmployees);
}

/**
 * Clear the XLSX store
 */
export function clearXlsxStore(): void {
  xlsxStore = {
    employees: new Map(),
    employeeList: [],
    dateRange: null,
    isLoaded: false,
    updatedEmployees: new Set(),
  };

  // Delete the file
  try {
    if (fs.existsSync(STORE_FILE_PATH)) {
      fs.unlinkSync(STORE_FILE_PATH);
      console.log("XLSX store file deleted");
    }
  } catch (error) {
    console.error("Error deleting XLSX store file:", error);
  }

  hasTriedFileLoad = false;
}
