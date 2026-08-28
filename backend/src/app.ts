import path from "node:path";

import cookieParser from "cookie-parser";
import cors, { type CorsOptions } from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import helmet from "helmet";
import morgan from "morgan";

import { adminAboutRoutes, publicAboutRoutes } from "./routes/about.routes";
import authRoutes from "./routes/auth.routes";
import { adminBlogRoutes, publicBlogRoutes } from "./routes/blog.routes";
import bookingRoutes, { publicBookingRoutes } from "./routes/booking.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import destinationRoutes from "./routes/destination.routes";
import experienceRoutes from "./routes/experience.routes";
import expertRoutes, { publicExpertRoutes } from "./routes/expert.routes";
import {
  adminHomePageRoutes,
  publicHomePageRoutes,
} from "./routes/homePage.routes";
import {
  adminMegaMenuRoutes,
  publicMegaMenuRoutes,
} from "./routes/megaMenu.routes";
import publicDestinationRoutes from "./routes/publicDestination.routes";
import publicExperienceRoutes from "./routes/publicExperience.routes";
import publicTourRoutes from "./routes/publicTour.routes";
import tourRoutes from "./routes/tour.routes";
import { HttpError } from "./utils/httpError";

const app = express();

function parseOrigins(...values: Array<string | undefined>): string[] {
  return values
    .flatMap((value) => value?.split(",") || [])
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Allowed frontend applications.
 */
const localDevelopmentOrigins =
  process.env.NODE_ENV === "production"
    ? []
    : [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
      ];

const allowedOrigins = Array.from(
  new Set(
    parseOrigins(
      process.env.FRONTEND_URL,
      process.env.FRONTEND_URLS,
      process.env.ADMIN_URL,
      process.env.ADMIN_URLS,
      "https://ancienttrailsmain.netlify.app",
      "https://adminancienttrail.netlify.app"
    ).concat(localDevelopmentOrigins)
  )
);

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Allow requests without an origin, such as Postman and server requests.
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },

  credentials: true,

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
  ],
};

/**
 * Security and common middleware.
 */
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

app.use(cors(corsOptions));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());

if (process.env.NODE_ENV !== "test") {
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
}

/**
 * Uploaded file directory.
 *
 * Development and production structure:
 *
 * backend/
 * ├── src/
 * └── storage/
 */
const storagePath = path.resolve(
  process.cwd(),
  process.env.UPLOAD_PATH || "./storage"
);

app.use(
  "/uploads",
  express.static(storagePath, {
    maxAge: process.env.NODE_ENV === "production" ? "30d" : 0,
    immutable: process.env.NODE_ENV === "production",
    fallthrough: false,
  })
);

/**
 * Basic API route.
 */
app.get("/", (_request: Request, response: Response) => {
  response.status(200).json({
    success: true,
    message: "Ancient Trails backend is running",
  });
});

/**
 * Health-check route.
 *
 * You can use this route later with NGINX or server monitoring.
 */
app.get("/api/health", (_request: Request, response: Response) => {
  response.status(200).json({
    success: true,
    message: "Server is healthy",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Add API routes above the 404 handler.
 *
 * Example:
 *
 * app.use("/api/auth", authRoutes);
 * app.use("/api/tours", tourRoutes);
 * app.use("/api/bookings", bookingRoutes);
 */
app.use("/api/auth", authRoutes);
app.use("/api/about", publicAboutRoutes);
app.use("/api/admin/about", adminAboutRoutes);
app.use("/api/blogs", publicBlogRoutes);
app.use("/api/admin/blogs", adminBlogRoutes);
app.use("/api/home", publicHomePageRoutes);
app.use("/api/admin/home", adminHomePageRoutes);
app.use("/api/mega-menu", publicMegaMenuRoutes);
app.use("/api/admin/mega-menu", adminMegaMenuRoutes);
app.use("/api/destinations", publicDestinationRoutes);
app.use("/api/tours", publicTourRoutes);
app.use("/api/experiences", publicExperienceRoutes);
app.use("/api/experts", publicExpertRoutes);
app.use("/api/bookings", publicBookingRoutes);
app.use("/api/admin/dashboard", dashboardRoutes);
app.use("/api/admin/bookings", bookingRoutes);
app.use("/api/admin/destinations", destinationRoutes);
app.use("/api/admin/experiences", experienceRoutes);
app.use("/api/admin/experts", expertRoutes);
app.use("/api/admin/tours", tourRoutes);

/**
 * Handle unknown API routes.
 */
app.use((request: Request, response: Response) => {
  response.status(404).json({
    success: false,
    message: `Route ${request.method} ${request.originalUrl} not found`,
  });
});

/**
 * Global error handler.
 */
app.use(
  (
    error: Error,
    _request: Request,
    response: Response,
    _next: NextFunction
  ) => {
    console.error("Application error:", error);

    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    const body: {
      success: false;
      message: string;
      details?: unknown;
    } = {
      success: false,
      message:
        process.env.NODE_ENV === "production" && statusCode >= 500
          ? "Something went wrong"
          : error.message,
    };

    if (error instanceof HttpError && error.details) {
      body.details = error.details;
    }

    response.status(statusCode).json(body);
  }
);

export default app;
