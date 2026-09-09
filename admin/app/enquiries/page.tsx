"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Search,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import {
  AdminDashboardShell,
  AdminSidebarToggle,
} from "@/components/admin-dashboard/admin-dashboard-shell";
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
import { shouldOpenTableRow } from "@/lib/table-row-click";
import { cn } from "@/lib/utils";
import {
  createAdminEnquiry,
  listAdminEnquiries,
  updateAdminEnquiry,
  type EnquiryPayload,
} from "@/lib/enquiries";

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
  createdAt: string;
};

const statusOptions = ["All Status", "New", "In Progress", "Replied", "Closed"];
const sourceOptions = [
  "All Sources",
  "Website",
  "Contact Form",
  "Email",
  "Phone Call",
];
const dateRangeOptions = ["All Time", "Today", "This Week", "This Month"];

function createEmptyEnquiry(): EnquiryPayload {
  return {
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
    source: "Website",
    status: "New",
  };
}

function toEnquiryRecord(enquiry: import("@/lib/enquiries").AdminEnquiry): EnquiryRecord {
  const createdAt = new Date(enquiry.createdAt);

  return {
    ...enquiry,
    initials: enquiry.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    avatarTone: "bg-primary",
    date: createdAt.toLocaleDateString("en-GB"),
    time: createdAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    createdAt: createdAt.toISOString(),
  };
}

export default function EnquiriesPage() {
  const toast = useToast();
  const [enquiries, setEnquiries] = useState<EnquiryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState<EnquiryRecord | null>(null);
  const [form, setForm] = useState<EnquiryPayload>(createEmptyEnquiry());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [selectedSource, setSelectedSource] = useState("All Sources");
  const [selectedDateRange, setSelectedDateRange] = useState("All Time");

  async function loadEnquiries() {
    try {
      const response = await listAdminEnquiries();
      setEnquiries(response.data.enquiries.map(toEnquiryRecord));
    } catch (error) {
      toast.error("Unable to load enquiries", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void listAdminEnquiries()
      .then((response) => setEnquiries(response.data.enquiries.map(toEnquiryRecord)))
      .catch((error: unknown) => {
        toast.error("Unable to load enquiries", error instanceof Error ? error.message : "Please try again.");
      })
      .finally(() => setIsLoading(false));
  }, [toast]);

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
  }, [enquiries, searchQuery, selectedSource, selectedStatus]);

  const enquiryMetrics: EnquiryMetric[] = [
    ["Total Enquiries", enquiries.length, MessageCircle, "bg-primary/10 text-primary"],
    ["New Enquiries", enquiries.filter((item) => item.status === "New").length, Mail, "bg-emerald-100 text-emerald-700"],
    ["In Progress", enquiries.filter((item) => item.status === "In Progress").length, Clock3, "bg-amber-100 text-amber-700"],
    ["Replied", enquiries.filter((item) => item.status === "Replied").length, CheckCircle2, "bg-violet-100 text-violet-700"],
    ["Closed", enquiries.filter((item) => item.status === "Closed").length, XCircle, "bg-red-100 text-red-700"],
  ].map(([label, value, icon, tone]) => ({
    label: String(label),
    value: String(value),
    trend: "",
    trendClassName: "",
    icon: icon as LucideIcon,
    tone: String(tone),
  }));

  function openAddForm() {
    setEditingEnquiry(null);
    setForm(createEmptyEnquiry());
    setIsFormOpen(true);
  }

  function openEditForm(enquiry: EnquiryRecord) {
    setEditingEnquiry(enquiry);
    setForm({
      name: enquiry.name,
      email: enquiry.email,
      phone: enquiry.phone,
      subject: enquiry.subject,
      message: enquiry.message,
      source: enquiry.source,
      status: enquiry.status,
    });
    setIsFormOpen(true);
  }

  async function saveEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (editingEnquiry) {
        await updateAdminEnquiry(editingEnquiry.id, form);
      } else {
        await createAdminEnquiry(form);
      }
      setIsFormOpen(false);
      await loadEnquiries();
      toast.success("Enquiry saved", "The enquiry was saved successfully.");
    } catch (error) {
      toast.error("Unable to save enquiry", error instanceof Error ? error.message : "Please try again.");
    }
  }

  function exportEnquiries() {
    const header = ["Name", "Email", "Phone", "Subject", "Source", "Status", "Date"];
    const rows = filteredEnquiries.map((item) => [item.name, item.email, item.phone, item.subject, item.source, item.status, item.createdAt]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "enquiries.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminDashboardShell activeLabel="Enquiries">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <EnquiriesHeader onAdd={openAddForm} />

        <div className="flex flex-wrap justify-end gap-3">
          <Button
            type="button"
            onClick={openAddForm}
            className="h-11 rounded-sm px-4 text-xs font-bold"
          >
            <Plus className="size-4" data-icon="inline-start" />
            Add Enquiries
          </Button>

          <Button
            type="button"
            onClick={exportEnquiries}
            className="h-11 rounded-sm px-4 text-xs font-bold"
          >
            <span>Export Enquiries</span>
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
          <EnquiriesTable enquiries={filteredEnquiries} isLoading={isLoading} onEdit={openEditForm} />
        </section>
      </div>
      {isFormOpen ? <EnquiryForm editing={Boolean(editingEnquiry)} form={form} onChange={setForm} onClose={() => setIsFormOpen(false)} onSubmit={saveEnquiry} /> : null}
    </AdminDashboardShell>
  );
}

