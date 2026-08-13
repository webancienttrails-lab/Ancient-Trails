import { Router } from "express";

import {
  blogImageUpload,
  createBlog,
  deleteBlog,
  getAdminBlog,
  getPublishedBlog,
  listAdminBlogs,
  listPublishedBlogs,
  updateBlog,
  uploadBlogImages,
} from "../controllers/blog.controller";
import { requireAdmin } from "../middleware/adminAuth";

export const publicBlogRoutes = Router();
export const adminBlogRoutes = Router();

publicBlogRoutes.get("/", listPublishedBlogs);
publicBlogRoutes.get("/:slug", getPublishedBlog);

adminBlogRoutes.use(requireAdmin);
adminBlogRoutes.get("/", listAdminBlogs);
adminBlogRoutes.get("/:id", getAdminBlog);
adminBlogRoutes.post(
  "/upload",
  blogImageUpload.fields([
    { name: "heroImage", maxCount: 1 },
  ]),
  uploadBlogImages
);
adminBlogRoutes.patch("/:id", updateBlog);
adminBlogRoutes.delete("/:id", deleteBlog);
adminBlogRoutes.post("/", createBlog);
