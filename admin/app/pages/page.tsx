"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
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
  Link2,
  MoreHorizontal,
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

type PageMetric = {
  label: string;
  value: string;
  trend: string;
  trendClassName: string;
  icon: LucideIcon;
  tone: string;
};

type AdminPageRecord = {
  description: string;
  editorHref?: string;
  slug: string;
  status: "Published" | "Draft";
  thumbnailTone: string;
  title: string;
  type: "Main Page" | "Feature Page" | "Utility Page";
  updatedBy: string;
  updatedDate: string;
  updatedTime: string;
};

const pageTabs = [
  "All Pages",
  "Main Pages",
  "Feature Pages",
  "Legal Pages",
  "Utility Pages",
];

const pageMetrics: PageMetric[] = [
  {
    label: "Total Pages",
    value: "15",
    trend: "All website pages",
    trendClassName: "text-foreground/60",
    icon: FileText,
    tone: "bg-primary/10 text-primary",
  },
  {
    label: "Published Pages",
    value: "12",
    trend: "Live on website",
    trendClassName: "text-emerald-600",
    icon: FileCheck2,
    tone: "bg-emerald-100 text-emerald-700",
  },
  {
    label: "Draft Pages",
    value: "2",
    trend: "Not published",
    trendClassName: "text-primary",
    icon: PencilLine,
    tone: "bg-amber-100 text-amber-700",
  },
  {
    label: "Archived Pages",
    value: "1",
    trend: "Moved to archive",
    trendClassName: "text-violet-600",
    icon: Archive,
    tone: "bg-violet-100 text-violet-700",
  },
];

const pages: AdminPageRecord[] = [
  {
    title: "Home",
    description: "Manage content for homepage hero, sections, features, etc.",
    editorHref: "/pages/home",
    slug: "/",
    status: "Published",
    thumbnailTone: "from-orange-500 via-amber-200 to-stone-800",
    type: "Main Page",
    updatedBy: "Admin User",
    updatedDate: "30-07-2026",
    updatedTime: "10:30 AM",
  },
  {
    title: "About",
    description: "Manage content for about us page, mission, vision, team.",
    editorHref: "/pages/about",
    slug: "/about",
    status: "Published",
    thumbnailTone: "from-emerald-700 via-stone-300 to-stone-800",
    type: "Main Page",
    updatedBy: "Admin User",
    updatedDate: "29-07-2026",
    updatedTime: "09:15 AM",
  },
  {
    title: "Tours",
    description: "Manage content for tours listing and details page.",
    slug: "/tours",
    status: "Published",
    thumbnailTone: "from-sky-700 via-amber-200 to-stone-700",
    type: "Feature Page",
    updatedBy: "Admin User",
    updatedDate: "28-07-2026",
    updatedTime: "08:45 PM",
  },
  {
    title: "Destinations",
    description: "Manage content for destinations listing and details page.",
    slug: "/destinations",
    status: "Published",
    thumbnailTone: "from-primary via-stone-300 to-[#7a3b22]",
    type: "Feature Page",
    updatedBy: "Admin User",
    updatedDate: "28-07-2026",
    updatedTime: "05:20 PM",
  },
  {
    title: "Experiences",
    description: "Manage content for experiences and travel stories.",
    slug: "/experiences",
    status: "Draft",
    thumbnailTone: "from-teal-700 via-amber-200 to-stone-800",
    type: "Feature Page",
    updatedBy: "Admin User",
    updatedDate: "27-07-2026",
    updatedTime: "11:45 AM",
  },
  {
    title: "Tour Calendar",
    description: "Manage content for tour calendar and schedule.",
    slug: "/tour-calendar",
    status: "Published",
    thumbnailTone: "from-stone-200 via-white to-stone-500",
    type: "Utility Page",
    updatedBy: "Admin User",
    updatedDate: "26-07-2026",
    updatedTime: "04:10 PM",
  },
  {
    title: "Contact Us",
    description: "Manage contact page content and contact details.",
    slug: "/contact-us",
    status: "Published",
    thumbnailTone: "from-stone-200 via-orange-100 to-stone-500",
    type: "Utility Page",
    updatedBy: "Admin User",
    updatedDate: "25-07-2026",
    updatedTime: "02:30 PM",
  },
];

const statusOptions = ["All Status", "Published", "Draft"];
const typeOptions = ["All Types", "Main Page", "Feature Page", "Utility Page"];

