"use client";

import type { ReactNode } from "react";
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

const reportTabs = [
  "Overview",
  "Bookings",
  "Tours",
  "Destinations",
  "Users",
  "Enquiries",
  "Finance",
];

const metrics: ReportMetric[] = [
  {
    label: "Total Bookings",
    value: "156",
    trend: "+18.6% from Jun 2026",
    icon: Ticket,
    tone: "bg-primary/10 text-primary",
  },
  {
    label: "Total Revenue",
    value: "Rs2,45,800",
    trend: "+22.4% from Jun 2026",
    icon: BriefcaseBusiness,
    tone: "bg-orange-100 text-orange-600",
  },
  {
    label: "Total Enquiries",
    value: "289",
    trend: "+12.3% from Jun 2026",
    icon: MessageCircle,
    tone: "bg-amber-100 text-amber-600",
  },
  {
    label: "Total Users",
    value: "1,248",
    trend: "+16.4% from Jun 2026",
    icon: Users,
    tone: "bg-violet-100 text-violet-600",
  },
  {
    label: "Total Destinations",
    value: "48",
    trend: "+8% from Jun 2026",
    icon: MapPin,
    tone: "bg-emerald-100 text-emerald-600",
  },
];

const bookingStatus: StatusItem[] = [
  { label: "Confirmed", value: 118, percentage: 60.2, color: "#52be7f" },
  { label: "Pending", value: 26, percentage: 13.3, color: "#f7bd4d" },
  { label: "Cancelled", value: 8, percentage: 4.1, color: "#e85d5d" },
  { label: "Completed", value: 44, percentage: 22.4, color: "#a783df" },
];

const enquiryStatus: StatusItem[] = [
  { label: "New Enquiries", value: 98, percentage: 33.9, color: "#df6f12" },
  { label: "In Progress", value: 121, percentage: 41.9, color: "#f7bd4d" },
  { label: "Replied", value: 45, percentage: 15.6, color: "#67c889" },
  { label: "Closed", value: 25, percentage: 8.6, color: "#a783df" },
];

const destinations: DestinationReport[] = [
  { name: "Badami", bookings: 28 },
  { name: "Hampi", bookings: 22 },
  { name: "Aihole", bookings: 18 },
  { name: "Pattadakal", bookings: 16 },
  { name: "Bijapur", bookings: 12 },
];

const bookingSummary: BookingSummaryRow[] = [
  {
    date: "01-07-2026 - 07-07-2026",
    bookings: 28,
    revenue: "Rs42,600",
    confirmed: 18,
    pending: 6,
    cancelled: 1,
    completed: 3,
  },
  {
    date: "08-07-2026 - 14-07-2026",
    bookings: 32,
    revenue: "Rs51,300",
    confirmed: 20,
    pending: 7,
    cancelled: 2,
    completed: 3,
  },
  {
    date: "15-07-2026 - 21-07-2026",
    bookings: 41,
    revenue: "Rs67,800",
    confirmed: 27,
    pending: 8,
    cancelled: 3,
    completed: 3,
  },
  {
    date: "22-07-2026 - 31-07-2026",
    bookings: 55,
    revenue: "Rs84,100",
    confirmed: 53,
    pending: 5,
    cancelled: 2,
    completed: 4,
  },
];

const bookingTrendPoints = [
  12, 17, 21, 18, 20, 18, 22, 27, 18, 18, 21, 13, 22, 35, 19, 25, 27, 34, 25,
  28, 22, 30, 41, 29, 25, 27, 22, 18, 15, 30, 14, 36, 29, 25,
];

const revenueTrendPoints = [
  54, 72, 88, 71, 84, 76, 91, 118, 72, 74, 91, 58, 92, 146, 76, 105, 116,
  148, 101, 120, 90, 124, 176, 121, 101, 111, 84, 71, 60, 126, 64, 153, 126,
  107,
];

export default function ReportsPage() {
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
            {metrics.map((metric) => (
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
            <BookingsTrendChart />
          </ReportPanel>

          <ReportPanel title="Bookings by Status">
            <DonutWithLegend
              centerLabel="Total"
              centerValue="196"
              items={bookingStatus}
              sizeClassName="size-44"
            />
          </ReportPanel>

          <ReportPanel
            title="Top Destinations"
            action={<SmallSelectButton label="By Bookings" />}
          >
            <TopDestinationsList />
          </ReportPanel>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.45fr_0.85fr]">
          <ReportPanel title="Booking Summary" className="overflow-hidden p-0">
            <BookingSummaryTable />
          </ReportPanel>

          <ReportPanel
            title="Enquiries Overview"
            action={<SmallSelectButton label="By Status" />}
          >
            <DonutWithLegend
              centerLabel="Total"
              centerValue="289"
              items={enquiryStatus}
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

function BookingsTrendChart() {
  const maxBooking = Math.max(...bookingTrendPoints);
  const maxRevenue = Math.max(...revenueTrendPoints);
  const bookingPoints = bookingTrendPoints.map((value, index) => {
    const x = 44 + (index / (bookingTrendPoints.length - 1)) * 492;
    const y = 204 - (value / maxBooking) * 152;
    return { x, y };
  });
  const revenuePoints = revenueTrendPoints.map((value, index) => {
    const x = 44 + (index / (revenueTrendPoints.length - 1)) * 492;
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

function TopDestinationsList() {
  const maxBookings = Math.max(...destinations.map((item) => item.bookings));

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

function BookingSummaryTable() {
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
            {bookingSummary.map((row) => (
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
                156
              </td>
              <td data-label="Revenue" className="px-4 py-3 text-right">
                Rs2,45,800
              </td>
              <td data-label="Confirmed" className="px-4 py-3 text-right">
                118
              </td>
              <td data-label="Pending" className="px-4 py-3 text-right">
                26
              </td>
              <td data-label="Cancelled" className="px-4 py-3 text-right">
                8
              </td>
              <td data-label="Completed" className="px-4 py-3 text-right">
                13
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
