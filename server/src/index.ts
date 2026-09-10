import dotenv from "dotenv";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { startSlaSweeper } from "./services/slaSweeper.js";

dotenv.config();

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/corr_esc";

async function connectToDatabase(): Promise<void> {
  const isLocalhost = MONGODB_URI.includes("localhost") || MONGODB_URI.includes("127.0.0.1");

  if (process.env.USE_IN_MEMORY_DB === "true") {
    console.log("ℹ️  USE_IN_MEMORY_DB=true detected. Starting in-memory MongoDB for local development...");
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const memServer = await MongoMemoryServer.create();
    const memUri = memServer.getUri();
    await mongoose.connect(memUri);
    console.log(`✅ Connected to in-memory MongoDB (${memUri}).`);
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ Connected to MongoDB successfully.`);
  } catch (err: any) {
    if (MONGODB_URI.includes("mongodb.net")) {
      console.error("\n❌ Could not connect to MongoDB Atlas cluster!");
      console.error("👉 Common cause: Your current IP address is not whitelisted in MongoDB Atlas Network Access.");
      console.error("👉 To fix:");
      console.error("   1. Open MongoDB Atlas -> Security -> Network Access");
      console.error("   2. Click 'Add IP Address'");
      console.error("   3. Add your current IP or choose 'Allow Access From Anywhere' (0.0.0.0/0)");
      console.error("\n💡 Quick Workaround: Set USE_IN_MEMORY_DB=true in server/.env to develop offline without waiting for Atlas!\n");
    } else if (isLocalhost) {
      console.warn("\n⚠️  Local MongoDB service not found at 127.0.0.1:27017.");
      console.log("🚀 Starting in-memory MongoDB for local development...");
      
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      const memServer = await MongoMemoryServer.create();
      const memUri = memServer.getUri();

      await mongoose.connect(memUri);
      console.log(`✅ Connected to in-memory MongoDB for development.`);
      console.log(`💡 Tip: To use a persistent database, add your MongoDB Atlas URI to server/.env\n`);
      return;
    }
    throw err;
  }
}

async function main() {
  try {
    await connectToDatabase();

    const app = createApp();
    app.listen(PORT, () => {
      console.log(`🚀 CORR-ESC Backend Server running on http://localhost:${PORT}`);
      startSlaSweeper(30000);
    });
  } catch (error) {
    process.exit(1);
  }
}

main();
