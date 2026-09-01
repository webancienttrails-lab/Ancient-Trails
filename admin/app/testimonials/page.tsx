"use client";

import type { ReactNode } from "react";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Image as ImageIcon,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Quote,
  Search,
  Star,
  Trash2,
  Type,
  Video,
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
import { cn } from "@/lib/utils";

type TestimonialMetric = {
  label: string;
  value: string;
  trend: string;
  icon: LucideIcon;
  tone: string;
};

type TestimonialRecord = {
  id: string;
  content: string;
  customer: {
    avatarTone: string;
    email: string;
    initials: string;
    name: string;
  };
  date: string;
  imageLabel?: string;
  linkedTo: "Tour" | "Destination";
  media: "Text" | "Image" | "Video";
  mediaTone: string;
  rating: number;
  referenceId: string;
  referenceName: string;
  status: "Published" | "Pending";
  time: string;
};

const metrics: TestimonialMetric[] = [
  {
    label: "Total Testimonials",
    value: "56",
    trend: "+12.5% from Jun 2026",
    icon: MessageCircle,
    tone: "bg-primary/10 text-primary",
  },
  {
    label: "Text Testimonials",
    value: "24",
    trend: "+42.9% of total",
    icon: Type,
    tone: "bg-emerald-100 text-emerald-700",
  },
  {
    label: "Image Testimonials",
    value: "20",
    trend: "+35.7% of total",
    icon: ImageIcon,
    tone: "bg-amber-100 text-amber-700",
  },
  {
    label: "Video Testimonials",
    value: "12",
    trend: "+21.4% of total",
    icon: Video,
    tone: "bg-violet-100 text-violet-700",
  },
  {
    label: "Linked to",
    value: "",
    trend: "",
    icon: Link2,
    tone: "bg-sky-100 text-sky-700",
  },
];

const testimonials: TestimonialRecord[] = [
  {
    id: "TST001",
    content:
      "Our tour to Hampi was absolutely incredible! Ancient Trails arranged everything...",
    customer: {
      name: "Rahul Sharma",
      email: "rahul.sharma@gmail.com",
      initials: "RS",
      avatarTone: "bg-[#7a3b22]",
    },
    date: "30-07-2026",
    imageLabel: "Hampi",
    linkedTo: "Tour",
    media: "Image",
    mediaTone: "bg-amber-100 text-amber-700",
    rating: 5,
    referenceId: "TOUR001",
    referenceName: "Hampi Heritage Trail",
    status: "Published",
    time: "10:30 AM",
  },
  {
    id: "TST002",
    content:
      "Excellent service and well planned itinerary. The guides were knowledgeable and...",
    customer: {
      name: "Priya Mehta",
      email: "priya.mehta@gmail.com",
      initials: "PM",
      avatarTone: "bg-primary",
    },
    date: "29-07-2026",
    linkedTo: "Destination",
    media: "Text",
    mediaTone: "bg-emerald-100 text-emerald-700",
    rating: 4,
    referenceId: "DSI008",
    referenceName: "Badami",
    status: "Published",
    time: "09:15 AM",
  },
  {
    id: "TST003",
    content:
      "A memorable experience exploring the rich heritage of Pattadakal. Highly...",
    customer: {
      name: "Arjun Verma",
      email: "arjun.verma@gmail.com",
      initials: "AV",
      avatarTone: "bg-emerald-700",
    },
    date: "28-07-2026",
    imageLabel: "02:45",
    linkedTo: "Tour",
    media: "Video",
    mediaTone: "bg-violet-100 text-violet-700",
    rating: 5,
    referenceId: "TOUR003",
    referenceName: "Pattadakal Explorer",
    status: "Published",
    time: "08:45 PM",
  },
  {
    id: "TST004",
    content:
      "The Aihole and Badami tour was perfectly organized. Great team and amazing...",
    customer: {
      name: "Sneha Iyer",
      email: "sneha.iyer@gmail.com",
      initials: "SI",
      avatarTone: "bg-violet-600",
    },
    date: "27-07-2026",
    imageLabel: "Aihole",
    linkedTo: "Destination",
    media: "Image",
    mediaTone: "bg-amber-100 text-amber-700",
    rating: 4,
    referenceId: "DSI003",
    referenceName: "Aihole",
    status: "Pending",
    time: "05:30 PM",
  },
  {
    id: "TST005",
    content:
      "Wonderful heritage walk through Bijapur. The history and stories shared were...",
    customer: {
      name: "Karan Patel",
      email: "karan.patel@gmail.com",
      initials: "KP",
      avatarTone: "bg-sky-700",
    },
    date: "26-07-2026",
    linkedTo: "Destination",
    media: "Text",
    mediaTone: "bg-emerald-100 text-emerald-700",
    rating: 5,
    referenceId: "DSI012",
    referenceName: "Bijapur",
    status: "Published",
    time: "11:20 AM",
  },
];

