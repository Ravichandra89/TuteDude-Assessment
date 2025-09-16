import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.DATABASE_URL as string, {
      dbName: process.env.DB_NAME || "proctoring",
    });
    console.log(`BOOM! MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("FAIL! MongoDB connection error:", error);
    process.exit(1); 
  }
};

export default connectDB;
