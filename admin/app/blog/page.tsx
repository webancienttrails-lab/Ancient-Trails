"use client";

import type { ReactNode } from "react";
import Image from "next/image";
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
import { cn } from "@/lib/utils";

type BlogMetric = {
  label: string;
  value: string;
  trend: string;
  trendClassName: string;
  icon: LucideIcon;
  tone: string;
};

type BlogPost = {
  author: {
    avatarTone: string;
    initials: string;
    name: string;
  };
  category: "Heritage" | "Destination" | "Travel Guide" | "Culture";
  description: string;
  publishedDate: string;
  publishedTime: string;
  status: "Published" | "Draft" | "Archived";
  thumbnailTone: string;
  title: string;
};

const blogMetrics: BlogMetric[] = [
  {
    label: "Total Blogs",
    value: "48",
    trend: "All blog posts",
    trendClassName: "text-foreground/60",
    icon: FileText,
    tone: "bg-primary/10 text-primary",
  },
  {
    label: "Published Blogs",
    value: "40",
    trend: "83.33% of total",
    trendClassName: "text-emerald-600",
    icon: FileCheck2,
    tone: "bg-emerald-100 text-emerald-700",
  },
  {
    label: "Draft Blogs",
    value: "6",
    trend: "12.5% of total",
    trendClassName: "text-primary",
    icon: PencilLine,
    tone: "bg-amber-100 text-amber-700",
  },
  {
    label: "Archived Blogs",
    value: "2",
    trend: "4.17% of total",
    trendClassName: "text-violet-600",
    icon: Archive,
    tone: "bg-violet-100 text-violet-700",
  },
];

const blogPosts: BlogPost[] = [
  {
    title: "Exploring the Timeless Caves of Badami",
    description: "Discover the rich history and stunning architecture of Badami...",
    category: "Heritage",
    author: {
      name: "Rahul Sharma",
      initials: "RS",
      avatarTone: "bg-[#7a3b22]",
    },
    status: "Published",
    publishedDate: "30-07-2026",
    publishedTime: "10:30 AM",
    thumbnailTone: "from-primary via-amber-200 to-[#7a3b22]",
  },
  {
    title: "Hampi: Where History Comes to Life",
    description: "A journey through the magnificent ruins and stories of Hampi...",
    category: "Destination",
    author: {
      name: "Priya Mehta",
      initials: "PM",
      avatarTone: "bg-primary",
    },
    status: "Published",
    publishedDate: "29-07-2026",
    publishedTime: "09:15 AM",
    thumbnailTone: "from-emerald-700 via-stone-300 to-stone-800",
  },
  {
    title: "Top 10 Ancient Stepwells in India",
    description: "Step back in time as we explore the most beautiful stepwells...",
    category: "Heritage",
    author: {
      name: "Arjun Verma",
      initials: "AV",
      avatarTone: "bg-[#7a3b22]",
    },
    status: "Draft",
    publishedDate: "-",
    publishedTime: "",
    thumbnailTone: "from-green-700 via-sky-200 to-stone-700",
  },
  {
    title: "A Guide to Rajasthan's Hidden Forts",
    description: "Offbeat forts that hold incredible stories and breathtaking views...",
    category: "Travel Guide",
    author: {
      name: "Sneha Iyer",
      initials: "SI",
      avatarTone: "bg-violet-700",
    },
    status: "Published",
    publishedDate: "27-07-2026",
    publishedTime: "05:30 PM",
    thumbnailTone: "from-orange-500 via-amber-200 to-stone-900",
  },
  {
    title: "Festivals That Bring India's Heritage Alive",
    description: "Celebrate the vibrant festivals that reflect our rich cultural legacy...",
    category: "Culture",
    author: {
      name: "Karan Patel",
      initials: "KP",
      avatarTone: "bg-[#7a3b22]",
    },
    status: "Published",
    publishedDate: "26-07-2026",
    publishedTime: "11:20 AM",
    thumbnailTone: "from-red-600 via-amber-300 to-stone-800",
  },
  {
    title: "The Architectural Marvels of Konark Sun Temple",
    description: "Unveiling the brilliance and precision of ancient Indian...",
    category: "Heritage",
    author: {
      name: "Rahul Sharma",
      initials: "RS",
      avatarTone: "bg-[#7a3b22]",
    },
    status: "Archived",
    publishedDate: "20-07-2026",
    publishedTime: "02:45 PM",
    thumbnailTone: "from-[#7a3b22] via-stone-300 to-amber-800",
  },
];

const statusOptions = ["All Status", "Published", "Draft", "Archived"];
const categoryOptions = [
  "All Categories",
  "Heritage",
  "Destination",
  "Travel Guide",
  "Culture",
];
const authorOptions = [
  "All Authors",
  "Rahul Sharma",
  "Priya Mehta",
  "Arjun Verma",
  "Sneha Iyer",
  "Karan Patel",
];