const typeOptions = ["All Types", "Text", "Image", "Video"];
const statusOptions = ["All Status", "Published", "Pending"];
const linkedOptions = ["All", "Tour", "Destination"];
const referenceOptions = ["All", "Tour", "Destination"];

export default function TestimonialsPage() {
  const toast = useToast();

  return (
    <AdminDashboardShell activeLabel="Testimonial">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <TestimonialsHeader />

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() =>
              toast.info("Add Testimonial", "Testimonial form will open here.")
            }
            className="h-11 rounded-sm px-4 text-xs font-bold"
          >
            <Plus className="size-4" data-icon="inline-start" />
            Add New Testimonial
          </Button>
        </div>

        <section
          data-admin-metric-grid
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
        >
          {metrics.map((metric) =>
            metric.label === "Linked to" ? (
              <LinkedMetricCard key={metric.label} metric={metric} />
            ) : (
              <MetricCard key={metric.label} metric={metric} />
            )
          )}
        </section>

        <section className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
          <TestimonialsToolbar />
          <TestimonialsTable />
        </section>
      </div>
    </AdminDashboardShell>
  );
}

function TestimonialsHeader() {
  const toast = useToast();

  return (
    <header className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <AdminSidebarToggle />
        <div className="min-w-0">
          <h1 className="font-sans text-2xl font-bold tracking-normal text-foreground">
            Testimonials
          </h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-foreground/55">
            <span>Dashboard</span>
            <span aria-hidden="true">&gt;</span>
            <span className="font-medium text-foreground/75">
              Testimonials
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <HeaderDateRangePicker />
        <button
          onClick={() =>
            toast.info("Notifications", "You have 3 testimonial notifications.")
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

function MetricCard({ metric }: { metric: TestimonialMetric }) {
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
          <p className="mt-2 text-[11px] font-semibold text-emerald-600">
            {metric.trend}
          </p>
        </div>
      </div>
    </div>
  );
}

function LinkedMetricCard({ metric }: { metric: TestimonialMetric }) {
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
        <div className="min-w-0 space-y-1.5">
          <p className="truncate text-xs font-medium text-foreground/60">
            Linked to
          </p>
          <p className="text-xs font-bold text-foreground">Tour (34)</p>
          <p className="text-xs font-bold text-foreground">Destination (22)</p>
        </div>
      </div>
    </div>
  );
}

function TestimonialsToolbar() {
  return (
    <div className="grid gap-3 border-b border-border p-4 xl:grid-cols-[minmax(230px,1fr)_150px_150px_150px_150px_120px] xl:items-end">
      <label className="relative min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
        <input
          className="h-10 w-full rounded-sm border border-border bg-white pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-foreground/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
          placeholder="Search testimonials by name, content..."
          type="search"
        />
      </label>
      <ToolbarSelect label="Type" options={typeOptions} value="All Types" />
      <ToolbarSelect label="Status" options={statusOptions} value="All Status" />
      <ToolbarSelect label="Linked To" options={linkedOptions} value="All" />
      <ToolbarSelect
        label="Reference Type"
        options={referenceOptions}
        value="All"
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

function TestimonialsTable() {
  return (
    <>
      <div className="max-w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[21%]" />
            <col className="w-[8%]" />
            <col className="w-[15%]" />
            <col className="w-[11%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[10%]" />
            <col className="w-[7%]" />
          </colgroup>
          <thead className="bg-muted/35 text-[11px] uppercase text-foreground/55">
            <tr>
              <th className="px-4 py-3 font-bold">Testimonial</th>
              <th className="px-4 py-3 font-bold">Type</th>
              <th className="px-4 py-3 font-bold">Customer</th>
              <th className="px-4 py-3 font-bold">Linked To</th>
              <th className="px-4 py-3 font-bold">Reference ID</th>
              <th className="px-4 py-3 font-bold">Rating</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold">Date</th>
              <th className="px-4 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {testimonials.map((testimonial) => (
              <tr
                key={testimonial.id}
                className="border-t border-border transition-colors hover:bg-muted/25"
              >
                <td
                  data-label="Testimonial"
                  data-mobile-primary
                  className="px-4 py-4"
                >
                  <p className="line-clamp-3 text-xs font-medium leading-relaxed text-foreground">
                    {testimonial.content}
                  </p>
                </td>
                <td data-label="Type" className="px-4 py-4">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold",
                      testimonial.mediaTone
                    )}
                  >
                    {getMediaIcon(testimonial.media)}
                    {testimonial.media}
                  </span>
                </td>
                <td data-label="Customer" className="px-4 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white",
                        testimonial.customer.avatarTone
                      )}
                    >
                      {testimonial.customer.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-foreground">
                        {testimonial.customer.name}
                      </p>
                      <p className="mt-1 truncate text-[10px] text-foreground/55">
                        {testimonial.customer.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td data-label="Linked To" className="px-4 py-4">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold",
                      testimonial.linkedTo === "Tour"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-sky-100 text-sky-700"
                    )}
                  >
                    {testimonial.linkedTo}
                  </span>
                  <p className="mt-1 truncate text-[10px] text-foreground/55">
                    {testimonial.referenceName}
                  </p>
                </td>
                <td
                  data-label="Reference ID"
                  className="px-4 py-4 text-xs font-semibold text-foreground/70"
                >
                  {testimonial.referenceId}
                </td>
                <td data-label="Rating" className="px-4 py-4">
                  <Rating value={testimonial.rating} />
                </td>
                <td data-label="Status" className="px-4 py-4">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold",
                      testimonial.status === "Published"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    )}
                  >
                    {testimonial.status}
                  </span>
                </td>
                <td
                  data-label="Date"
                  className="px-4 py-4 text-xs text-foreground/70"
                >
                  <span className="block truncate font-semibold">
                    {testimonial.date}
                  </span>
                  <span className="mt-1 block truncate text-foreground/55">
                    {testimonial.time}
                  </span>
                </td>
                <td data-actions data-label="Actions" className="px-4 py-4">
                  <RowActions itemName={testimonial.customer.name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TableFooter label="testimonials" showing="1 to 10" total="56" />
    </>
  );
}

