import "dotenv/config";
import mongoose from "mongoose";

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is missing");

  try {
    await mongoose.connect(databaseUrl, { serverSelectionTimeoutMS: 10000 });
    const collection = mongoose.connection.collection("users");
    const indexes = await collection.listIndexes().toArray();
    if (indexes.some((index) => index.name === "mobileNumber_1")) {
      await collection.dropIndex("mobileNumber_1");
    }
    await collection.createIndex(
      { mobileNumber: 1 },
      {
        name: "mobileNumber_1",
        unique: true,
        partialFilterExpression: {
          mobileNumber: { $type: "string", $gt: "" },
        },
      }
    );
    console.log("User mobile number index now ignores missing and empty numbers.");
  } finally {
    await mongoose.disconnect();
  }
}

void run().catch(() => {
  console.error("User mobile number index migration failed; check database connectivity and configuration.");
  process.exitCode = 1;
});
