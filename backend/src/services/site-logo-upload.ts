import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import type { RequestHandler } from "express";
import { HttpError } from "../utils/httpError";

const extensions: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif" };
export const siteLogoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 5 * 1024 * 1024 },
  fileFilter(_request, file, callback) {
    if (!extensions[file.mimetype]) return callback(new HttpError(400, "Please upload a PNG, JPG, WebP or GIF logo (maximum 5 MB)"));
    callback(null, true);
  },
});
export const parseSiteLogoUpload: RequestHandler = (request, response, next) => {
  siteLogoUpload.single("logo")(request, response, error => {
    if (error instanceof multer.MulterError) return next(new HttpError(400, error.code === "LIMIT_FILE_SIZE" ? "Logo must be smaller than 5 MB" : "Please select one logo image"));
    next(error);
  });
};

export function validLogoImage(buffer: Buffer, mime: string) {
  if (mime === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "image/jpeg") return buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (mime === "image/webp") return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  if (mime === "image/gif") return ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6));
  return false;
}
export async function saveSiteLogo(file?: Express.Multer.File) {
  if (!file || !validLogoImage(file.buffer, file.mimetype)) throw new HttpError(400, "Please select a valid PNG, JPG, WebP or GIF logo");
  const directory = path.resolve(process.cwd(), process.env.UPLOAD_PATH || "./storage", "site-logos");
  await mkdir(directory, { recursive: true });
  const name = randomUUID() + extensions[file.mimetype];
  await writeFile(path.join(directory, name), file.buffer, { flag: "wx" });
  return "/uploads/site-logos/" + name;
}
