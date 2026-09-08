"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  ChevronDown,
  Download,
  Filter,
  MapPin,
  MessageCircle,
  Ticket,
  Users,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import {
  getAdminDashboardSummary,
  type AdminDashboardSummary,
} from "@/lib/dashboard";
import { listAdminBookings, type AdminBooking } from "@/lib/bookings";
import { cn } from "@/lib/utils";

type ReportMetric = {
  label: string;
  value: string;
  trend: string;
  icon: LucideIcon;
  tone: string;
};

type StatusItem = {
  color: string;
  label: string;
  percentage: number;
  value: number;
};

type DestinationReport = {
  bookings: number;
  name: string;
};

type BookingSummaryRow = {
  bookings: number;
  cancelled: number;
  completed: number;
  confirmed: number;
  date: string;
  pending: number;
  revenue: string;
};

type ReportTotals = {
  bookings: number;
  revenue: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  completed: number;
};

const statusColors = {
  cancelled: "#e85d5d",
  completed: "#a783df",
  confirmed: "#52be7f",
  inProgress: "#f7bd4d",
  new: "#df6f12",
  pending: "#f7bd4d",
  refunded: "#8f8178",
  replied: "#67c889",
  closed: "#a783df",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function createReportData(
  summary: AdminDashboardSummary | null,
  bookings: AdminBooking[]
) {
  const metrics = summary?.metrics;
  const totalRevenue = bookings.reduce(
    (total, booking) => total + (booking.grandTotal || booking.subtotal || 0),
    0
  );
  const totals: ReportTotals = {
    bookings: metrics?.totalBookings.value || bookings.length,
    revenue: totalRevenue,
    confirmed: countBookingStatus(bookings, "confirmed"),
    pending: countBookingStatus(bookings, "pending"),
    cancelled: countBookingStatus(bookings, "cancelled"),
    completed: countBookingStatus(bookings, "completed"),
  };
  const bookingStatus = (summary?.bookingStatus || []).map((item) => ({
    label: item.key[0].toUpperCase() + item.key.slice(1),
    value: item.value,
    percentage: Number(item.percentage.toFixed(1)),
    color: statusColors[item.key],
  }));
  const enquiryStatus = (summary?.enquiryStats || []).map((item) => ({
    label: item.key === "inProgress" ? "In Progress" : `${item.key[0].toUpperCase()}${item.key.slice(1)}`,
    value: item.value,
    percentage: summary?.metrics.totalEnquiries.value
      ? Number(((item.value / summary.metrics.totalEnquiries.value) * 100).toFixed(1))
      : 0,
    color: statusColors[item.key],
  }));
  const bookingPoints = summary?.bookingChart.map((bucket) => bucket.current) || [];
  const revenuePoints = splitRevenueAcrossPoints(bookings, bookingPoints.length);

  return {
    bookingPoints,
    bookingStatus,
    bookingSummary: (summary?.bookingChart || []).map((bucket) => ({
      date: bucket.label,
      bookings: bucket.current,
      revenue: "-",
      confirmed: 0,
      pending: 0,
      cancelled: 0,
      completed: 0,
    })),
    destinations: (summary?.topDestinations || []).map((item) => ({
      name: item.name,
      bookings: item.bookings,
    })),
    enquiryStatus,
    enquiryTotal: metrics?.totalEnquiries.value || 0,
    metrics: [
      createMetric("Total Bookings", metrics?.totalBookings, Ticket, "bg-primary/10 text-primary"),
      { label: "Total Revenue", value: formatCurrency(totalRevenue), trend: "Live booking totals", icon: BriefcaseBusiness, tone: "bg-orange-100 text-orange-600" },
      createMetric("Total Enquiries", metrics?.totalEnquiries, MessageCircle, "bg-amber-100 text-amber-600"),
      createMetric("Total Users", metrics?.totalUsers, Users, "bg-violet-100 text-violet-600"),
      createMetric("Total Destinations", metrics?.totalDestinations, MapPin, "bg-emerald-100 text-emerald-600"),
    ],
    revenuePoints,
    totals,
    bookingTotal: totals.bookings,
  };
}

function createMetric(
  label: string,
  metric: { value: number; trend: string } | undefined,
  icon: LucideIcon,
  tone: string
): ReportMetric {
  return {
    label,
    value: String(metric?.value || 0),
    trend: metric?.trend || "Loading...",
    icon,
    tone,
  };
}

function countBookingStatus(bookings: AdminBooking[], status: string): number {
  return bookings.filter((booking) => {
    if (status === "pending") return booking.paymentStatus === "pending";
    if (status === "cancelled") return booking.paymentStatus === "failed";
    if (status === "completed") return booking.paymentStatus === "paid";
    return booking.paymentStatus === "paid";
  }).length;
}

function splitRevenueAcrossPoints(bookings: AdminBooking[], pointCount: number): number[] {
  if (!pointCount) return [];
  const points = Array.from({ length: pointCount }, () => 0);
  bookings.forEach((booking, index) => {
    points[index % pointCount] += booking.grandTotal || booking.subtotal || 0;
  });
  return points.map((value) => Math.max(1, Math.round(value / 1000)));
}

const reportTabs = [
  "Overview",
  "Bookings",
  "Tours",
  "Destinations",
  "Users",
  "Enquiries",
  "Finance",
];

export default function ReportsPage() {
  const toast = useToast();
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);

  useEffect(() => {
    Promise.all([getAdminDashboardSummary(), listAdminBookings()])
      .then(([summaryResponse, bookingsResponse]) => {
        setSummary(summaryResponse.data);
        setBookings(bookingsResponse.data.bookings);
      })
      .catch((error: unknown) => {
        toast.error("Unable to load reports", error instanceof Error ? error.message : "Please try again.");
      });
  }, [toast]);

  const reportData = createReportData(summary, bookings);

  return (
    <AdminDashboardShell activeLabel="Report">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4">
        <ReportsHeader />

        <section className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
          <div className="flex flex-col gap-3 border-b border-border px-4 pt-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-x-6 gap-y-0 overflow-visible sm:flex-nowrap sm:overflow-x-auto sm:[-ms-overflow-style:none] sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden">
              {reportTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={cn(
                    "h-11 shrink-0 border-b-2 px-0 text-xs font-semibold transition-colors",
                    tab === "Overview"
                      ? "border-primary text-primary"
                      : "border-transparent text-foreground/65 hover:text-primary"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mb-3 h-9 self-start rounded-sm border-border bg-white text-xs font-bold lg:self-auto"
            >
              <Filter className="size-4" data-icon="inline-start" />
              Filter
            </Button>
          </div>

          <div
            data-admin-metric-grid
            className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5"
          >
            {reportData.metrics.map((metric) => (
              <ReportMetricCard key={metric.label} metric={metric} />
            ))}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.38fr_0.9fr_0.95fr]">
          <ReportPanel
            title="Bookings Overview"
            action={
              <div className="flex items-center gap-4">
                <ChartLegend color="bg-primary" label="Bookings" />
                <ChartLegend color="bg-stone-300" label="Revenue (Rs)" />
                <SmallSelectButton label="Daily" />
              </div>
            }
          >
            <BookingsTrendChart
              bookingPoints={reportData.bookingPoints}
              revenuePoints={reportData.revenuePoints}
            />
          </ReportPanel>

          <ReportPanel title="Bookings by Status">
            <DonutWithLegend
              centerLabel="Total"
              centerValue={String(reportData.bookingTotal)}
              items={reportData.bookingStatus}
              sizeClassName="size-44"
            />
          </ReportPanel>

          <ReportPanel
            title="Top Destinations"
            action={<SmallSelectButton label="By Bookings" />}
          >
            <TopDestinationsList destinations={reportData.destinations} />
          </ReportPanel>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.45fr_0.85fr]">
          <ReportPanel title="Booking Summary" className="overflow-hidden p-0">
            <BookingSummaryTable rows={reportData.bookingSummary} totals={reportData.totals} />
          </ReportPanel>

          <ReportPanel
            title="Enquiries Overview"
            action={<SmallSelectButton label="By Status" />}
          >
            <DonutWithLegend
              centerLabel="Total"
              centerValue={String(reportData.enquiryTotal)}
              items={reportData.enquiryStatus}
              sizeClassName="size-40"
            />
          </ReportPanel>
        </section>
      </div>
    </AdminDashboardShell>
  );
}

function ReportsHeader() {
  const toast = useToast();

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <AdminSidebarToggle />
        <div className="min-w-0">
          <h1 className="font-sans text-2xl font-bold tracking-normal text-foreground">
            Report
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            Track performance and analytics across the platform.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-sm border-border bg-white px-4 text-xs font-bold"
              />
            }
          >
            <Download className="size-4" data-icon="inline-start" />
            Export Report
            <ChevronDown className="size-4 text-foreground/45" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-40 rounded-sm border border-border bg-white p-1 shadow-lg shadow-stone-200/70"
          >
            <DropdownMenuItem
              onClick={() => toast.info("Export Report", "PDF export is ready.")}
              className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
            >
              Export PDF
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => toast.info("Export Report", "CSV export is ready.")}
              className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
            >
              Export CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          onClick={() =>
            toast.info("Notifications", "You have 6 report notifications.")
          }
          className="relative grid size-10 place-items-center rounded-sm border border-border bg-white text-foreground transition-colors hover:border-primary hover:text-primary"
          type="button"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-white">
            6
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

