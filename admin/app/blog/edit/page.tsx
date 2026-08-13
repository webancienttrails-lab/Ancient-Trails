import { Suspense } from "react";

import { BlogEditorQueryPage } from "../_components/blog-editor-query-page";

export default function EditBlogPage() {
  return (
    <Suspense fallback={null}>
      <BlogEditorQueryPage mode="edit" />
    </Suspense>
  );
}
