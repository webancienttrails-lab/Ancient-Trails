import { mkdirSync } from "node:fs";
import path from "node:path";

import type { Request, Response } from "express";
import multer from "multer";
import { z } from "zod";

import {
  BlogCategory,
  BlogPost,
  BlogStatus,
  type BlogDocument,
} from "../models/blog.model";
import { HttpError } from "../utils/httpError";

const textField = (max: number) => z.string().trim().max(max).default("");
const requiredTextField = (fieldName: string, max: number) =>
  z.string().trim().min(1, `${fieldName} is required`).max(max);
const blogUploadDirectory = path.resolve(
  process.cwd(),
  process.env.UPLOAD_PATH || "./storage",
  "blogs"
);
const imageMimeExtensions: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

mkdirSync(blogUploadDirectory, { recursive: true });

function createSafeFileName(file: Express.Multer.File): string {
  const baseName =
    path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "blog";
  const extension =
    imageMimeExtensions[file.mimetype] ||
    path.extname(file.originalname).toLowerCase() ||
    ".jpg";
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return `${baseName}-${suffix}${extension}`;
}

function getUploadUrl(file: Express.Multer.File): string {
  return `/uploads/blogs/${file.filename}`;
}

export const blogImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => {
      callback(null, blogUploadDirectory);
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
    fileSize: 5 * 1024 * 1024,
    files: 2,
  },
});

const optionalDateField = z
  .string()
  .trim()
  .default("")
  .refine(
    (value) => !value || !Number.isNaN(new Date(value).getTime()),
    "Published date must be a valid date"
  )
  .transform((value) => (value ? new Date(value) : null));

const blogPayloadSchema = z.object({
  blogId: z
    .string()
    .trim()
    .max(40)
    .regex(
      /^[A-Za-z0-9_-]*$/,
      "Blog ID can contain letters, numbers, hyphens, and underscores only"
    )
    .default("")
    .transform((value) => value.toUpperCase()),
  title: requiredTextField("Blog title", 180),
  slug: z
    .string()
    .trim()
    .max(220)
    .regex(
      /^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/i,
      "Slug can contain lowercase letters, numbers, and single hyphens only"
    )
    .default(""),
  category: z.enum([
    BlogCategory.HERITAGE,
    BlogCategory.HISTORY,
    BlogCategory.ART_AND_CULTURE,
    BlogCategory.TRAVEL_GUIDE,
    BlogCategory.DESTINATIONS,
    BlogCategory.TRAVEL_TIPS,
    BlogCategory.UNCATEGORIZED,
  ]),
  content: textField(30000),
  quote: textField(500),
  authorName: textField(120).transform((value) => value || "Ancient Trails"),
  heroImage: textField(500),
  seoTitle: textField(70),
  seoDescription: textField(170),
  seoKeywords: textField(300),
  canonicalUrl: textField(500),
  ogTitle: textField(95),
  ogDescription: textField(220),
  ogImage: textField(500),
  status: z.enum([BlogStatus.PUBLISHED, BlogStatus.DRAFT, BlogStatus.ARCHIVED]),
  readTimeMinutes: z.coerce.number().int().min(1).max(120).default(5),
  popularRank: z.coerce.number().int().min(0).max(999).default(0),
  publishedAt: optionalDateField,
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

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

function isCastError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "CastError"
  );
}

function createSlug(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-")
      .slice(0, 200) || `blog-${Date.now()}`
  );
}

function createBlogId(title: string): string {
  const prefix = createSlug(title)
    .split("-")
    .slice(0, 4)
    .join("-")
    .toUpperCase();

  return `BLOG-${prefix || "POST"}-${Date.now().toString(36).toUpperCase()}`.slice(
    0,
    40
  );
}

