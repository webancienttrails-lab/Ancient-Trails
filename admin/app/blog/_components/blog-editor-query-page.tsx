"use client";

import { useSearchParams } from "next/navigation";

import {
  BlogEditorPage,
  type BlogEditorMode,
} from "./blog-editor-page";

type QueryEditorMode = Exclude<BlogEditorMode, "add">;

export function BlogEditorQueryPage({ mode }: { mode: QueryEditorMode }) {
  const searchParams = useSearchParams();
  const blogId = searchParams.get("id") || undefined;

  return <BlogEditorPage blogId={blogId} mode={mode} />;
}
