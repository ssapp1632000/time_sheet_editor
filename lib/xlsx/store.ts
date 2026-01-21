import type { XlsxStore, EmployeeXlsxData, DateRange } from "@/types/xlsx";
import {
  getXlsxImportDoc,
  saveXlsxImportDoc,
  addUpdatedEmployee,
  deleteXlsxImportDoc,
  type XlsxImportDocument,
} from "@/lib/db/xlsx-store-db";

// In-memory cache for the current request
let cachedStore: XlsxStore | null = null;

/**
 * Convert MongoDB document to XlsxStore format
 */
function docToStore(doc: XlsxImportDocument | null): XlsxStore {
  if (!doc) {
    return {
      employees: new Map(),
      employeeList: [],
      dateRange: null,
      isLoaded: false,
      updatedEmployees: new Set(),
    };
  }

  return {
    employees: new Map(doc.employees.map((e) => [e.employeeId, e])),
    employeeList: doc.employeeList,
    dateRange: doc.dateRange,
    isLoaded: doc.isLoaded,
    updatedEmployees: new Set(doc.updatedEmployees || []),
  };
}

/**
 * Load store from MongoDB (with caching)
 */
async function loadFromMongo(): Promise<XlsxStore> {
  if (cachedStore) {
    return cachedStore;
  }

  const doc = await getXlsxImportDoc();
  cachedStore = docToStore(doc);
  return cachedStore;
}

/**
 * Invalidate cache
 */
function invalidateCache(): void {
  cachedStore = null;
}

/**
 * Get the current XLSX store
 */
export async function getXlsxStore(): Promise<XlsxStore> {
  return loadFromMongo();
}

/**
 * Set the XLSX store with new data
 */
export async function setXlsxStore(store: XlsxStore): Promise<void> {
  await saveXlsxImportDoc({
    dateRange: store.dateRange,
    employees: Array.from(store.employees.values()),
    employeeList: store.employeeList,
    updatedEmployees: Array.from(store.updatedEmployees),
    isLoaded: store.isLoaded,
  });
  invalidateCache();
}

/**
 * Check if XLSX data has been loaded
 */
export async function isXlsxLoaded(): Promise<boolean> {
  const store = await loadFromMongo();
  return store.isLoaded;
}

/**
 * Get employee data by ID
 */
export async function getEmployeeById(
  employeeId: string
): Promise<EmployeeXlsxData | undefined> {
  const store = await loadFromMongo();
  return store.employees.get(employeeId);
}

/**
 * Get list of all employees
 */
export async function getEmployeeList(): Promise<
  Array<{ id: string; name: string }>
> {
  const store = await loadFromMongo();
  return store.employeeList;
}

/**
 * Get the date range from the XLSX
 */
export async function getDateRange(): Promise<DateRange | null> {
  const store = await loadFromMongo();
  return store.dateRange;
}

/**
 * Mark an employee as updated
 */
export async function markEmployeeUpdated(employeeId: string): Promise<void> {
  await addUpdatedEmployee(employeeId);
  invalidateCache();
}

/**
 * Get set of updated employee IDs
 */
export async function getUpdatedEmployees(): Promise<Set<string>> {
  const store = await loadFromMongo();
  return new Set(store.updatedEmployees);
}

/**
 * Clear the XLSX store
 */
export async function clearXlsxStore(): Promise<void> {
  await deleteXlsxImportDoc();
  invalidateCache();
}
