"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  MoreHorizontal,
  Pencil,
  PencilLine,
  Plus,
  Search,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import {
  AdminDashboardShell,
  AdminSidebarToggle,
} from "@/components/admin-dashboard/admin-dashboard-shell";
import { HeaderDateRangePicker } from "@/components/admin-dashboard/header-date-range-picker";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  deleteAdminBlog,
  listAdminBlogs,
  type AdminBlog,
  type BlogCategory,
  type BlogStatus,
} from "@/lib/blogs";
import { cn } from "@/lib/utils";

type BlogMetric = {
  label: string;
  value: string;
  trend: string;
  trendClassName: string;
  icon: LucideIcon;
  tone: string;
};

const blogCategoryOptions: BlogCategory[] = [
  "Heritage",
  "History",
  "Art & Culture",
  "Travel Guide",
  "Destinations",
  "Travel Tips",
  "Uncategorized",
];
const blogStatusOptions: BlogStatus[] = ["Published", "Draft", "Archived"];
const statusFilterOptions = ["All Status", ...blogStatusOptions];
const categoryFilterOptions = ["All Categories", ...blogCategoryOptions];

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "details" in error &&
    Array.isArray((error as { details?: unknown }).details)
  ) {
    const details = (error as {
      details: Array<{ message?: unknown; path?: unknown }>;
    }).details;
    const detailMessages = details
      .map((detail) => {
        const message =
          typeof detail.message === "string" ? detail.message.trim() : "";
        const path =
          typeof detail.path === "string" && detail.path.trim()
            ? `${detail.path}: `
            : "";

        return message ? `${path}${message}` : "";
      })
      .filter(Boolean);

    if (detailMessages.length > 0) {
      return detailMessages.join(" ");
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}

function formatTime(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string): string {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AT"
  );
}

function createBlogMetrics(blogs: AdminBlog[]): BlogMetric[] {
  const publishedCount = blogs.filter((blog) => blog.status === "Published").length;
  const draftCount = blogs.filter((blog) => blog.status === "Draft").length;
  const archivedCount = blogs.filter((blog) => blog.status === "Archived").length;
  const publishedRatio = blogs.length
    ? `${Math.round((publishedCount / blogs.length) * 100)}% of total`
    : "No published blogs yet";

  return [
    {
      label: "Total Blogs",
      value: blogs.length.toString(),
      trend: "Live blog records",
      trendClassName: "text-foreground/60",
      icon: FileText,
      tone: "bg-primary/10 text-primary",
    },
    {
      label: "Published Blogs",
      value: publishedCount.toString(),
      trend: publishedRatio,
      trendClassName: "text-emerald-600",
      icon: FileCheck2,
      tone: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Draft Blogs",
      value: draftCount.toString(),
      trend: "Waiting to publish",
      trendClassName: "text-primary",
      icon: PencilLine,
      tone: "bg-amber-100 text-amber-700",
    },
    {
      label: "Archived Blogs",
      value: archivedCount.toString(),
      trend: "Hidden from public blog",
      trendClassName: "text-violet-600",
      icon: Archive,
      tone: "bg-violet-100 text-violet-700",
    },
  ];
}