function ReportMetricCard({ metric }: { metric: ReportMetric }) {
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

function ReportPanel({
  action,
  children,
  className,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <section
      className={cn(
        "rounded-sm border border-border bg-white p-4 shadow-sm shadow-stone-200/40",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-sans text-sm font-bold tracking-normal text-foreground">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ChartLegend({ color, label }: { color: string; label: string }) {
  return (
    <span className="hidden items-center gap-2 text-[11px] font-semibold text-foreground/60 sm:flex">
      <span className={cn("size-2.5 rounded-full", color)} />
      {label}
    </span>
  );
}

function SmallSelectButton({ label }: { label: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 rounded-sm border-border bg-white px-3 text-[11px] font-bold"
    >
      {label}
      <ChevronDown className="size-3.5 text-foreground/45" />
    </Button>
  );
}

function BookingsTrendChart({
  bookingPoints: bookingTrendPoints,
  revenuePoints: revenueTrendPoints,
}: {
  bookingPoints: number[];
  revenuePoints: number[];
}) {
  const maxBooking = Math.max(...bookingTrendPoints, 1);
  const maxRevenue = Math.max(...revenueTrendPoints, 1);
  const bookingPoints = bookingTrendPoints.map((value, index) => {
    const x = 44 + (index / Math.max(bookingTrendPoints.length - 1, 1)) * 492;
    const y = 204 - (value / maxBooking) * 152;
    return { x, y };
  });
  const revenuePoints = revenueTrendPoints.map((value, index) => {
    const x = 44 + (index / Math.max(revenueTrendPoints.length - 1, 1)) * 492;
    const y = 204 - (value / maxRevenue) * 152;
    return { x, y };
  });
  const bookingPath = bookingPoints
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
  const revenuePath = revenuePoints
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");

  return (
    <div className="h-[228px] w-full">
      <svg
        className="h-full w-full"
        viewBox="0 0 580 236"
        role="img"
        aria-label="Bookings and revenue trend chart"
      >
        <defs>
          <linearGradient id="report-booking-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#e77717" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#e77717" stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {[52, 90, 128, 166, 204].map((y) => (
          <line
            key={y}
            x1="44"
            x2="536"
            y1={y}
            y2={y}
            stroke="#eee4dc"
            strokeDasharray="4 5"
            strokeWidth="1"
          />
        ))}
        {[0, 10, 20, 30, 40].map((label, index) => (
          <text
            key={label}
            x="12"
            y={208 - index * 38}
            fill="#8f8178"
            fontSize="11"
          >
            {label}
          </text>
        ))}
        {[0, 50, 100, 150, 200].map((label, index) => (
          <text
            key={label}
            x="544"
            y={208 - index * 38}
            fill="#8f8178"
            fontSize="11"
          >
            {label}K
          </text>
        ))}

        <path
          d={`${bookingPath} L536,204 L44,204 Z`}
          fill="url(#report-booking-fill)"
        />
        <path
          d={revenuePath}
          fill="none"
          stroke="#d9cabe"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        <path
          d={bookingPath}
          fill="none"
          stroke="#e77717"
          strokeLinejoin="round"
          strokeWidth="3"
        />

        {bookingPoints.map((point, index) => (
          <circle
            key={`booking-${index}`}
            cx={point.x}
            cy={point.y}
            fill="#e77717"
            r="3.5"
            stroke="#ffffff"
            strokeWidth="2"
          />
        ))}
        {revenuePoints.map((point, index) => (
          <circle
            key={`revenue-${index}`}
            cx={point.x}
            cy={point.y}
            fill="#d9cabe"
            r="3"
            stroke="#ffffff"
            strokeWidth="2"
          />
        ))}

        {["01 Jul", "06 Jul", "11 Jul", "16 Jul", "21 Jul", "26 Jul", "31 Jul"].map(
          (label, index) => (
            <text
              key={label}
              x={44 + index * 82}
              y="228"
              fill="#8f8178"
              fontSize="11"
              textAnchor={index === 0 ? "start" : "middle"}
            >
              {label}
            </text>
          )
        )}
        <text x="8" y="34" fill="#76675e" fontSize="11">
          Bookings
        </text>
        <text x="514" y="34" fill="#76675e" fontSize="11">
          Revenue
        </text>
      </svg>
    </div>
  );
}

function DonutWithLegend({
  centerLabel,
  centerValue,
  items,
  sizeClassName,
}: {
  centerLabel: string;
  centerValue: string;
  items: StatusItem[];
  sizeClassName: string;
}) {
  const segments = createConicGradient(items);

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
      <div
        className={cn("relative shrink-0 rounded-full", sizeClassName)}
        style={{ background: segments }}
      >
        <div className="absolute inset-[28%] grid place-items-center rounded-full bg-white">
          <div className="text-center">
            <p className="text-2xl font-bold leading-none">{centerValue}</p>
            <p className="mt-1 text-[11px] text-foreground/55">
              {centerLabel}
            </p>
          </div>
        </div>
      </div>

      <div className="w-full space-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-xs"
          >
            <span className="flex min-w-0 items-center gap-2 text-foreground/70">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="text-right font-semibold text-foreground/70">
              {item.value} ({item.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function createConicGradient(items: StatusItem[]): string {
  let cursor = 0;
  const segments = items.map((item) => {
    const start = cursor;
    const end = cursor + item.percentage;
    cursor = end;
    return `${item.color} ${start}% ${end}%`;
  });

  return `conic-gradient(${segments.join(", ")})`;
}

function TopDestinationsList({
  destinations,
}: {
  destinations: DestinationReport[];
}) {
  const maxBookings = Math.max(...destinations.map((item) => item.bookings), 1);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_48px] gap-4 border-b border-border pb-2 text-[11px] font-semibold text-foreground/55">
        <span>Destination</span>
        <span className="text-right">Bookings</span>
      </div>
      {destinations.map((destination) => (
        <div
          key={destination.name}
          className="grid grid-cols-[minmax(0,1fr)_36px] items-center gap-4"
        >
          <div className="min-w-0">
            <div className="mb-1 flex items-center justify-between gap-3">
              <p className="truncate text-xs font-bold text-foreground">
                {destination.name}
              </p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#e9ded6]">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${(destination.bookings / maxBookings) * 100}%`,
                }}
              />
            </div>
          </div>
          <span className="text-right text-xs font-bold text-foreground">
            {destination.bookings}
          </span>
        </div>
      ))}
    </div>
  );
}