function Rating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5 text-primary">
      {Array.from({ length: 5 }, (_item, index) => (
        <Star
          key={index}
          className={cn(
            "size-3.5",
            index < value ? "fill-current" : "text-stone-300"
          )}
        />
      ))}
    </div>
  );
}

function RowActions({ itemName }: { itemName: string }) {
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
          className="w-36 rounded-sm border border-border bg-white p-1 shadow-lg shadow-stone-200/70"
        >
          <DropdownMenuItem
            onClick={() => toast.info("View", `${itemName} details will open here.`)}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Eye className="size-4 text-foreground/60" />
            View
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => toast.info("Edit", `${itemName} can be edited here.`)}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Pencil className="size-4 text-primary" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              toast.info("Delete", `${itemName} can be removed from here.`)
            }
            variant="destructive"
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TableFooter({
  label,
  showing,
  total,
}: {
  label: string;
  showing: string;
  total: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-foreground/55">
        Showing {showing} of {total} {label}
      </p>
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
        <PaginationButton label="Page 6">6</PaginationButton>
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

function getMediaIcon(media: TestimonialRecord["media"]) {
  switch (media) {
    case "Text":
      return <Type className="size-3" />;
    case "Image":
      return <ImageIcon className="size-3" />;
    case "Video":
      return <Video className="size-3" />;
  }
}
