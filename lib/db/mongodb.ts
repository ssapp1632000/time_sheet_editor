import { MongoClient, Db, Collection, ObjectId } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI environment variable is not set");
}

const DATABASE_NAME = "sscommunity";

// Connection state
let client: MongoClient | null = null;
let db: Db | null = null;

// MongoDB document types
export interface UserDocument {
  _id: ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string;
  salary: number;
  manager?: ObjectId;
  role: string;
  department?: ObjectId;
  phone: string;
  avatar?: string;
  isActive: boolean;
  onLeave: boolean;
  geofenceRequired: boolean;
  dateOfJoining?: Date;
  dateOfBirth?: Date;
  address?: string;
  emergencyContact?: string;
  nationality?: string;
  gender?: string;
  leaveBalance: number;
  additionalPermissions: string[];
  jobTitle?: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Period {
  startTime: Date | null;
  endTime: Date | null;
  checkoutType?: "manual" | "auto";
  checkInLocation?: {
    lat?: number;
    long?: number;
    locationName?: string;
  };
  checkOutLocation?: {
    lat?: number;
    long?: number;
    locationName?: string;
  };
}

export interface AttendanceDayDocument {
  _id: ObjectId;
  user: ObjectId;
  day: Date;
  intervals?: Date[];
  periods: Period[];
  justification?: {
    content?: string;
    attachmentUrl?: string;
  };
  totalSeconds: number;
  isActive: boolean;
  isNightWork: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Connect to MongoDB and return the database instance
 */
export async function connectToDatabase(): Promise<Db> {
  if (db) {
    return db;
  }

  if (!client) {
    client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 1,
    });
    await client.connect();
    console.log("Connected to MongoDB");
  }

  db = client.db(DATABASE_NAME);
  return db;
}

/**
 * Get a typed collection
 */
export async function getCollection<T extends Document>(
  collectionName: string
): Promise<Collection<T>> {
  const database = await connectToDatabase();
  return database.collection<T>(collectionName);
}

/**
 * Get users collection
 */
export async function getUsersCollection(): Promise<Collection<UserDocument>> {
  const database = await connectToDatabase();
  return database.collection<UserDocument>("users");
}

/**
 * Get attendance days collection
 */
export async function getAttendanceCollection(): Promise<
  Collection<AttendanceDayDocument>
> {
  const database = await connectToDatabase();
  return database.collection<AttendanceDayDocument>("attendancedays");
}

/**
 * Find user by employee ID
 */
export async function findUserByEmployeeId(
  employeeId: string
): Promise<UserDocument | null> {
  const users = await getUsersCollection();
  return users.findOne({ employeeId });
}

/**
 * Get attendance records for a user within a date range
 */
export async function getAttendanceForUser(
  userId: ObjectId,
  startDate: Date,
  endDate: Date
): Promise<AttendanceDayDocument[]> {
  const attendance = await getAttendanceCollection();
  return attendance
    .find({
      user: userId,
      day: { $gte: startDate, $lte: endDate },
    })
    .sort({ day: 1 })
    .toArray();
}

/**
 * Close the MongoDB connection
 */
export async function closeConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log("MongoDB connection closed");
  }
}