export default function BlogPage() {
  const toast = useToast();

  return (
    <AdminDashboardShell activeLabel="Blog">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <BlogHeader />

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() =>
              toast.info("Add Blog", "Blog editor will open here.")
            }
            className="h-11 rounded-sm px-4 text-xs font-bold"
          >
            <Plus className="size-4" data-icon="inline-start" />
            Add New Blog
          </Button>
        </div>

        <section
          data-admin-metric-grid
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {blogMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </section>

        <section className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
          <BlogToolbar />
          <BlogTable />
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

function BlogToolbar() {
  return (
    <div className="grid gap-3 border-b border-border p-4 xl:grid-cols-[minmax(260px,1fr)_170px_170px_170px_120px] xl:items-end">
      <label className="relative min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
        <input
          className="h-10 w-full rounded-sm border border-border bg-white pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-foreground/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
          placeholder="Search blogs by title, author or tag..."
          type="search"
        />
      </label>
      <ToolbarSelect label="Status" options={statusOptions} value="All Status" />
      <ToolbarSelect
        label="Category"
        options={categoryOptions}
        value="All Categories"
      />
      <ToolbarSelect label="Author" options={authorOptions} value="All Authors" />
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
  options,
  value,
}: {
  label: string;
  options: string[];
  value: string;
}) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-[11px] font-semibold text-foreground/55">
        {label}
      </span>
      <Select value={value}>
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

function BlogTable() {
  return (
    <>
      <div className="max-w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[36%]" />
            <col className="w-[13%]" />
            <col className="w-[17%]" />
            <col className="w-[13%]" />
            <col className="w-[14%]" />
            <col className="w-[7%]" />
          </colgroup>
          <thead className="bg-muted/35 text-[11px] uppercase text-foreground/55">
            <tr>
              <th className="px-4 py-3 font-bold">Blog</th>
              <th className="px-4 py-3 font-bold">Category</th>
              <th className="px-4 py-3 font-bold">Author</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold">Published On</th>
              <th className="px-4 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {blogPosts.map((post) => (
              <tr
                key={post.title}
                className="border-t border-border transition-colors hover:bg-muted/25"
              >
                <td data-label="Blog" data-mobile-primary className="px-4 py-3">
                  <div className="grid grid-cols-[82px_minmax(0,1fr)] items-center gap-3">
                    <BlogThumbnail post={post} />
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-xs font-bold text-foreground">
                        {post.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-foreground/55">
                        {post.description}
                      </p>
                    </div>
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
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white",
                        post.author.avatarTone
                      )}
                    >
                      {post.author.initials}
                    </span>
                    <span className="truncate text-xs font-bold text-foreground">
                      {post.author.name}
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
                    {post.status === "Published" ? "+ " : ""}
                    {post.status}
                  </span>
                </td>
                <td
                  data-label="Published On"
                  className="px-4 py-3 text-xs text-foreground/70"
                >
                  <span className="block truncate font-semibold">
                    {post.publishedDate}
                  </span>
                  {post.publishedTime ? (
                    <span className="mt-1 block truncate text-foreground/55">
                      {post.publishedTime}
                    </span>
                  ) : null}
                </td>
                <td data-actions data-label="Actions" className="px-4 py-3">
                  <RowActions post={post} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TableFooter />
    </>
  );
}

function BlogThumbnail({ post }: { post: BlogPost }) {
  return (
    <div
      className={cn(
        "relative h-14 w-[82px] overflow-hidden rounded-sm bg-gradient-to-br",
        post.thumbnailTone
      )}
    >
      <Image
        src="/admin-login/heritage-login-bg.png"
        alt={post.title}
        fill
        sizes="82px"
        className="object-cover opacity-70 mix-blend-multiply"
      />
      <span className="absolute bottom-1 left-1 h-2 w-8 rounded-full bg-white/70" />
      <span className="absolute bottom-3 left-3 h-5 w-5 rounded-sm border border-white/70 bg-white/30" />
    </div>
  );
}

function RowActions({ post }: { post: BlogPost }) {
  const toast = useToast();
  const canPreview = post.status !== "Draft";

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
          className="w-40 rounded-sm border border-border bg-white p-1 shadow-lg shadow-stone-200/70"
        >
          {canPreview ? (
            <DropdownMenuItem
              onClick={() => toast.info("Preview Blog", `${post.title} preview.`)}
              className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
            >
              <Eye className="size-4 text-foreground/60" />
              Preview
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onClick={() => toast.info("Edit Blog", `${post.title} editor.`)}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Pencil className="size-4 text-primary" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => toast.info("Blog Actions", `${post.title} menu.`)}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <MoreHorizontal className="size-4 text-foreground/60" />
            More Actions
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TableFooter() {
  return (
    <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-foreground/55">Showing 1 to 10 of 48 blogs</p>
      <div className="flex flex-wrap items-center gap-2">
        <PaginationButton label="First page" disabled>
          <span className="text-sm leading-none">&lt;&lt;</span>
        </PaginationButton>
        <PaginationButton label="Previous page" disabled>
          <ChevronLeft className="size-4" />
        </PaginationButton>
        {[1, 2, 3, 4, 5].map((page) => (
          <PaginationButton key={page} label={`Page ${page}`} active={page === 1}>
            {page}
          </PaginationButton>
        ))}
        <PaginationButton label="More pages">
          <span className="text-xs leading-none">...</span>
        </PaginationButton>
        <PaginationButton label="Next page">
          <ChevronRight className="size-4" />
        </PaginationButton>
        <PaginationButton label="Last page">
          <span className="text-sm leading-none">&gt;&gt;</span>
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

function getCategoryClassName(category: BlogPost["category"]): string {
  switch (category) {
    case "Heritage":
      return "bg-primary/10 text-primary";
    case "Destination":
      return "bg-emerald-100 text-emerald-700";
    case "Travel Guide":
      return "bg-sky-100 text-sky-700";
    case "Culture":
      return "bg-violet-100 text-violet-700";
  }
}

function getStatusClassName(status: BlogPost["status"]): string {
  switch (status) {
    case "Published":
      return "bg-emerald-100 text-emerald-700";
    case "Draft":
      return "bg-amber-100 text-amber-700";
    case "Archived":
      return "bg-stone-200 text-foreground/65";
  }
}