export default function PagesPage() {
  const toast = useToast();

  return (
    <AdminDashboardShell activeLabel="Pages">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <PagesHeader />

        <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-sm text-foreground/60">
            Manage website pages and their dynamic content.
          </p>
          <Button
            type="button"
            onClick={() => toast.info("Add Page", "Page form will open here.")}
            className="h-11 rounded-sm px-4 text-xs font-bold"
          >
            <Plus className="size-4" data-icon="inline-start" />
            Add New Page
          </Button>
        </section>

        <section
          data-admin-metric-grid
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {pageMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </section>

        <section className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
          <PageTabs />
          <PagesToolbar />
          <PagesTable />
        </section>
      </div>
    </AdminDashboardShell>
  );
}

function PagesHeader() {
  const toast = useToast();

  return (
    <header className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <AdminSidebarToggle />
        <div className="min-w-0">
          <h1 className="font-sans text-2xl font-bold tracking-normal text-foreground">
            Pages
          </h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-foreground/55">
            <span>Dashboard</span>
            <span aria-hidden="true">&gt;</span>
            <span className="font-medium text-foreground/75">Pages</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <HeaderDateRangePicker />
        <button
          onClick={() =>
            toast.info("Notifications", "You have 3 page notifications.")
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

function MetricCard({ metric }: { metric: PageMetric }) {
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

function PageTabs() {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-0 overflow-visible border-b border-border px-4 sm:flex-nowrap sm:overflow-x-auto sm:[-ms-overflow-style:none] sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden">
      {pageTabs.map((tab) => (
        <button
          key={tab}
          type="button"
          className={cn(
            "h-11 shrink-0 border-b-2 px-0 text-xs font-semibold transition-colors",
            tab === "All Pages"
              ? "border-primary text-primary"
              : "border-transparent text-foreground/65 hover:text-primary"
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

function PagesToolbar() {
  return (
    <div className="grid gap-3 border-b border-border p-4 xl:grid-cols-[minmax(260px,1fr)_170px_170px_120px] xl:items-end">
      <label className="relative min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
        <input
          className="h-10 w-full rounded-sm border border-border bg-white pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-foreground/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
          placeholder="Search pages by title or slug..."
          type="search"
        />
      </label>
      <ToolbarSelect label="Status" options={statusOptions} value="All Status" />
      <ToolbarSelect label="Page Type" options={typeOptions} value="All Types" />
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

function PagesTable() {
  return (
    <>
      <div className="max-w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[34%]" />
            <col className="w-[16%]" />
            <col className="w-[16%]" />
            <col className="w-[13%]" />
            <col className="w-[14%]" />
            <col className="w-[7%]" />
          </colgroup>
          <thead className="bg-muted/35 text-[11px] uppercase text-foreground/55">
            <tr>
              <th className="px-4 py-3 font-bold">Page</th>
              <th className="px-4 py-3 font-bold">Page Type</th>
              <th className="px-4 py-3 font-bold">Slug</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold">Last Updated</th>
              <th className="px-4 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr
                key={page.slug}
                className="border-t border-border transition-colors hover:bg-muted/25"
              >
                <td data-label="Page" data-mobile-primary className="px-4 py-3">
                  <div className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-3">
                    <PageThumbnail page={page} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-foreground">
                        {page.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-foreground/55">
                        {page.description}
                      </p>
                    </div>
                  </div>
                </td>
                <td data-label="Page Type" className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold",
                      getTypeClassName(page.type)
                    )}
                  >
                    {page.type}
                  </span>
                </td>
                <td
                  data-label="Slug"
                  className="px-4 py-3 text-xs font-semibold text-foreground/75"
                >
                  <span className="block truncate">{page.slug}</span>
                </td>
                <td data-label="Status" className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold",
                      page.status === "Published"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    )}
                  >
                    {page.status === "Published" ? "+ " : ""}
                    {page.status}
                  </span>
                </td>
                <td
                  data-label="Last Updated"
                  className="px-4 py-3 text-xs text-foreground/70"
                >
                  <span className="block truncate font-semibold">
                    {page.updatedDate}
                  </span>
                  <span className="mt-1 block truncate text-foreground/55">
                    {page.updatedTime}
                  </span>
                  <span className="mt-1 block truncate text-foreground/55">
                    {page.updatedBy}
                  </span>
                </td>
                <td data-actions data-label="Actions" className="px-4 py-3">
                  <RowActions editorHref={page.editorHref} itemName={page.title} />
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

function PageThumbnail({ page }: { page: AdminPageRecord }) {
  return (
    <div
      className={cn(
        "relative h-14 w-20 overflow-hidden rounded-sm bg-gradient-to-br",
        page.thumbnailTone
      )}
    >
      <Image
        src="/admin-login/heritage-login-bg.png"
        alt={page.title}
        fill
        sizes="80px"
        className="object-cover opacity-70 mix-blend-multiply"
      />
      <span className="absolute bottom-1 left-1 h-2 w-8 rounded-full bg-white/70" />
      <span className="absolute bottom-3 left-3 h-5 w-5 rounded-sm border border-white/70 bg-white/30" />
    </div>
  );
}

function RowActions({
  editorHref,
  itemName,
}: {
  editorHref?: string;
  itemName: string;
}) {
  const toast = useToast();

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="grid size-10 place-items-center rounded-full border border-border bg-white text-foreground/65 transition-colors hover:border-primary hover:text-primary"
              aria-label={`Open actions for ${itemName}`}
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-40 rounded-sm border border-border bg-white p-1 shadow-lg shadow-stone-200/70"
        >
          <DropdownMenuItem
            onClick={() => toast.info("Preview", `${itemName} preview will open.`)}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Eye className="size-4 text-foreground/60" />
            Preview
          </DropdownMenuItem>
          {editorHref ? (
            <DropdownMenuItem
              render={
                <Link
                  href={editorHref}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-xs font-semibold"
                />
              }
            >
              <PencilLine className="size-4 text-primary" />
              Edit Content
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onClick={() => toast.info("Open Page", `${itemName} link is ready.`)}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Link2 className="size-4 text-primary" />
            Open Page
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => toast.info("Page Actions", `${itemName} menu is ready.`)}
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
      <p className="text-xs text-foreground/55">Showing 1 to 7 of 15 pages</p>
      <div className="flex flex-wrap items-center gap-2">
        <PaginationButton label="First page" disabled>
          <span className="text-sm leading-none">&lt;&lt;</span>
        </PaginationButton>
        <PaginationButton label="Previous page" disabled>
          <ChevronLeft className="size-4" />
        </PaginationButton>
        {[1, 2, 3].map((page) => (
          <PaginationButton key={page} label={`Page ${page}`} active={page === 1}>
            {page}
          </PaginationButton>
        ))}
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

function getTypeClassName(type: AdminPageRecord["type"]): string {
  switch (type) {
    case "Main Page":
      return "bg-sky-100 text-sky-700";
    case "Feature Page":
      return "bg-emerald-100 text-emerald-700";
    case "Utility Page":
      return "bg-violet-100 text-violet-700";
  }
}