function prepareBlogPayload(
  payload: z.infer<typeof blogPayloadSchema>,
  existingPublishedAt?: Date | null
) {
  const nextPayload = {
    ...payload,
    blogId: payload.blogId || createBlogId(payload.title),
    slug: payload.slug ? createSlug(payload.slug) : createSlug(payload.title),
  };

  if (nextPayload.status === BlogStatus.PUBLISHED && !nextPayload.publishedAt) {
    nextPayload.publishedAt = existingPublishedAt || new Date();
  }

  if (nextPayload.status !== BlogStatus.PUBLISHED && !payload.publishedAt) {
    nextPayload.publishedAt = null;
  }

  return nextPayload;
}

function formatBlog(blog: BlogDocument) {
  return {
    id: blog._id.toString(),
    blogId: blog.blogId,
    title: blog.title,
    slug: blog.slug,
    category: blog.category,
    content: blog.content,
    quote: blog.quote,
    authorName: blog.authorName,
    heroImage: blog.heroImage,
    seoTitle: blog.seoTitle || "",
    seoDescription: blog.seoDescription || "",
    seoKeywords: blog.seoKeywords || "",
    canonicalUrl: blog.canonicalUrl || "",
    ogTitle: blog.ogTitle || "",
    ogDescription: blog.ogDescription || "",
    ogImage: blog.ogImage || "",
    status: blog.status,
    readTimeMinutes: blog.readTimeMinutes,
    popularRank: blog.popularRank,
    publishedAt: blog.publishedAt,
    createdAt: blog.createdAt,
    updatedAt: blog.updatedAt,
  };
}

function getSearchFilter(search: string) {
  if (!search) {
    return {};
  }

  return {
    $or: [
      { blogId: new RegExp(search, "i") },
      { title: new RegExp(search, "i") },
      { slug: new RegExp(search, "i") },
      { category: new RegExp(search, "i") },
      { authorName: new RegExp(search, "i") },
      { content: new RegExp(search, "i") },
      { seoTitle: new RegExp(search, "i") },
      { seoDescription: new RegExp(search, "i") },
      { seoKeywords: new RegExp(search, "i") },
    ],
  };
}

