"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Filter,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  XCircle,
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

type EnquiryMetric = {
  label: string;
  value: string;
  trend: string;
  trendClassName: string;
  icon: LucideIcon;
  tone: string;
};

type EnquiryRecord = {
  id: string;
  initials: string;
  avatarTone: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  source: "Website" | "Contact Form" | "Email" | "Phone Call";
  status: "New" | "In Progress" | "Replied" | "Closed";
  date: string;
  time: string;
};

const enquiryMetrics: EnquiryMetric[] = [
  {
    label: "Total Enquiries",
    value: "289",
    trend: "+12.3% from Jun 2026",
    trendClassName: "text-emerald-600",
    icon: MessageCircle,
    tone: "bg-primary/10 text-primary",
  },
  {
    label: "New Enquiries",
    value: "98",
    trend: "+8.5% from Jun 2026",
    trendClassName: "text-emerald-600",
    icon: Mail,
    tone: "bg-emerald-100 text-emerald-700",
  },
  {
    label: "In Progress",
    value: "121",
    trend: "+10.2% from Jun 2026",
    trendClassName: "text-emerald-600",
    icon: Clock3,
    tone: "bg-amber-100 text-amber-700",
  },
  {
    label: "Replied",
    value: "45",
    trend: "+5.6% from Jun 2026",
    trendClassName: "text-emerald-600",
    icon: CheckCircle2,
    tone: "bg-violet-100 text-violet-700",
  },
  {
    label: "Closed",
    value: "25",
    trend: "-2.1% from Jun 2026",
    trendClassName: "text-red-600",
    icon: XCircle,
    tone: "bg-red-100 text-red-700",
  },
];

const enquiries: EnquiryRecord[] = [
  {
    id: "ENQ289",
    initials: "RS",
    avatarTone: "bg-[#7a3b22]",
    name: "Rahul Sharma",
    email: "rahul.sharma@gmail.com",
    phone: "+91 98765 43210",
    subject: "Custom Tour Package",
    message: "Looking for a 7-day heritage tour across Karnataka.",
    source: "Website",
    status: "In Progress",
    date: "31-07-2026",
    time: "10:30 AM",
  },
  {
    id: "ENQ288",
    initials: "PM",
    avatarTone: "bg-primary",
    name: "Priya Mehta",
    email: "priya.mehta@gmail.com",
    phone: "+91 87654 32109",
    subject: "Group Booking",
    message: "Planning a trip for 15 people.",
    source: "Contact Form",
    status: "New",
    date: "31-07-2026",
    time: "09:15 AM",
  },
  {
    id: "ENQ287",
    initials: "AV",
    avatarTone: "bg-[#7a3b22]",
    name: "Arjun Verma",
    email: "arjun.verma@gmail.com",
    phone: "+91 76543 21098",
    subject: "Hampi Tour Details",
    message: "Need detailed itinerary and price.",
    source: "Website",
    status: "Replied",
    date: "30-07-2026",
    time: "08:45 PM",
  },
  {
    id: "ENQ286",
    initials: "SI",
    avatarTone: "bg-amber-600",
    name: "Sneha Iyer",
    email: "sneha.iyer@gmail.com",
    phone: "+91 65432 10987",
    subject: "Photography Tour",
    message: "Interested in heritage and photography tour.",
    source: "Email",
    status: "In Progress",
    date: "30-07-2026",
    time: "06:20 PM",
  },
  {
    id: "ENQ285",
    initials: "KP",
    avatarTone: "bg-[#7a3b22]",
    name: "Karan Patel",
    email: "karan.patel@gmail.com",
    phone: "+91 54321 09876",
    subject: "General Inquiry",
    message: "Want to know more about Badami tours.",
    source: "Phone Call",
    status: "Closed",
    date: "29-07-2026",
    time: "04:10 PM",
  },
  {
    id: "ENQ284",
    initials: "DN",
    avatarTone: "bg-emerald-700",
    name: "Divya Nair",
    email: "divya.nair@gmail.com",
    phone: "+91 99887 76655",
    subject: "Temple Architecture",
    message: "Need expert-led tour options for South Indian temples.",
    source: "Website",
    status: "New",
    date: "29-07-2026",
    time: "01:25 PM",
  },
  {
    id: "ENQ283",
    initials: "AM",
    avatarTone: "bg-violet-700",
    name: "Amit Mishra",
    email: "amit.mishra@gmail.com",
    phone: "+91 88776 65544",
    subject: "Family Departure",
    message: "Checking child pricing and available departures.",
    source: "Contact Form",
    status: "Replied",
    date: "28-07-2026",
    time: "11:40 AM",
  },
  {
    id: "ENQ282",
    initials: "NT",
    avatarTone: "bg-sky-700",
    name: "Nisha Trivedi",
    email: "nisha.trivedi@gmail.com",
    phone: "+91 77665 54433",
    subject: "Festival Tour",
    message: "Looking for departures around winter heritage festivals.",
    source: "Email",
    status: "In Progress",
    date: "28-07-2026",
    time: "10:05 AM",
  },
  {
    id: "ENQ281",
    initials: "VG",
    avatarTone: "bg-primary",
    name: "Vikram Gupta",
    email: "vikram.gupta@gmail.com",
    phone: "+91 66554 43322",
    subject: "Private Guide",
    message: "Need a private guide for Badami and Aihole.",
    source: "Phone Call",
    status: "Closed",
    date: "27-07-2026",
    time: "06:50 PM",
  },
  {
    id: "ENQ280",
    initials: "MR",
    avatarTone: "bg-[#7a3b22]",
    name: "Meera Rao",
    email: "meera.rao@gmail.com",
    phone: "+91 55443 32211",
    subject: "Senior Citizen Tour",
    message: "Need comfortable pacing and accommodation details.",
    source: "Website",
    status: "New",
    date: "27-07-2026",
    time: "02:15 PM",
  },
];