function BookingSummaryTable({
  rows,
  totals,
}: {
  rows: BookingSummaryRow[];
  totals: ReportTotals;
}) {
  return (
    <div className="overflow-hidden">
      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-xs">
          <thead className="bg-muted/35 text-[11px] text-foreground/55">
            <tr>
              <th className="px-4 py-3 font-bold">Date</th>
              <th className="px-4 py-3 text-right font-bold">
                Total Bookings
              </th>
              <th className="px-4 py-3 text-right font-bold">Revenue</th>
              <th className="px-4 py-3 text-right font-bold">Confirmed</th>
              <th className="px-4 py-3 text-right font-bold">Pending</th>
              <th className="px-4 py-3 text-right font-bold">Cancelled</th>
              <th className="px-4 py-3 text-right font-bold">Completed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date} className="border-t border-border">
                <td
                  data-label="Date"
                  data-mobile-primary
                  className="px-4 py-3 font-semibold text-foreground/75"
                >
                  {row.date}
                </td>
                <td
                  data-label="Total Bookings"
                  className="px-4 py-3 text-right font-bold"
                >
                  {row.bookings}
                </td>
                <td
                  data-label="Revenue"
                  className="px-4 py-3 text-right font-bold"
                >
                  {row.revenue}
                </td>
                <td data-label="Confirmed" className="px-4 py-3 text-right">
                  {row.confirmed}
                </td>
                <td data-label="Pending" className="px-4 py-3 text-right">
                  {row.pending}
                </td>
                <td data-label="Cancelled" className="px-4 py-3 text-right">
                  {row.cancelled}
                </td>
                <td data-label="Completed" className="px-4 py-3 text-right">
                  {row.completed}
                </td>
              </tr>
            ))}
            <tr className="border-t border-border bg-primary/5 font-bold text-primary">
              <td data-label="Date" data-mobile-primary className="px-4 py-3">
                Total
              </td>
              <td data-label="Total Bookings" className="px-4 py-3 text-right">
                {totals.bookings}
              </td>
              <td data-label="Revenue" className="px-4 py-3 text-right">
                {formatCurrency(totals.revenue)}
              </td>
              <td data-label="Confirmed" className="px-4 py-3 text-right">
                {totals.confirmed}
              </td>
              <td data-label="Pending" className="px-4 py-3 text-right">
                {totals.pending}
              </td>
              <td data-label="Cancelled" className="px-4 py-3 text-right">
                {totals.cancelled}
              </td>
              <td data-label="Completed" className="px-4 py-3 text-right">
                {totals.completed}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