export async function listPublishedBlogs(
  request: Request,
  response: Response
): Promise<void> {
  const search =
    typeof request.query.search === "string" ? request.query.search.trim() : "";
  const category =
    typeof request.query.category === "string"
      ? request.query.category.trim()
      : "";
  const limit = Math.min(
    Math.max(Number(request.query.limit) || 48, 1),
    100
  );
  const filters: Record<string, unknown> = {
    status: BlogStatus.PUBLISHED,
    ...getSearchFilter(search),
  };

  if (Object.values(BlogCategory).includes(category as BlogCategory)) {
    filters.category = category;
  }

  const [blogs, total, categoryCounts, popularPosts] = await Promise.all([
    BlogPost.find(filters).sort({ publishedAt: -1, createdAt: -1 }).limit(limit),
    BlogPost.countDocuments(filters),
    BlogPost.aggregate<{ _id: BlogCategory; count: number }>([
      { $match: { status: BlogStatus.PUBLISHED } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    BlogPost.find({ status: BlogStatus.PUBLISHED })
      .sort({ popularRank: 1, publishedAt: -1, createdAt: -1 })
      .limit(5),
  ]);

  response.status(200).json({
    success: true,
    message: "Blogs fetched successfully",
    data: {
      blogs: blogs.map(formatBlog),
      categories: categoryCounts.map((item) => ({
        category: item._id,
        count: item.count,
      })),
      popularPosts: popularPosts.map(formatBlog),
      total,
    },
  });
}

export async function getPublishedBlog(
  request: Request,
  response: Response
): Promise<void> {
  const blog = await BlogPost.findOne({
    slug: request.params.slug,
    status: BlogStatus.PUBLISHED,
  });

  if (!blog) {
    throw new HttpError(404, "Blog not found");
  }

  const [popularPosts, adjacentPosts] = await Promise.all([
    BlogPost.find({ status: BlogStatus.PUBLISHED, _id: { $ne: blog._id } })
      .sort({ popularRank: 1, publishedAt: -1, createdAt: -1 })
      .limit(5),
    BlogPost.find({ status: BlogStatus.PUBLISHED, _id: { $ne: blog._id } })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(12),
  ]);
  const currentIndex = adjacentPosts.findIndex(
    (post) => post.publishedAt && blog.publishedAt && post.publishedAt < blog.publishedAt
  );

  response.status(200).json({
    success: true,
    message: "Blog fetched successfully",
    data: {
      blog: formatBlog(blog),
      popularPosts: popularPosts.map(formatBlog),
      adjacentPosts: adjacentPosts.map(formatBlog),
      currentIndex,
    },
  });
}

export async function listAdminBlogs(
  request: Request,
  response: Response
): Promise<void> {
  const search =
    typeof request.query.search === "string" ? request.query.search.trim() : "";
  const status =
    typeof request.query.status === "string" ? request.query.status.trim() : "";
  const category =
    typeof request.query.category === "string"
      ? request.query.category.trim()
      : "";
  const filters: Record<string, unknown> = getSearchFilter(search);

  if (Object.values(BlogStatus).includes(status as BlogStatus)) {
    filters.status = status;
  }

  if (Object.values(BlogCategory).includes(category as BlogCategory)) {
    filters.category = category;
  }

  const blogs = await BlogPost.find(filters)
    .sort({ createdAt: -1 })
    .limit(200);

  response.status(200).json({
    success: true,
    message: "Blogs fetched successfully",
    data: {
      blogs: blogs.map(formatBlog),
    },
  });
}

export async function getAdminBlog(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const blog = await BlogPost.findById(request.params.id);

    if (!blog) {
      throw new HttpError(404, "Blog not found");
    }

    response.status(200).json({
      success: true,
      message: "Blog fetched successfully",
      data: {
        blog: formatBlog(blog),
      },
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid blog ID");
    }

    throw error;
  }
}

export async function createBlog(
  request: Request,
  response: Response
): Promise<void> {
  const payload = prepareBlogPayload(
    parseRequestBody(blogPayloadSchema, request.body)
  );

  try {
    const blog = await BlogPost.create(payload);

    response.status(201).json({
      success: true,
      message: "Blog created successfully",
      data: {
        blog: formatBlog(blog),
      },
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, "Blog ID or slug already exists");
    }

    throw error;
  }
}

export async function updateBlog(
  request: Request,
  response: Response
): Promise<void> {
  const existingBlog = await BlogPost.findById(request.params.id);

  if (!existingBlog) {
    throw new HttpError(404, "Blog not found");
  }

  const payload = prepareBlogPayload(
    parseRequestBody(blogPayloadSchema, request.body),
    existingBlog.publishedAt
  );

  try {
    const blog = await BlogPost.findByIdAndUpdate(request.params.id, payload, {
      new: true,
      runValidators: true,
    });

    if (!blog) {
      throw new HttpError(404, "Blog not found");
    }

    response.status(200).json({
      success: true,
      message: "Blog updated successfully",
      data: {
        blog: formatBlog(blog),
      },
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, "Blog ID or slug already exists");
    }

    if (isCastError(error)) {
      throw new HttpError(400, "Invalid blog ID");
    }

    throw error;
  }
}

export async function deleteBlog(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const blog = await BlogPost.findByIdAndDelete(request.params.id);

    if (!blog) {
      throw new HttpError(404, "Blog not found");
    }

    response.status(200).json({
      success: true,
      message: "Blog deleted successfully",
      data: {
        blog: formatBlog(blog),
      },
    });
  } catch (error) {
    if (isCastError(error)) {
      throw new HttpError(400, "Invalid blog ID");
    }

    throw error;
  }
}

export async function uploadBlogImages(
  request: Request,
  response: Response
): Promise<void> {
  const files = request.files as
    | {
        heroImage?: Express.Multer.File[];
      }
    | undefined;
  const heroImage = files?.heroImage?.[0]
    ? getUploadUrl(files.heroImage[0])
    : "";

  if (!heroImage) {
    throw new HttpError(400, "Please select a hero image to upload");
  }

  response.status(201).json({
    success: true,
    message: "Image uploaded successfully",
    data: {
      heroImage,
    },
  });
}
