import { mkdirSync } from "node:fs";
import path from "node:path";

import type { Request, Response } from "express";
import multer from "multer";
import { z } from "zod";

import {
  AboutPage,
  type AboutPageDocument,
  type AboutStatIcon,
  type IAboutStat,
  type IAboutTeamMember,
} from "../models/aboutPage.model";
import { HttpError } from "../utils/httpError";

const aboutPageKey = "about";
const aboutUploadDirectory = path.resolve(
  process.cwd(),
  process.env.UPLOAD_PATH || "./storage",
  "about"
);
const imageMimeExtensions: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
const aboutStatIcons = [
  "BookOpen",
  "MapPin",
  "Users",
  "CalendarDays",
  "Globe2",
] as const satisfies readonly AboutStatIcon[];

const defaultStats: IAboutStat[] = [
  {
    value: "150+",
    label: "Curated Tours",
    icon: "BookOpen",
    sortOrder: 0,
  },
  {
    value: "75+",
    label: "Destinations",
    icon: "MapPin",
    sortOrder: 1,
  },
  {
    value: "25,000+",
    label: "Happy Travellers",
    icon: "Users",
    sortOrder: 2,
  },
  {
    value: "12+",
    label: "Years of Experience",
    icon: "CalendarDays",
    sortOrder: 3,
  },
  {
    value: "10+",
    label: "Countries Explored",
    icon: "Globe2",
    sortOrder: 4,
  },
];

const defaultTeamMembers: IAboutTeamMember[] = [
  {
    name: "Girinath Bharade",
    role: "Founder & Heritage Expert",
    bio: "Indologist and cultural storyteller with deep expertise in temple architecture and iconography.",
    image: "/home assets/Khajuraho.webp",
    sortOrder: 0,
  },
  {
    name: "Ankita Deshpande",
    role: "Travel Curator",
    bio: "Passionate about art, culture and curating purposeful travel experiences.",
    image: "/home assets/destination/Udaipur.webp",
    sortOrder: 1,
  },
  {
    name: "Vikram Hegde",
    role: "Heritage Researcher",
    bio: "Researcher and photographer specialising in history, folklore and traditions.",
    image: "/home assets/destination/Hampi.webp",
    sortOrder: 2,
  },
  {
    name: "Pooja Menon",
    role: "Operations Lead",
    bio: "Ensures seamless travel experiences with attention to every little detail.",
    image: "/home assets/destination/Varanasi.webp",
    sortOrder: 3,
  },
];

mkdirSync(aboutUploadDirectory, { recursive: true });

function createSafeFileName(file: Express.Multer.File): string {
  const baseName =
    path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "about";
  const extension =
    imageMimeExtensions[file.mimetype] ||
    path.extname(file.originalname).toLowerCase() ||
    ".jpg";
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return `${baseName}-${suffix}${extension}`;
}

function getUploadUrl(file: Express.Multer.File): string {
  return `/uploads/about/${file.filename}`;
}

export const aboutImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => {
      callback(null, aboutUploadDirectory);
    },
    filename: (_request, file, callback) => {
      callback(null, createSafeFileName(file));
    },
  }),
  fileFilter: (_request, file, callback) => {
    if (file.mimetype in imageMimeExtensions) {
      callback(null, true);
      return;
    }

    callback(new HttpError(400, "Only JPG, PNG, WebP, and GIF images are allowed"));
  },
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1,
  },
});

const requiredTextField = (fieldName: string, max: number) =>
  z.string().trim().min(1, `${fieldName} is required`).max(max);
const textField = (max: number) => z.string().trim().max(max).default("");
const sortOrderField = z.coerce.number().int().min(0).max(999).default(0);

const aboutStatPayloadSchema = z.object({
  label: requiredTextField("Stat label", 80),
  value: requiredTextField("Stat value", 30),
  icon: z.enum(aboutStatIcons).default("BookOpen"),
  sortOrder: sortOrderField,
});

const aboutTeamMemberPayloadSchema = z.object({
  name: requiredTextField("Team member name", 120),
  role: requiredTextField("Team member role", 120),
  bio: requiredTextField("Team member bio", 500),
  image: textField(500),
  sortOrder: sortOrderField,
});

const aboutPagePayloadSchema = z.object({
  stats: z.array(aboutStatPayloadSchema).min(1).max(8),
  teamMembers: z.array(aboutTeamMemberPayloadSchema).min(1).max(12),
});

function parseRequestBody<TSchema extends z.ZodType>(
  schema: TSchema,
  body: unknown
): z.infer<TSchema> {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new HttpError(
      400,
      "Validation failed",
      result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }))
    );
  }

  return result.data;
}

function sortBySortOrder<TItem extends { sortOrder: number }>(items: TItem[]) {
  return [...items].sort((left, right) => left.sortOrder - right.sortOrder);
}

function getSubdocumentId(item: unknown, fallback: string) {
  if (typeof item !== "object" || item === null || !("_id" in item)) {
    return fallback;
  }

  const id = (item as { _id?: unknown })._id;

  if (
    typeof id === "object" &&
    id !== null &&
    "toString" in id &&
    typeof id.toString === "function"
  ) {
    return id.toString();
  }

  return fallback;
}

function formatAboutPage(page: AboutPageDocument) {
  return {
    id: page._id.toString(),
    stats: sortBySortOrder(page.stats).map((stat, index) => ({
      id: getSubdocumentId(stat, `stat-${index}`),
      label: stat.label,
      value: stat.value,
      icon: stat.icon,
      sortOrder: stat.sortOrder,
    })),
    teamMembers: sortBySortOrder(page.teamMembers).map((member, index) => ({
      id: getSubdocumentId(member, `team-${index}`),
      name: member.name,
      role: member.role,
      bio: member.bio,
      image: member.image,
      sortOrder: member.sortOrder,
    })),
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };
}

async function getOrCreateAboutPage(): Promise<AboutPageDocument> {
  const existingPage = await AboutPage.findOne({ pageKey: aboutPageKey });

  if (existingPage) {
    return existingPage;
  }

  return AboutPage.create({
    pageKey: aboutPageKey,
    stats: defaultStats,
    teamMembers: defaultTeamMembers,
  });
}

export async function getAboutPage(
  _request: Request,
  response: Response
): Promise<void> {
  const page = await getOrCreateAboutPage();

  response.status(200).json({
    success: true,
    message: "About page content fetched successfully",
    data: {
      about: formatAboutPage(page),
    },
  });
}

export async function updateAboutPage(
  request: Request,
  response: Response
): Promise<void> {
  const payload = parseRequestBody(aboutPagePayloadSchema, request.body);
  const page = await AboutPage.findOneAndUpdate(
    { pageKey: aboutPageKey },
    {
      $set: {
        stats: payload.stats,
        teamMembers: payload.teamMembers,
      },
      $setOnInsert: {
        pageKey: aboutPageKey,
      },
    },
    {
      new: true,
      runValidators: true,
      upsert: true,
    }
  );

  if (!page) {
    throw new HttpError(500, "Unable to update about page content");
  }

  response.status(200).json({
    success: true,
    message: "About page content updated successfully",
    data: {
      about: formatAboutPage(page),
    },
  });
}

export async function uploadAboutImage(
  request: Request,
  response: Response
): Promise<void> {
  const file = request.file;

  if (!file) {
    throw new HttpError(400, "Please select an image to upload");
  }

  response.status(201).json({
    success: true,
    message: "Image uploaded successfully",
    data: {
      image: getUploadUrl(file),
    },
  });
}