export default function BlogPage() {
  const toast = useToast();
  const [blogs, setBlogs] = useState<AdminBlog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [isLoadingBlogs, setIsLoadingBlogs] = useState(true);
  const [isDeletingBlogId, setIsDeletingBlogId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadBlogs() {
      try {
        const response = await listAdminBlogs();

        if (isMounted) {
          setBlogs(response.data.blogs);
        }
      } catch (error) {
        toast.error("Unable to load blogs", getErrorMessage(error));
      } finally {
        if (isMounted) {
          setIsLoadingBlogs(false);
        }
      }
    }

    loadBlogs();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  const filteredBlogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return blogs.filter((blog) => {
      const matchesQuery =
        !query ||
        [
          blog.blogId,
          blog.title,
          blog.slug,
          blog.category,
          blog.authorName,
          blog.content,
          blog.seoTitle,
          blog.seoDescription,
          blog.seoKeywords,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesStatus =
        statusFilter === "All Status" || blog.status === statusFilter;
      const matchesCategory =
        categoryFilter === "All Categories" || blog.category === categoryFilter;

      return matchesQuery && matchesStatus && matchesCategory;
    });
  }, [blogs, categoryFilter, searchQuery, statusFilter]);

  const blogMetrics = useMemo(() => createBlogMetrics(blogs), [blogs]);

  async function handleDeleteBlog(blog: AdminBlog) {
    const shouldDelete = window.confirm(
      `Delete "${blog.title}" from the blog library?`
    );

    if (!shouldDelete) {
      return;
    }

    setIsDeletingBlogId(blog.id);

    try {
      const response = await deleteAdminBlog(blog.id);

      setBlogs((currentBlogs) =>
        currentBlogs.filter((currentBlog) => currentBlog.id !== blog.id)
      );
      toast.success("Blog deleted", response.message);
    } catch (error) {
      toast.error("Blog not deleted", getErrorMessage(error));
    } finally {
      setIsDeletingBlogId(null);
    }
  }

  return (
    <AdminDashboardShell activeLabel="Blog">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <BlogHeader />

        <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-sans text-2xl font-bold tracking-normal text-foreground">
              Blog
            </h1>
            <p className="mt-1 text-sm text-foreground/60">
              Upload, edit, publish, and archive website blog posts.
            </p>
          </div>

          <Button
            render={<Link href="/blog/new" />}
            type="button"
            className="h-10 rounded-sm px-4 text-xs font-bold"
          >
            <Plus className="size-4" data-icon="inline-start" />
            Add New Blog
          </Button>
        </section>

        <section
          data-admin-metric-grid
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {blogMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </section>

        <section className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
          <BlogToolbar
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            onSearchQueryChange={setSearchQuery}
            onStatusFilterChange={setStatusFilter}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
          />
          <BlogTable
            blogs={filteredBlogs}
            isDeletingBlogId={isDeletingBlogId}
            isLoading={isLoadingBlogs}
            onDelete={handleDeleteBlog}
            totalCount={blogs.length}
          />
        </section>
      </div>
    </AdminDashboardShell>
  );
}

function BlogHeader() {
  const toast = useToast();

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <AdminSidebarToggle />
        <div className="min-w-0">
          <h1 className="font-sans text-2xl font-bold tracking-normal text-foreground">
            Blog
          </h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-foreground/55">
            <span>Dashboard</span>
            <span aria-hidden="true">&gt;</span>
            <span className="font-medium text-foreground/75">Blog</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <HeaderDateRangePicker />
        <button
          onClick={() =>
            toast.info("Notifications", "You have 3 blog notifications.")
          }
          className="relative grid size-10 place-items-center rounded-sm border border-border bg-white text-foreground transition-colors hover:border-primary hover:text-primary"
          type="button"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-white">
            3
          </span>
        </button>
        <button
          onClick={() =>
            toast.info("Admin profile", "Profile menu will open here.")
          }
          className="flex h-10 items-center gap-2 rounded-sm border border-border bg-white px-2.5 text-sm font-semibold transition-colors hover:border-primary"
          type="button"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#7a3b22] text-xs font-bold text-white">
            AU
          </span>
          <span className="hidden sm:inline">Admin User</span>
          <ChevronDown className="size-4 text-foreground/45" />
        </button>
      </div>
    </header>
  );
}

