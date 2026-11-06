"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Minus,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  XCircle,
  Send,
  Upload,
  ShieldBan,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import {
  AdminDashboardShell,
  AdminSidebarToggle,
} from "@/components/admin-dashboard/admin-dashboard-shell";
import { AdminMobileFilter } from "@/components/admin-dashboard/admin-mobile-filter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  createCustomiseEnquiryPayload,
  listAdminEnquiries,
  updateAdminEnquiry,
  updateAdminEnquiryStatus,
  addAdminEnquiryReply,
  setAdminEnquiryBlacklist,
  getEnquiryCategory,
  getEnquiryTourName,
  getCustomiseEnquiryTourName,
  getEnquiryDisplayDetails,
  type EnquiryCategory,
  type EnquiryPayload,
} from "@/lib/enquiries";
import { listAdminTours, type AdminTour } from "@/lib/tours";
import * as XLSX from "xlsx";
import { GroupEnquiryForm } from "./group-enquiry-form";

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
  enquiryReference: string;
  initials: string;
  avatarTone: string;
  name: string;
  gender: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  tourId?: string;
  tourName?: string;
  replies?: Array<{ message: string; sentAt: string }>;
  isBlacklisted?: boolean;
  blacklistedAt?: string | null;
  socialMediaReferral: string;
  source: "Website" | "Contact Form" | "Email" | "Phone Call";
  status: "New" | "In Progress" | "Replied" | "Closed";
  date: string;
  time: string;
  createdAt: string;
  updatedAt: string;
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
const blacklistOptions = ["All Enquiries", "Active", "Blacklisted"];
const enquiryTabs: Array<{ value: EnquiryCategory; label: string }> = [
  { value: "group", label: "Group Enquiry" },
  { value: "customise", label: "Customise" },
  { value: "normal", label: "Normal Enquiry" },
];

