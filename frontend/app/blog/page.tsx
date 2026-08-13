import type { Metadata } from "next";

import { BlogListPage } from "./_components/blog-pages";

export const metadata: Metadata = {
  title: "Travel Blog",
  description:
    "Stories, guides and inspiration from the world of heritage travel.",
};

export default function BlogPage() {
  return <BlogListPage />;
}