function MetricCard({ metric }: { metric: BlogMetric }) {
  const Icon = metric.icon;

  return (
    <div className="rounded-sm border border-border bg-white p-4 shadow-sm shadow-stone-200/40">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-full",
            metric.tone
          )}
        >
          <Icon className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground/60">
            {metric.label}
          </p>
          <p className="mt-1 text-2xl font-bold leading-none text-foreground">
            {metric.value}
          </p>
          <p className={cn("mt-2 text-[11px] font-semibold", metric.trendClassName)}>
            {metric.trend}
          </p>
        </div>
      </div>
    </div>
  );
}

function BlogToolbar({
  categoryFilter,
  onCategoryFilterChange,
  onSearchQueryChange,
  onStatusFilterChange,
  searchQuery,
  statusFilter,
}: {
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  onSearchQueryChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  searchQuery: string;
  statusFilter: string;
}) {
  return (
    <div className="grid gap-3 border-b border-border p-4 xl:grid-cols-[minmax(260px,1fr)_180px_190px_120px] xl:items-end">
      <label className="relative min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
        <input
          className="h-10 w-full rounded-sm border border-border bg-white pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-foreground/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
          placeholder="Search blogs by title, author or tag..."
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
        />
      </label>
      <ToolbarSelect
        label="Status"
        options={statusFilterOptions}
        value={statusFilter}
        onValueChange={onStatusFilterChange}
      />
      <ToolbarSelect
        label="Category"
        options={categoryFilterOptions}
        value={categoryFilter}
        onValueChange={onCategoryFilterChange}
      />
      <Button
        type="button"
        variant="outline"
        className="h-10 rounded-sm border-border bg-white px-4 text-xs font-bold"
      >
        <Filter className="size-4" data-icon="inline-start" />
        Filter
      </Button>
    </div>
  );
}

function ToolbarSelect({
  label,
  onValueChange,
  options,
  value,
}: {
  label: string;
  onValueChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-[11px] font-semibold text-foreground/55">
        {label}
      </span>
      <Select
        value={value}
        onValueChange={(nextValue) => {
          if (typeof nextValue === "string") {
            onValueChange(nextValue);
          }
        }}
      >
        <SelectTrigger className="h-10 min-h-10 rounded-sm border-border bg-white px-3 py-2 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function BlogTable({
  blogs,
  isDeletingBlogId,
  isLoading,
  onDelete,
  totalCount,
}: {
  blogs: AdminBlog[];
  isDeletingBlogId: string | null;
  isLoading: boolean;
  onDelete: (blog: AdminBlog) => void;
  totalCount: number;
}) {
  return (
    <>
      <div className="max-w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[34%]" />
            <col className="w-[13%]" />
            <col className="w-[14%]" />
            <col className="w-[12%]" />
            <col className="w-[14%]" />
            <col className="w-[7%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead className="bg-muted/35 text-[11px] uppercase text-foreground/55">
            <tr>
              <th className="px-4 py-3 font-bold">Blog</th>
              <th className="px-4 py-3 font-bold">Category</th>
              <th className="px-4 py-3 font-bold">Author</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold">Published On</th>
              <th className="px-4 py-3 font-bold">Read</th>
              <th className="px-4 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-5 py-8 text-center text-xs text-foreground/55" colSpan={7}>
                  Loading blogs...
                </td>
              </tr>
            ) : null}

            {!isLoading && blogs.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-center text-xs text-foreground/55" colSpan={7}>
                  No blogs added yet.
                </td>
              </tr>
            ) : null}

            {!isLoading
              ? blogs.map((post) => (
                  <tr
                    key={post.id}
                    className="border-t border-border transition-colors hover:bg-muted/25"
                  >
                    <td data-label="Blog" data-mobile-primary className="px-4 py-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-xs font-bold text-foreground">
                          {post.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-foreground/55">
                          {post.slug}
                        </p>
                      </div>
                    </td>
                    <td data-label="Category" className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold",
                          getCategoryClassName(post.category)
                        )}
                      >
                        {post.category}
                      </span>
                    </td>
                    <td data-label="Author" className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#7a3b22] text-[10px] font-bold text-white">
                          {getInitials(post.authorName)}
                        </span>
                        <span className="truncate text-xs font-bold text-foreground">
                          {post.authorName}
                        </span>
                      </div>
                    </td>
                    <td data-label="Status" className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold",
                          getStatusClassName(post.status)
                        )}
                      >
                        {post.status}
                      </span>
                    </td>
                    <td
                      data-label="Published On"
                      className="px-4 py-3 text-xs text-foreground/70"
                    >
                      <span className="block truncate font-semibold">
                        {formatDate(post.publishedAt)}
                      </span>
                      {formatTime(post.publishedAt) ? (
                        <span className="mt-1 block truncate text-foreground/55">
                          {formatTime(post.publishedAt)}
                        </span>
                      ) : null}
                    </td>
                    <td data-label="Read" className="px-4 py-3 text-xs font-semibold text-foreground/70">
                      {post.readTimeMinutes} min
                    </td>
                    <td data-actions data-label="Actions" className="px-4 py-3">
                      <RowActions
                        isDeleting={isDeletingBlogId === post.id}
                        post={post}
                        onDelete={onDelete}
                      />
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      <TableFooter shownCount={blogs.length} totalCount={totalCount} />
    </>
  );
}

