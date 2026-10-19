import "dotenv/config";
import { runNotificationMaintenance } from "./services/notifications/notification-worker.service";
import { notificationActivationDate } from "./services/notifications/notification-events.service";

import http from "node:http";

import mongoose from "mongoose";

import app from "./app";
import { runBookingRecoveryMaintenance } from "./controllers/booking.controller";
import { runSmartCollectMaintenance } from "./controllers/smartCollect.controller";

const port = Number(process.env.PORT) || 5000;
const databaseUrl = process.env.DATABASE_URL;

const server = http.createServer(app);
let notificationMaintenanceTimer: NodeJS.Timeout | null = null;
let bookingRecoveryMaintenanceTimer: NodeJS.Timeout | null = null;

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
    await notificationActivationDate();

    server.listen(port, () => {
      console.log(`Ancient Trails backend running on http://localhost:${port}`);
      console.log(`Health check: http://localhost:${port}/api/health`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });

    void runNotificationMaintenance();
    notificationMaintenanceTimer = setInterval(() => { void runNotificationMaintenance(); }, 15000);
    void runBookingRecoveryMaintenance();
    void runSmartCollectMaintenance().catch(() => console.error("Smart Collect maintenance failed"));
    bookingRecoveryMaintenanceTimer = setInterval(() => {
      void runSmartCollectMaintenance().catch(() => console.error("Smart Collect maintenance failed"));
      void runBookingRecoveryMaintenance().catch((error) => {
        console.error("Booking recovery maintenance failed:", error);
      });
    }, 5 * 60 * 1000);
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

  if (notificationMaintenanceTimer) { clearInterval(notificationMaintenanceTimer); notificationMaintenanceTimer = null; }
  if (bookingRecoveryMaintenanceTimer) {
    clearInterval(bookingRecoveryMaintenanceTimer);
    bookingRecoveryMaintenanceTimer = null;
  }

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
