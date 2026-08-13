import { Suspense } from "react";

import { BlogEditorQueryPage } from "../_components/blog-editor-query-page";

export default function ViewBlogPage() {
  return (
    <Suspense fallback={null}>
      <BlogEditorQueryPage mode="view" />
    </Suspense>
  );
}