function EnquiriesHeader({ onAdd }: { onAdd: () => void }) {
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
        <Button type="button" onClick={onAdd} className="h-10 rounded-sm px-3 text-xs font-bold">
          <Plus className="size-4" data-icon="inline-start" />
          Add Enquiry
        </Button>
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

function EnquiriesTable({
  enquiries,
  isLoading,
  onEdit,
}: {
  enquiries: EnquiryRecord[];
  isLoading: boolean;
  onEdit: (enquiry: EnquiryRecord) => void;
}) {
  const toast = useToast();

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
            {isLoading ? (
              <tr>
                <td className="px-5 py-8 text-center text-xs text-foreground/55" colSpan={7}>
                  Loading enquiries...
                </td>
              </tr>
            ) : enquiries.length ? (
              enquiries.map((enquiry) => (
                <tr
                  key={enquiry.id}
                  onClick={(event) => {
                    if (shouldOpenTableRow(event)) {
                      toast.info(enquiry.subject, enquiry.message);
                    }
                  }}
                  className="cursor-pointer border-t border-border transition-colors hover:bg-muted/25"
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
                    <EnquiryActions enquiry={enquiry} onEdit={onEdit} />
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
          Showing {enquiries.length ? `1 to ${enquiries.length}` : "0"} of {enquiries.length}
          enquiries
        </p>
        <div className="flex items-center gap-2">
          <PaginationButton label="Previous page" disabled>
            <ChevronLeft className="size-4" />
          </PaginationButton>
          <PaginationButton label="Page 1" active disabled>1</PaginationButton>
          <PaginationButton label="Next page" disabled>
            <ChevronRight className="size-4" />
          </PaginationButton>
        </div>
      </div>
    </>
  );
}

function EnquiryActions({
  enquiry,
  onEdit,
}: {
  enquiry: EnquiryRecord;
  onEdit: (enquiry: EnquiryRecord) => void;
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
            onClick={() => onEdit(enquiry)}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Pencil className="size-4 text-foreground/60" />
            Edit
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

function EnquiryForm({
  editing,
  form,
  onChange,
  onClose,
  onSubmit,
}: {
  editing: boolean;
  form: EnquiryPayload;
  onChange: (form: EnquiryPayload) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const update = (field: keyof EnquiryPayload, value: string) => {
    onChange({ ...form, [field]: value } as EnquiryPayload);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <form onSubmit={onSubmit} className="grid w-full max-w-2xl gap-4 rounded-sm border border-border bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-lg font-bold">{editing ? "Edit Enquiry" : "Add Enquiry"}</h2>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-foreground/55 hover:text-foreground">Close</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["name", "email", "phone", "subject"] as const).map((field) => (
            <label key={field} className="grid gap-1.5 text-xs font-semibold capitalize">
              {field}
              <input required value={form[field]} onChange={(event) => update(field, event.target.value)} className="h-10 rounded-sm border border-border px-3 outline-none focus:border-primary" />
            </label>
          ))}
          <label className="grid gap-1.5 text-xs font-semibold">
            Source
            <select value={form.source} onChange={(event) => update("source", event.target.value)} className="h-10 rounded-sm border border-border px-3">
              {sourceOptions.slice(1).map((source) => <option key={source}>{source}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold">
            Status
            <select value={form.status} onChange={(event) => update("status", event.target.value)} className="h-10 rounded-sm border border-border px-3">
              {statusOptions.slice(1).map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold sm:col-span-2">
            Message
            <textarea value={form.message} onChange={(event) => update("message", event.target.value)} className="min-h-24 rounded-sm border border-border px-3 py-2 outline-none focus:border-primary" />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit"><Save className="size-4" data-icon="inline-start" />Save Enquiry</Button>
        </div>
      </form>
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
