import { MongoClient, Db, Collection, ObjectId } from "mongodb";
import type { EmployeeXlsxData, DateRange, TimeEntry, SuspectDay } from "@/types/xlsx";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI environment variable is not set");
}

const DATABASE_NAME = "timesheet_store";
const COLLECTION_NAME = "xlsxImports";

// Connection state (separate from main mongodb.ts)
let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * Document structure for XLSX import data
 */
export interface XlsxImportDocument {
  _id?: ObjectId;
  dateRange: DateRange | null;
  employees: Array<{
    employeeId: string;
    employeeName: string;
    company: string;
    entries: TimeEntry[];
    totalHours: string | null;
    summaryStats: string | null;
  }>;
  employeeList: Array<{ id: string; name: string }>;
  updatedEmployees: string[];
  suspectDays: SuspectDay[];
  isLoaded: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Connect to the timesheet_store database
 */
export async function connectToXlsxStoreDb(): Promise<Db> {
  if (db) {
    return db;
  }

  if (!client) {
    client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 5,
      minPoolSize: 1,
    });
    await client.connect();
    console.log("Connected to timesheet_store database");
  }

  db = client.db(DATABASE_NAME);
  return db;
}

/**
 * Get the xlsxImports collection
 */
export async function getXlsxImportCollection(): Promise<
  Collection<XlsxImportDocument>
> {
  const database = await connectToXlsxStoreDb();
  return database.collection<XlsxImportDocument>(COLLECTION_NAME);
}

/**
 * Get the current XLSX import document (there's only one)
 */
export async function getXlsxImportDoc(): Promise<XlsxImportDocument | null> {
  const collection = await getXlsxImportCollection();
  return collection.findOne({});
}

/**
 * Save/replace the XLSX import document
 */
export async function saveXlsxImportDoc(
  doc: Omit<XlsxImportDocument, "_id" | "createdAt" | "updatedAt">
): Promise<void> {
  const collection = await getXlsxImportCollection();
  const now = new Date();

  // Delete existing and insert new (ensures only one document)
  await collection.deleteMany({});
  await collection.insertOne({
    ...doc,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Add employee ID to updatedEmployees array
 */
export async function addUpdatedEmployee(employeeId: string): Promise<void> {
  const collection = await getXlsxImportCollection();
  await collection.updateOne(
    {},
    {
      $addToSet: { updatedEmployees: employeeId },
      $set: { updatedAt: new Date() },
    }
  );
}

/**
 * Add a suspect day
 */
export async function addSuspectDay(employeeId: string, date: string): Promise<void> {
  const collection = await getXlsxImportCollection();
  await collection.updateOne(
    {},
    {
      $addToSet: { suspectDays: { employeeId, date } },
      $set: { updatedAt: new Date() },
    }
  );
}

/**
 * Remove a suspect day
 */
export async function removeSuspectDay(employeeId: string, date: string): Promise<void> {
  const collection = await getXlsxImportCollection();
  await collection.updateOne(
    {},
    {
      $pull: { suspectDays: { employeeId, date } },
      $set: { updatedAt: new Date() },
    }
  );
}

/**
 * Get all suspect days
 */
export async function getSuspectDays(): Promise<SuspectDay[]> {
  const doc = await getXlsxImportDoc();
  return doc?.suspectDays ?? [];
}

/**
 * Delete the XLSX import document
 */
export async function deleteXlsxImportDoc(): Promise<void> {
  const collection = await getXlsxImportCollection();
  await collection.deleteMany({});
}

/**
 * Close the connection
 */
export async function closeXlsxStoreConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log("timesheet_store connection closed");
  }
}
