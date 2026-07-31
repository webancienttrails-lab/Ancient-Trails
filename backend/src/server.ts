import "dotenv/config";

import http from "node:http";

import mongoose from "mongoose";

import app from "./app";

const port = Number(process.env.PORT) || 5000;
const databaseUrl = process.env.DATABASE_URL;

const server = http.createServer(app);

async function connectDatabase(): Promise<void> {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing from the .env file");
  }

  await mongoose.connect(databaseUrl);

  console.log("MongoDB Atlas connected successfully");
}

async function startServer(): Promise<void> {
  try {
    await connectDatabase();

    server.listen(port, () => {
      console.log(`Ancient Trails backend running on http://localhost:${port}`);
      console.log(`Health check: http://localhost:${port}/api/health`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error("Failed to start Ancient Trails backend:", error);
    process.exit(1);
  }
}

/**
 * Gracefully stop the application.
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received. Shutting down server...`);

  server.close(async (serverError) => {
    if (serverError) {
      console.error("Error while closing HTTP server:", serverError);
      process.exit(1);
    }

    try {
      await mongoose.connection.close();
      console.log("MongoDB connection closed");
      process.exit(0);
    } catch (databaseError) {
      console.error(
        "Error while closing MongoDB connection:",
        databaseError
      );
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);

  void shutdown("UNHANDLED_REJECTION");
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);

  void shutdown("UNCAUGHT_EXCEPTION");
});

void startServer();