const statusOptions = ["All Status", "New", "In Progress", "Replied", "Closed"];
const sourceOptions = [
  "All Sources",
  "Website",
  "Contact Form",
  "Email",
  "Phone Call",
];
const dateRangeOptions = ["All Time", "Today", "This Week", "This Month"];

export default function EnquiriesPage() {
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [selectedSource, setSelectedSource] = useState("All Sources");
  const [selectedDateRange, setSelectedDateRange] = useState("All Time");

  const filteredEnquiries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return enquiries.filter((enquiry) => {
      const matchesSearch = query
        ? [
            enquiry.id,
            enquiry.name,
            enquiry.email,
            enquiry.phone,
            enquiry.subject,
            enquiry.message,
            enquiry.source,
            enquiry.status,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)
        : true;
      const matchesStatus =
        selectedStatus === "All Status" || enquiry.status === selectedStatus;
      const matchesSource =
        selectedSource === "All Sources" || enquiry.source === selectedSource;

      return matchesSearch && matchesStatus && matchesSource;
    });
  }, [searchQuery, selectedSource, selectedStatus]);

  return (
    <AdminDashboardShell activeLabel="Enquiries">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <EnquiriesHeader />

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() =>
              toast.info("Export Enquiries", "Enquiry export is ready.")
            }
            className="h-11 rounded-sm px-4 text-xs font-bold"
          >
            <Plus className="size-4" data-icon="inline-start" />
            Export Enquiries
          </Button>
        </div>

        <section
          data-admin-metric-grid
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
        >
          {enquiryMetrics.map((metric) => (
            <EnquiryMetricCard key={metric.label} metric={metric} />
          ))}
        </section>

        <section className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
          <EnquiriesToolbar
            searchQuery={searchQuery}
            selectedDateRange={selectedDateRange}
            selectedSource={selectedSource}
            selectedStatus={selectedStatus}
            onDateRangeChange={setSelectedDateRange}
            onSearchQueryChange={setSearchQuery}
            onSourceChange={setSelectedSource}
            onStatusChange={setSelectedStatus}
          />
          <EnquiriesTable enquiries={filteredEnquiries} />
        </section>
      </div>
    </AdminDashboardShell>
  );
}