function RowActions({
  isDeleting,
  onDelete,
  post,
}: {
  isDeleting: boolean;
  onDelete: (blog: AdminBlog) => void;
  post: AdminBlog;
}) {
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="grid size-10 place-items-center rounded-full border border-border bg-white text-foreground/65 transition-colors hover:border-primary hover:text-primary"
              aria-label={`Open actions for ${post.title}`}
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-36 rounded-sm border border-border bg-white p-1 shadow-lg shadow-stone-200/70"
        >
          <DropdownMenuItem
            render={<Link href={`/blog/view?id=${post.id}`} />}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Eye className="size-4 text-foreground/60" />
            View
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<Link href={`/blog/edit?id=${post.id}`} />}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Pencil className="size-4 text-primary" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(post)}
            variant="destructive"
            disabled={isDeleting}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Trash2 className="size-4" />
            {isDeleting ? "Deleting..." : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TableFooter({
  shownCount,
  totalCount,
}: {
  shownCount: number;
  totalCount: number;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-foreground/55">
        Showing {shownCount ? `1 to ${shownCount}` : "0"} of {totalCount} blogs
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <PaginationButton label="Previous page" disabled>
          <ChevronLeft className="size-4" />
        </PaginationButton>
        <PaginationButton label="Page 1" active>
          1
        </PaginationButton>
        <PaginationButton label="Next page" disabled>
          <ChevronRight className="size-4" />
        </PaginationButton>
      </div>
    </div>
  );
}

function PaginationButton({
  active = false,
  children,
  disabled = false,
  label,
}: {
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "grid size-8 place-items-center rounded-sm border border-border bg-white text-xs font-bold text-foreground/60 transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-45",
        active && "border-primary bg-primary text-white hover:text-white"
      )}
      disabled={disabled}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function getCategoryClassName(category: BlogCategory): string {
  switch (category) {
    case "Heritage":
      return "bg-primary/10 text-primary";
    case "History":
      return "bg-amber-100 text-amber-700";
    case "Art & Culture":
      return "bg-violet-100 text-violet-700";
    case "Travel Guide":
      return "bg-sky-100 text-sky-700";
    case "Destinations":
      return "bg-emerald-100 text-emerald-700";
    case "Travel Tips":
      return "bg-orange-100 text-orange-700";
    case "Uncategorized":
      return "bg-stone-200 text-foreground/65";
  }
}

function getStatusClassName(status: BlogStatus): string {
  switch (status) {
    case "Published":
      return "bg-emerald-100 text-emerald-700";
    case "Draft":
      return "bg-amber-100 text-amber-700";
    case "Archived":
      return "bg-stone-200 text-foreground/65";
  }
}