function createEnquiriesCsv(enquiries: EnquiryRecord[]) {
  const header = [
    "Enquiry ID", "Name", "Gender", "Email", "Phone", "Subject", "Message",
    "Source", "Status", "Date", "Time", "Created At", "Updated At", "Social Media Referral",
  ];
  const rows = enquiries.map((item) => [
    item.enquiryReference, item.name, item.gender || "", item.email, item.phone,
    item.subject, item.message, item.source, item.status,
    item.date, item.time, item.createdAt, item.updatedAt, item.socialMediaReferral,
  ]);
  const escapeCell = (value: string) => {
    const text = value || "";
    // Prevent user-entered text from being interpreted as a spreadsheet formula.
    const safeText = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
    return `"${safeText.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + [header, ...rows]
    .map((row) => row.map(escapeCell).join(","))
    .join("\r\n");
}

function createEmptyEnquiry(): EnquiryPayload {
  return {
    name: "",
    gender: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
    tourId: "",
    tourName: "",
    socialMediaReferral: "",
    source: "Website",
    status: "New",
  };
}

function toEnquiryRecord(enquiry: import("@/lib/enquiries").AdminEnquiry): EnquiryRecord {
  const createdAt = new Date(enquiry.createdAt);

  return {
    ...enquiry,
    gender: enquiry.gender || "",
    socialMediaReferral: enquiry.socialMediaReferral || "",
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
  const [selectedCategory, setSelectedCategory] = useState<EnquiryCategory>("group");
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewingEnquiry, setViewingEnquiry] = useState<EnquiryRecord | null>(null);
  const [editingEnquiry, setEditingEnquiry] = useState<EnquiryRecord | null>(null);
  const [form, setForm] = useState<EnquiryPayload>(createEmptyEnquiry());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [selectedSource, setSelectedSource] = useState("All Sources");
  const [selectedDateRange, setSelectedDateRange] = useState("All Time");
  const [selectedBlacklist, setSelectedBlacklist] = useState("All Enquiries");
  const [tours, setTours] = useState<AdminTour[]>([]);
  const [replyingEnquiry, setReplyingEnquiry] = useState<EnquiryRecord | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSavingReply, setIsSavingReply] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    void listAdminTours().then((result) => setTours(result.data.tours)).catch((error: unknown) => {
      toast.error("Unable to load tours", error instanceof Error ? error.message : "Please try again.");
    });
  }, [toast]);

  const categoryEnquiries = useMemo(
    () => enquiries.filter((enquiry) => getEnquiryCategory(enquiry) === selectedCategory),
    [enquiries, selectedCategory],
  );

  const filteredEnquiries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return categoryEnquiries.filter((enquiry) => {
      const matchesSearch = query
        ? [
            enquiry.id,
            enquiry.enquiryReference,
            enquiry.name,
            enquiry.gender,
            enquiry.email,
            enquiry.phone,
            enquiry.subject,
            enquiry.message,
            enquiry.tourName,
            enquiry.source,
            enquiry.socialMediaReferral,
            enquiry.status,
            ...(enquiry.replies || []).map((reply) => reply.message),
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)
        : true;
      const matchesStatus = selectedStatus === "All Status" || enquiry.status === selectedStatus;
      const matchesSource = selectedSource === "All Sources" || enquiry.source === selectedSource;
      const matchesBlacklist = selectedBlacklist === "All Enquiries" ||
        (selectedBlacklist === "Blacklisted" ? enquiry.isBlacklisted : !enquiry.isBlacklisted);
      const createdAt = new Date(enquiry.createdAt);
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const matchesDateRange = selectedDateRange === "All Time" ||
        (createdAt <= now && selectedDateRange === "Today" && createdAt >= startOfToday) ||
        (createdAt <= now && selectedDateRange === "This Week" && createdAt >= startOfWeek) ||
        (createdAt <= now && selectedDateRange === "This Month" && createdAt >= startOfMonth);

      return matchesSearch && matchesStatus && matchesSource && matchesBlacklist && matchesDateRange;
    });
  }, [categoryEnquiries, searchQuery, selectedStatus, selectedSource, selectedDateRange, selectedBlacklist]);

  const enquiryMetrics: EnquiryMetric[] = [
    ["Total Enquiries", categoryEnquiries.length, MessageCircle, "bg-primary/10 text-primary"],
    ["New Enquiries", categoryEnquiries.filter((item) => item.status === "New").length, Mail, "bg-emerald-100 text-emerald-700"],
    ["In Progress", categoryEnquiries.filter((item) => item.status === "In Progress").length, Clock3, "bg-amber-100 text-amber-700"],
    ["Replied", categoryEnquiries.filter((item) => item.status === "Replied").length, CheckCircle2, "bg-violet-100 text-violet-700"],
    ["Closed", categoryEnquiries.filter((item) => item.status === "Closed").length, XCircle, "bg-red-100 text-red-700"],
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
      gender: enquiry.gender || "",
      email: enquiry.email,
      phone: enquiry.phone,
      subject: enquiry.subject,
      message: enquiry.message,
      tourId: enquiry.tourId || "",
      tourName: enquiry.tourName || "",
      socialMediaReferral: enquiry.socialMediaReferral,
      source: enquiry.source,
      status: enquiry.status,
    });
    setIsFormOpen(true);
  }

  async function saveEnquiry(event: FormEvent<HTMLFormElement>, payload: EnquiryPayload = form) {
    event.preventDefault();
    try {
      if (editingEnquiry) {
        await updateAdminEnquiry(editingEnquiry.id, payload);
      } else {
        await createAdminEnquiry(payload);
      }
      setIsFormOpen(false);
      await loadEnquiries();
      toast.success("Enquiry saved", "The enquiry was saved successfully.");
    } catch (error) {
      toast.error("Unable to save enquiry", error instanceof Error ? error.message : "Please try again.");
    }
  }

  async function changeEnquiryStatus(enquiry: EnquiryRecord, status: EnquiryRecord["status"]) {
    try {
      const response = await updateAdminEnquiryStatus(enquiry.id, status);
      const updated = toEnquiryRecord(response.data.enquiry);
      setEnquiries((current) => current.map((item) => item.id === updated.id ? updated : item));
      toast.success("Status updated", `${updated.enquiryReference} is now ${updated.status}.`);
    } catch (error) {
      toast.error("Unable to update status", error instanceof Error ? error.message : "Please try again.");
    }
  }

  async function changeBlacklist(enquiry: EnquiryRecord) {
    try {
      const response = await setAdminEnquiryBlacklist(enquiry.id, !enquiry.isBlacklisted);
      const updated = toEnquiryRecord(response.data.enquiry);
      setEnquiries(current => current.map(item => item.id === updated.id ? updated : item));
      if (viewingEnquiry?.id === updated.id) setViewingEnquiry(updated);
      toast.success(updated.isBlacklisted ? "Enquiry blacklisted" : "Enquiry restored", updated.isBlacklisted ? `${updated.name} has been added to the blacklist.` : `${updated.name} has been removed from the blacklist.`);
    } catch (error) {
      toast.error("Unable to update blacklist", error instanceof Error ? error.message : "Please try again.");
    }
  }

  function exportEnquiries() {
    const csv = createEnquiriesCsv(filteredEnquiries);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "enquiries.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importEnquiries(file: File) {
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
      const normalized = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[^a-z]/g, ""), value]));
      const imported = rows.map(normalized).filter(row => String(row.name || "").trim()).map(row => ({
        ...createEmptyEnquiry(),
        name: String(row.name || "").trim(), email: String(row.email || "").trim(), phone: String(row.phone || "").trim(),
        gender: String(row.gender || "").trim(),
        subject: String(row.subject || row.tourname || "Imported enquiry").trim(), message: String(row.message || "").trim(),
        socialMediaReferral: String(row.socialmediareferral || "").trim(),
        source: sourceOptions.slice(1).includes(String(row.source)) ? String(row.source) as EnquiryPayload["source"] : "Website",
        status: statusOptions.slice(1).includes(String(row.status)) ? String(row.status) as EnquiryPayload["status"] : "New",
        tourName: String(row.tourname || "").trim(), tourId: String(row.tourid || "").trim(),
      }));
      if (!imported.length) throw new Error("No rows with a Name column were found.");
      for (const item of imported) await createAdminEnquiry(item);
      await loadEnquiries();
      toast.success("Import complete", `${imported.length} enquiries imported.`);
    } catch (error) { toast.error("Unable to import enquiries", error instanceof Error ? error.message : "Choose a valid Excel file."); }
  }

  async function sendReply(channel: "whatsapp" | "phone" = "whatsapp") {
    if (!replyingEnquiry || !replyText.trim() || isSavingReply) return;
    const message = channel === "phone" ? `Phone Call:\n${replyText.trim()}` : replyText.trim();
    if (message.length > 3000) {
      toast.error("Notes are too long", "Please shorten your notes before saving.");
      return;
    }
    setIsSavingReply(true);
    try {
      const response = await addAdminEnquiryReply(replyingEnquiry.id, message);
      const updated = toEnquiryRecord(response.data.enquiry);
      setEnquiries(current => current.map(item => item.id === updated.id ? updated : item));
      setViewingEnquiry(current => current?.id === updated.id ? updated : current);
      if (channel === "whatsapp") {
        const phone = replyingEnquiry.phone.replace(/\D/g, "");
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(replyText.trim())}`, "_blank", "noopener,noreferrer");
      }
      setReplyingEnquiry(null); setReplyText("");
      if (channel === "phone") {
        toast.success("Phone call notes saved", "The conversation notes are saved in reply history.");
      } else {
        toast.success("Reply prepared", "The reply is saved in history. Send it in the WhatsApp window to deliver it.");
      }
    } catch (error) { toast.error(channel === "phone" ? "Unable to save call notes" : "Unable to prepare reply", error instanceof Error ? error.message : "Please try again."); }
    finally { setIsSavingReply(false); }
  }

  return (
    <AdminDashboardShell activeLabel="Enquiries">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <EnquiriesHeader onAdd={openAddForm} />

        <Tabs.Root value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as EnquiryCategory)} className="flex flex-col gap-5">
          <Tabs.List aria-label="Enquiry categories" className="flex gap-1 overflow-x-auto border-b border-border">
            {enquiryTabs.map((tab) => (
              <Tabs.Tab key={tab.value} value={tab.value} className="shrink-0 cursor-pointer border-b-2 border-transparent px-4 py-3 text-sm font-bold text-foreground/60 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary data-active:border-primary data-active:text-primary">
                {tab.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          <Tabs.Panel value={selectedCategory} className="flex flex-col gap-5">
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
              <Button type="button" onClick={() => importInput.current?.click()} className="h-11 rounded-sm px-4 text-xs font-bold">
                <Upload className="size-4" data-icon="inline-start" />Import Enquiries
              </Button>
              <input ref={importInput} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void importEnquiries(file); event.currentTarget.value = ""; }} />
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
                selectedBlacklist={selectedBlacklist}
                onDateRangeChange={setSelectedDateRange}
                onSearchQueryChange={setSearchQuery}
                onSourceChange={setSelectedSource}
                onStatusChange={setSelectedStatus}
                onBlacklistChange={setSelectedBlacklist}
              />
              <EnquiriesTable enquiries={filteredEnquiries} showTourName={selectedCategory === "group"} showWhichTour={selectedCategory === "customise"} isLoading={isLoading} onEdit={openEditForm} onView={setViewingEnquiry} onReply={enquiry => { setReplyingEnquiry(enquiry); setReplyText(""); }} onBlacklist={changeBlacklist} onStatusChange={changeEnquiryStatus} />
            </section>
          </Tabs.Panel>
        </Tabs.Root>
      </div>
      <EnquiryView enquiry={viewingEnquiry} onClose={() => setViewingEnquiry(null)} />
      {replyingEnquiry ? (
        <Dialog open onOpenChange={open => { if (!open && !isSavingReply) setReplyingEnquiry(null); }}>
          <DialogContent showCloseButton={!isSavingReply} className="rounded-sm bg-white sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Reply to {replyingEnquiry.name}</DialogTitle>
              <DialogDescription>WhatsApp / Phone: {replyingEnquiry.phone}</DialogDescription>
            </DialogHeader>
            <textarea autoFocus value={replyText} disabled={isSavingReply} maxLength={3000} onChange={event => setReplyText(event.target.value)} className="min-h-32 rounded-sm border border-border p-3 text-sm" placeholder="Write your reply or phone conversation notes..." />
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" disabled={!replyText.trim() || isSavingReply} onClick={() => void sendReply()}><Send className="size-4" data-icon="inline-start" />Open WhatsApp &amp; Save Reply</Button>
              <Button type="button" variant="outline" disabled={!replyText.trim() || isSavingReply} onClick={() => void sendReply("phone")}><Phone className="size-4" data-icon="inline-start" />Phone Call &amp; Save Notes</Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
      {isFormOpen ? selectedCategory === "group" && !editingEnquiry ? (
        <GroupEnquiryForm tours={tours} onClose={() => setIsFormOpen(false)} onSubmit={saveEnquiry} />
      ) : <EnquiryForm editing={Boolean(editingEnquiry)} customise={selectedCategory === "customise" && !editingEnquiry} form={form} tours={tours} onChange={setForm} onClose={() => setIsFormOpen(false)} onSubmit={saveEnquiry} /> : null}
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
  onBlacklistChange,
  searchQuery,
  selectedDateRange,
  selectedSource,
  selectedStatus,
  selectedBlacklist,
}: {
  onDateRangeChange: (value: string) => void;
  onSearchQueryChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onBlacklistChange: (value: string) => void;
  searchQuery: string;
  selectedDateRange: string;
  selectedSource: string;
  selectedStatus: string;
  selectedBlacklist: string;
}) {
  return (
    <AdminMobileFilter label="Enquiries">
    <div className="grid gap-3 border-b border-border p-4 xl:grid-cols-[minmax(220px,1fr)_145px_145px_145px_150px] xl:items-end">
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
      <FilterSelect label="Blacklist" value={selectedBlacklist} options={blacklistOptions} onChange={onBlacklistChange} />

    </div>
    </AdminMobileFilter>
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
  showTourName,
  showWhichTour = false,
  isLoading,
  onEdit,
  onView,
  onReply,
  onBlacklist,
  onStatusChange,
}: {
  enquiries: EnquiryRecord[];
  showTourName: boolean;
  showWhichTour?: boolean;
  isLoading: boolean;
  onEdit: (enquiry: EnquiryRecord) => void;
  onView: (enquiry: EnquiryRecord) => void;
  onReply: (enquiry: EnquiryRecord) => void;
  onBlacklist: (enquiry: EnquiryRecord) => Promise<void>;
  onStatusChange: (enquiry: EnquiryRecord, status: EnquiryRecord["status"]) => Promise<void>;
}) {
  const tourColumnLabel = showWhichTour ? "Which Tour" : showTourName ? "Tour Name" : "Subject";
  return (
    <>
      <div className="max-w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            {showWhichTour ? [11, 26, 27, 16, 14, 6].map((width, index) => <col key={index} style={{ width: `${width}%` }} />) : <>
            <col className="w-[11%]" />
            <col className="w-[22%]" />
            <col className="w-[23%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[12%]" />
            <col className="w-[6%]" />
            </>}
          </colgroup>
          <thead className="bg-muted/35 text-[11px] uppercase text-foreground/55">
            <tr>
              <th className="px-4 py-3 font-bold">{showWhichTour ? "ID" : "Enquiry ID"}</th>
              <th className="px-4 py-3 font-bold">Name &amp; Contact</th>
              <th className="px-4 py-3 font-bold">{tourColumnLabel}</th>
              <th className="px-4 py-3 font-bold">Source</th>
              {!showWhichTour ? <th className="px-4 py-3 font-bold">Status</th> : null}
              <th className="px-4 py-3 font-bold">Date &amp; Time</th>
              <th className="px-4 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-5 py-8 text-center text-xs text-foreground/55" colSpan={showWhichTour ? 6 : 7}>
                  Loading enquiries...
                </td>
              </tr>
            ) : enquiries.length ? (
              enquiries.map((enquiry) => (
                <tr
                  key={enquiry.id}
                  onClick={(event) => {
                    if (shouldOpenTableRow(event)) {
                      onView(enquiry);
                    }
                  }}
                  className="cursor-pointer border-t border-border transition-colors hover:bg-muted/25"
                >
                  <td
                    data-label={showWhichTour ? "ID" : "Enquiry ID"}
                    className="px-4 py-4 text-xs font-semibold text-foreground/70"
                  >
                    {enquiry.enquiryReference}
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
                  <td data-label={tourColumnLabel} className="px-4 py-4">
                    <p className="truncate text-xs font-bold text-foreground">
                      {showWhichTour ? getCustomiseEnquiryTourName(enquiry) : showTourName ? getEnquiryTourName(enquiry) : enquiry.subject}
                    </p>
                    {enquiry.isBlacklisted ? <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700"><ShieldBan className="size-3"/>Blacklisted</span> : null}
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
                  {!showWhichTour ? <td data-label="Status" className="px-4 py-4">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-3 py-1 text-[11px] font-bold",
                        getStatusClassName(enquiry.status)
                      )}
                    >
                      {enquiry.status}
                    </span>
                  </td> : null}
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
                    <EnquiryActions enquiry={enquiry} onEdit={onEdit} onView={onView} onReply={onReply} onBlacklist={onBlacklist} onStatusChange={onStatusChange} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="px-5 py-8 text-center text-xs text-foreground/55"
                  colSpan={showWhichTour ? 6 : 7}
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
  onView,
  onReply,
  onBlacklist,
  onStatusChange,
}: {
  enquiry: EnquiryRecord;
  onEdit: (enquiry: EnquiryRecord) => void;
  onView: (enquiry: EnquiryRecord) => void;
  onReply: (enquiry: EnquiryRecord) => void;
  onBlacklist: (enquiry: EnquiryRecord) => Promise<void>;
  onStatusChange: (enquiry: EnquiryRecord, status: EnquiryRecord["status"]) => Promise<void>;
}) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);

  async function changeStatus(status: EnquiryRecord["status"]) {
    if (isUpdating || enquiry.status === status) return;
    setIsUpdating(true);
    try {
      await onStatusChange(enquiry, status);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="grid size-10 place-items-center rounded-full border border-border bg-white text-foreground/65 transition-colors hover:border-primary hover:text-primary"
              aria-label={`Open actions for ${enquiry.enquiryReference}`}
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
            onClick={() => onView(enquiry)}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Eye className="size-4 text-foreground/60" />
            View
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onReply(enquiry)}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <MessageCircle className="size-4 text-foreground/60" />Reply
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onEdit(enquiry)}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Pencil className="size-4 text-foreground/60" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => void onBlacklist(enquiry)}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold text-red-700"
          >
            {enquiry.isBlacklisted ? <ShieldCheck className="size-4" /> : <ShieldBan className="size-4" />}
            {enquiry.isBlacklisted ? "Remove from Blacklist" : "Blacklist"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push(`/bookings/add?enquiryId=${encodeURIComponent(enquiry.id)}${getEnquiryCategory(enquiry) === "customise" ? "&scope=customise" : ""}`)} className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold">
            Convert to Booking
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isUpdating || enquiry.status === "Closed"} onClick={() => void changeStatus("Closed")} className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold">
            Closed
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function EnquiryView({
  enquiry,
  onClose,
}: {
  enquiry: EnquiryRecord | null;
  onClose: () => void;
}) {
  const details = enquiry ? getEnquiryDisplayDetails(enquiry) : null;
  const isGroupEnquiry = enquiry ? getEnquiryCategory(enquiry) === "group" : false;
  return (
    <Dialog open={Boolean(enquiry)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent showCloseButton={false} className="flex max-h-[85dvh] flex-col overflow-hidden rounded-sm border border-border bg-white p-5 sm:max-w-2xl">
        <DialogHeader className="sticky top-0 z-10 shrink-0 border-b border-border bg-white pb-3 pr-12">
          <DialogTitle className="text-lg font-bold">View Enquiry</DialogTitle>
          <DialogDescription>{enquiry?.enquiryReference}</DialogDescription>
          <button type="button" aria-label="Close enquiry details" onClick={onClose} className="absolute right-0 top-0 grid size-9 place-items-center rounded-full border border-border bg-white text-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <XCircle className="size-5" />
          </button>
        </DialogHeader>
        {enquiry ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pt-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              {([
                ["Name", enquiry.name],
                ["Gender", enquiry.gender],
                ["Email", enquiry.email],
                ["Phone", enquiry.phone],
                ["Tour", details?.tourName || ""],
                ...(isGroupEnquiry ? [
                  ["Tour ID", details?.tourId || ""],
                  ["Current City", details?.city || ""],
                  ["Total No. of Guests", details?.guests || ""],
                  ["Date Of Travel", details?.travelDate || ""],
                ] : []),
                ...(getEnquiryCategory(enquiry) === "customise" && details?.guests ? [["Total No. of Guests", details.guests]] : []),
                ["Source", enquiry.source],
                ["Social Media Referral", enquiry.socialMediaReferral],
                ["Status", enquiry.status],
                ["Blacklist", enquiry.isBlacklisted ? "Blacklisted" : "Active"],
                ["Blacklisted At", enquiry.blacklistedAt ? new Date(enquiry.blacklistedAt).toLocaleString("en-IN") : ""],
                ["Date & Time", `${enquiry.date} ${enquiry.time}`],
              ] as const).map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[11px] font-bold uppercase text-foreground/55">{label}</dt>
                  <dd className="mt-1 text-sm break-words text-foreground">{value || "-"}</dd>
                </div>
              ))}
            </dl>
            <div className="border-t border-border pt-4">
              <h3 className="text-[11px] font-bold uppercase text-foreground/55">Subject</h3>
              <p className="mt-1 text-sm font-semibold break-words">{enquiry.subject}</p>
            </div>
            <div>
              <h3 className="text-[11px] font-bold uppercase text-foreground/55">Message</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed break-words text-foreground/70">{details?.message || "-"}</p>
            </div>
            <div className="border-t border-border pt-4">
              <h3 className="text-[11px] font-bold uppercase text-foreground/55">Reply History</h3>
              {enquiry.replies?.length ? <ol className="mt-3 space-y-3">{enquiry.replies.map((reply, index) => <li key={`${reply.sentAt}-${index}`} className="rounded-sm bg-muted/35 p-3"><p className="whitespace-pre-wrap text-sm">{reply.message}</p><time className="mt-2 block text-[11px] text-foreground/55">{new Date(reply.sentAt).toLocaleString("en-IN")}</time></li>)}</ol> : <p className="mt-2 text-sm text-foreground/55">No replies yet.</p>}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EnquiryForm({
  editing,
  customise = false,
  form,
  tours,
  onChange,
  onClose,
  onSubmit,
}: {
  editing: boolean;
  customise?: boolean;
  form: EnquiryPayload;
  tours: AdminTour[];
  onChange: (form: EnquiryPayload) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>, payload?: EnquiryPayload) => void;
}) {
  const [guestCounts, setGuestCounts] = useState({ adults: 1, children: 0, infants: 0 });
  const update = (field: keyof EnquiryPayload, value: string) => {
    onChange({ ...form, [field]: value } as EnquiryPayload);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <form onSubmit={(event) => onSubmit(event, customise ? createCustomiseEnquiryPayload(form, guestCounts) : form)} className="flex h-[90dvh] max-h-[90dvh] w-full max-w-lg flex-col gap-4 overflow-hidden rounded-sm border border-border bg-white p-5 shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border pb-3">
          <h2 className="text-lg font-bold">{editing ? "Edit Enquiry" : "Add Enquiry"}</h2>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-foreground/55 hover:text-foreground">Close</button>
        </div>
        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto pr-2 sm:grid-cols-2">
          {!customise ? <label className="grid gap-1.5 text-xs font-semibold sm:col-span-2">Available Tour
            <select value={form.tourId || ""} onChange={event => { const tour = tours.find(item => item.id === event.target.value); onChange({ ...form, tourId: tour?.id || "", tourName: tour?.tourName || "", subject: tour ? `Tour enquiry - ${tour.tourName}` : form.subject }); }} className="h-10 rounded-sm border border-border px-3">
              <option value="">Select a tour (optional)</option>{tours.map(tour => <option key={tour.id} value={tour.id}>{tour.tourName}</option>)}
            </select>
          </label> : null}
          {(["name", "email", "phone", "subject"] as const).map((field) => (
            <label key={field} className="grid gap-1.5 text-xs font-semibold capitalize">
              {customise && field === "subject" ? "Which Tour" : field}
              <input required maxLength={customise && field === "subject" ? 160 : undefined} value={form[field]} onChange={(event) => update(field, event.target.value)} className="h-10 rounded-sm border border-border px-3 outline-none focus:border-primary" />
            </label>
          ))}
          <label className="grid gap-1.5 text-xs font-semibold">
            Gender
            <select value={form.gender || ""} onChange={(event) => update("gender", event.target.value)} className="h-10 rounded-sm border border-border px-3">
              <option value="">Select gender (optional)</option>
              <option>Female</option><option>Male</option><option>Non-binary</option><option>Other</option><option>Prefer not to say</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold">
            Source
            <select value={form.source} onChange={(event) => update("source", event.target.value)} className="h-10 rounded-sm border border-border px-3">
              {sourceOptions.slice(1).map((source) => <option key={source}>{source}</option>)}
            </select>
          </label>
          {!customise ? <label className="grid gap-1.5 text-xs font-semibold">
            Status
            <select value={form.status} onChange={(event) => update("status", event.target.value)} className="h-10 rounded-sm border border-border px-3">
              {statusOptions.slice(1).map((status) => <option key={status}>{status}</option>)}
            </select>
          </label> : null}
          {customise ? <fieldset className="min-w-0 sm:col-span-2">
            <legend className="mb-1.5 text-xs font-semibold">Total No. of Guests *</legend>
            <div className="flex flex-wrap gap-2 pb-1">
              {([
                { key: "adults", label: "Adult", age: "Above 12 years", minimum: 1 },
                { key: "children", label: "Child", age: "Above 6 to 12 years", minimum: 0 },
                { key: "infants", label: "Infant", age: "Below 6 years", minimum: 0 },
              ] as const).map(({ key, label, age, minimum }) => (
                <div key={key} className="grid min-w-0 flex-[1_1_130px] content-start gap-1.5">
                  <span className="text-xs font-semibold">{label}</span>
                  <span className="flex h-10 min-w-0 items-center justify-between gap-2 rounded-[14px] border border-[#ead8cb] bg-white px-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
                    <button type="button" aria-label={`Decrease ${label} count`} disabled={guestCounts[key] <= minimum} onClick={() => setGuestCounts((current) => ({ ...current, [key]: Math.max(minimum, current[key] - 1) }))} className="grid size-7 cursor-pointer place-items-center rounded-full border border-[#ed721e] text-[#ed721e] disabled:cursor-default disabled:opacity-40"><Minus className="size-4" /></button>
                    <output aria-label={`${label} count`} className="min-w-4 text-center text-sm" aria-live="polite">{guestCounts[key]}</output>
                    <button type="button" aria-label={`Increase ${label} count`} onClick={() => setGuestCounts((current) => ({ ...current, [key]: current[key] + 1 }))} className="grid size-7 cursor-pointer place-items-center rounded-full border border-[#ed721e] text-[#ed721e]"><Plus className="size-4" /></button>
                  </span>
                  <span className="whitespace-normal break-words text-xs font-normal text-[#929292]">{age}</span>
                </div>
              ))}
            </div>
          </fieldset> : null}
          <label className="grid gap-1.5 text-xs font-semibold sm:col-span-2">
            Social Media Referral
            <input
              value={form.socialMediaReferral || ""}
              onChange={(event) => update("socialMediaReferral", event.target.value)}
              maxLength={160}
              placeholder="e.g. Instagram, Facebook, YouTube"
              className="h-10 rounded-sm border border-border px-3 outline-none focus:border-primary"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold sm:col-span-2">
            Message
            <textarea maxLength={customise ? 2700 : undefined} value={form.message} onChange={(event) => update("message", event.target.value)} className="min-h-24 rounded-sm border border-border px-3 py-2 outline-none focus:border-primary" />
          </label>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border pt-3">
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