function EnquiriesHeader() {
  const toast = useToast();

  return (
    <header className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <AdminSidebarToggle />
        <div className="min-w-0">
          <h1 className="font-sans text-2xl font-bold tracking-normal text-foreground">
            Enquiries
          </h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-foreground/55">
            <span>Dashboard</span>
            <span aria-hidden="true">&gt;</span>
            <span className="font-medium text-foreground/75">Enquiries</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <HeaderDateRangePicker />
        <button
          onClick={() =>
            toast.info("Notifications", "You have 3 enquiry notifications.")
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

function EnquiryMetricCard({ metric }: { metric: EnquiryMetric }) {
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

function EnquiriesToolbar({
  onDateRangeChange,
  onSearchQueryChange,
  onSourceChange,
  onStatusChange,
  searchQuery,
  selectedDateRange,
  selectedSource,
  selectedStatus,
}: {
  onDateRangeChange: (value: string) => void;
  onSearchQueryChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  searchQuery: string;
  selectedDateRange: string;
  selectedSource: string;
  selectedStatus: string;
}) {
  return (
    <div className="grid gap-3 border-b border-border p-4 xl:grid-cols-[minmax(260px,1fr)_160px_170px_170px_120px] xl:items-end">
      <label className="relative min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
        <input
          className="h-11 w-full rounded-sm border border-border bg-white pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-foreground/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
          placeholder="Search by name, email, phone or subject..."
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
        />
      </label>

      <FilterSelect
        label="Status"
        value={selectedStatus}
        options={statusOptions}
        onChange={onStatusChange}
      />
      <FilterSelect
        label="Source"
        value={selectedSource}
        options={sourceOptions}
        onChange={onSourceChange}
      />
      <FilterSelect
        label="Date Range"
        value={selectedDateRange}
        options={dateRangeOptions}
        onChange={onDateRangeChange}
      />

      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-sm border-border bg-white px-4 text-xs font-bold"
      >
        <Filter className="size-4" data-icon="inline-start" />
        Filter
      </Button>
    </div>
  );
}

function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-xs font-medium text-foreground/60">{label}</span>
      <Select
        value={value}
        onValueChange={(nextValue) => onChange(String(nextValue || value))}
      >
        <SelectTrigger className="h-11 min-h-11 rounded-sm border-border bg-white px-3 py-2 text-xs">
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

function EnquiriesTable({ enquiries }: { enquiries: EnquiryRecord[] }) {
  return (
    <>
      <div className="max-w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[11%]" />
            <col className="w-[22%]" />
            <col className="w-[23%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[12%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead className="bg-muted/35 text-[11px] uppercase text-foreground/55">
            <tr>
              <th className="px-4 py-3 font-bold">Enquiry ID</th>
              <th className="px-4 py-3 font-bold">Name &amp; Contact</th>
              <th className="px-4 py-3 font-bold">Subject</th>
              <th className="px-4 py-3 font-bold">Source</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold">Date &amp; Time</th>
              <th className="px-4 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {enquiries.length ? (
              enquiries.map((enquiry) => (
                <tr
                  key={enquiry.id}
                  className="border-t border-border transition-colors hover:bg-muted/25"
                >
                  <td
                    data-label="Enquiry ID"
                    className="px-4 py-4 text-xs font-semibold text-foreground/70"
                  >
                    {enquiry.id}
                  </td>
                  <td
                    data-label="Name & Contact"
                    data-mobile-primary
                    className="px-4 py-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white",
                          enquiry.avatarTone
                        )}
                      >
                        {enquiry.initials}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-foreground">
                          {enquiry.name}
                        </p>
                        <p className="mt-1 truncate text-[11px] text-foreground/55">
                          {enquiry.email}
                        </p>
                        <p className="mt-1 truncate text-[11px] text-foreground/55">
                          {enquiry.phone}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td data-label="Subject" className="px-4 py-4">
                    <p className="truncate text-xs font-bold text-foreground">
                      {enquiry.subject}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-foreground/55">
                      {enquiry.message}
                    </p>
                  </td>
                  <td data-label="Source" className="px-4 py-4">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-3 py-1 text-[11px] font-bold",
                        getSourceClassName(enquiry.source)
                      )}
                    >
                      {enquiry.source}
                    </span>
                  </td>
                  <td data-label="Status" className="px-4 py-4">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-3 py-1 text-[11px] font-bold",
                        getStatusClassName(enquiry.status)
                      )}
                    >
                      {enquiry.status}
                    </span>
                  </td>
                  <td
                    data-label="Date & Time"
                    className="px-4 py-4 text-xs text-foreground/70"
                  >
                    <span className="block truncate font-semibold">
                      {enquiry.date}
                    </span>
                    <span className="mt-1 block truncate text-foreground/55">
                      {enquiry.time}
                    </span>
                  </td>
                  <td data-actions data-label="Actions" className="px-4 py-4">
                    <EnquiryActions enquiry={enquiry} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="px-5 py-8 text-center text-xs text-foreground/55"
                  colSpan={7}
                >
                  No enquiries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-foreground/55">
          Showing {enquiries.length ? `1 to ${enquiries.length}` : "0"} of 289
          enquiries
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
          <PaginationButton label="Page 29">29</PaginationButton>
          <PaginationButton label="Next page">
            <ChevronRight className="size-4" />
          </PaginationButton>
          <PaginationButton label="Last page">
            <span className="text-sm leading-none">&gt;&gt;</span>
          </PaginationButton>
        </div>
      </div>
    </>
  );
}

function EnquiryActions({ enquiry }: { enquiry: EnquiryRecord }) {
  const toast = useToast();

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="grid size-10 place-items-center rounded-full border border-border bg-white text-foreground/65 transition-colors hover:border-primary hover:text-primary"
              aria-label={`Open actions for ${enquiry.id}`}
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
            onClick={() => toast.info(enquiry.subject, enquiry.message)}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Eye className="size-4 text-foreground/60" />
            View
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => toast.info("Reply", `Reply to ${enquiry.name}.`)}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            Reply
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              toast.info("Mark as replied", `${enquiry.id} marked as replied.`)
            }
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            Mark as Replied
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => toast.info("Close", `${enquiry.id} closed.`)}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            Close Enquiry
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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

function getStatusClassName(status: EnquiryRecord["status"]): string {
  switch (status) {
    case "New":
      return "bg-emerald-100 text-emerald-700";
    case "In Progress":
      return "bg-amber-100 text-amber-700";
    case "Replied":
      return "bg-violet-100 text-violet-700";
    case "Closed":
      return "bg-stone-200 text-foreground/65";
  }
}

function getSourceClassName(source: EnquiryRecord["source"]): string {
  switch (source) {
    case "Website":
      return "bg-emerald-100 text-emerald-700";
    case "Contact Form":
      return "bg-sky-100 text-sky-700";
    case "Email":
      return "bg-amber-100 text-amber-700";
    case "Phone Call":
      return "bg-red-100 text-red-700";
  }
}
