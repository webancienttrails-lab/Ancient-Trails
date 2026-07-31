"use client";

import type { ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FilePlus,
  Mail,
  MapPin,
  MessageCircle,
  Plane,
  Plus,
  Ticket,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import {
  AdminDashboardShell,
  AdminSidebarToggle,
} from "@/components/admin-dashboard/admin-dashboard-shell";
import { HeaderDateRangePicker } from "@/components/admin-dashboard/header-date-range-picker";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Metric = {
  label: string;
  value: string;
  trend: string;
  icon: LucideIcon;
  tone: string;
};

type QuickAction = {
  label: string;
  icon: LucideIcon;
  tone: string;
};

const metrics: Metric[] = [
  {
    label: "Total Bookings",
    value: "156",
    trend: "+18.6% from Apr 2024",
    icon: Ticket,
    tone: "bg-primary/10 text-primary",
  },
  {
    label: "Upcoming Tours",
    value: "12",
    trend: "+20% from Apr 2024",
    icon: CalendarDays,
    tone: "bg-orange-100 text-orange-600",
  },
  {
    label: "Total Destinations",
    value: "48",
    trend: "+8% from Apr 2024",
    icon: MapPin,
    tone: "bg-emerald-100 text-emerald-600",
  },
  {
    label: "Total Users",
    value: "1,248",
    trend: "+15.4% from Apr 2024",
    icon: Users,
    tone: "bg-violet-100 text-violet-600",
  },
  {
    label: "Total Enquiries",
    value: "289",
    trend: "+12.3% from Apr 2024",
    icon: MessageCircle,
    tone: "bg-amber-100 text-amber-600",
  },
];

const quickActions: QuickAction[] = [
  { label: "Add Destination", icon: MapPin, tone: "text-primary" },
  { label: "+ Add Tour", icon: CalendarDays, tone: "text-orange-600" },
  { label: "+ Add Blog Post", icon: FilePlus, tone: "text-orange-500" },
  { label: "+ Add User", icon: Users, tone: "text-blue-600" },
  { label: "View Bookings", icon: Ticket, tone: "text-primary" },
  { label: "View Enquiries", icon: MessageCircle, tone: "text-violet-600" },
];

const upcomingTours = [
  {
    title: "Rajasthan Heritage Trail",
    date: "05 Jun 2024",
    bookings: 8,
    tone: "from-orange-500 via-amber-300 to-stone-700",
  },
  {
    title: "Himalayan Escape",
    date: "10 Jun 2024",
    bookings: 6,
    tone: "from-emerald-500 via-sky-300 to-slate-700",
  },
  {
    title: "Spiritual Varanasi",
    date: "15 Jun 2024",
    bookings: 7,
    tone: "from-amber-500 via-orange-200 to-stone-800",
  },
  {
    title: "Kerala Backwaters",
    date: "18 Jun 2024",
    bookings: 5,
    tone: "from-green-600 via-lime-200 to-cyan-700",
  },
];

const destinations = [
  { name: "Rajasthan", bookings: 68, tone: "from-orange-500 to-stone-700" },
  { name: "Varanasi", bookings: 42, tone: "from-amber-500 to-stone-800" },
  { name: "Hampi", bookings: 31, tone: "from-sky-500 to-orange-700" },
  { name: "Khajuraho", bookings: 24, tone: "from-lime-600 to-stone-700" },
  { name: "Kerala", bookings: 19, tone: "from-green-600 to-cyan-700" },
];

const recentBookings = [
  {
    name: "Rahul Sharma",
    tour: "Rajasthan Heritage Trail",
    date: "30 May 2024",
    status: "Confirmed",
    amount: "Rs24,500",
    statusClass: "bg-emerald-100 text-emerald-700",
  },
  {
    name: "Priya Mehta",
    tour: "Himalayan Escape",
    date: "30 May 2024",
    status: "Pending",
    amount: "Rs18,000",
    statusClass: "bg-amber-100 text-amber-700",
  },
  {
    name: "Arjun Verma",
    tour: "Spiritual Varanasi",
    date: "29 May 2024",
    status: "Confirmed",
    amount: "Rs12,500",
    statusClass: "bg-emerald-100 text-emerald-700",
  },
  {
    name: "Sneha Iyer",
    tour: "Kerala Backwaters",
    date: "29 May 2024",
    status: "Confirmed",
    amount: "Rs16,800",
    statusClass: "bg-emerald-100 text-emerald-700",
  },
  {
    name: "Karan Patel",
    tour: "Rajasthan Heritage Trail",
    date: "28 May 2024",
    status: "Cancelled",
    amount: "Rs22,000",
    statusClass: "bg-red-100 text-red-700",
  },
];

const enquiryStats = [
  {
    label: "New Enquiries",
    value: "98",
    icon: Mail,
    tone: "bg-primary/10 text-primary",
  },
  {
    label: "In Progress",
    value: "121",
    icon: Clock3,
    tone: "bg-amber-100 text-amber-700",
  },
  {
    label: "Replied",
    value: "45",
    icon: CheckCircle2,
    tone: "bg-emerald-100 text-emerald-700",
  },
  {
    label: "Closed",
    value: "25",
    icon: XCircle,
    tone: "bg-violet-100 text-violet-700",
  },
];

const statusLegend = [
  { label: "Confirmed", value: "62 (39.7%)", dot: "bg-emerald-500" },
  { label: "Pending", value: "48 (30.8%)", dot: "bg-orange-400" },
  { label: "Cancelled", value: "22 (14.1%)", dot: "bg-red-500" },
  { label: "Completed", value: "18 (11.5%)", dot: "bg-blue-500" },
  { label: "Refunded", value: "6 (3.8%)", dot: "bg-violet-500" },
];

export default function DashboardPage() {
  const toast = useToast();

  return (
    <AdminDashboardShell activeLabel="Dashboard">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <DashboardHeader />

        <section
          data-admin-metric-grid
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
        >
          {metrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </section>

        <DashboardPanel title="Quick Actions" className="p-3.5 sm:p-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-flow-col sm:auto-cols-[minmax(150px,1fr)] sm:overflow-x-auto sm:pb-1 sm:[-ms-overflow-style:none] sm:[scrollbar-width:none] xl:grid-flow-row xl:grid-cols-6 xl:auto-cols-auto xl:overflow-visible xl:pb-0 sm:[&::-webkit-scrollbar]:hidden">
            {quickActions.map((action) => {
              const Icon = action.icon;

              return (
                <Button
                  key={action.label}
                  type="button"
                  onClick={() =>
                    toast.info(
                      action.label.replace(/^\+\s*/, ""),
                      "This admin action is ready to be connected."
                    )
                  }
                  variant="outline"
                  className="h-11 w-full cursor-pointer justify-start rounded-sm border-border bg-white px-3 text-left text-xs font-semibold text-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <span className="grid w-5 shrink-0 place-items-center">
                    <Icon
                      className={cn(
                        "size-4 group-hover/button:text-primary-foreground",
                        action.tone
                      )}
                    />
                  </span>
                  <span className="min-w-0 truncate">{action.label}</span>
                </Button>
              );
            })}
          </div>
        </DashboardPanel>

        <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr_0.85fr]">
          <UpcomingTours />
          <RecentBookings />
          <EnquiriesOverview />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr_0.9fr]">
          <BookingsOverview />
          <BookingsStatus />
          <TopDestinations />
        </section>
      </div>
    </AdminDashboardShell>
  );
}

function DashboardHeader() {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <AdminSidebarToggle />
        <div className="min-w-0">
          <h1 className="font-sans text-2xl font-bold tracking-normal text-foreground">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            Welcome back, Admin! Here&apos;s what&apos;s happening today.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <HeaderDateRangePicker />

        <button
          className="relative grid size-10 place-items-center rounded-sm border border-border bg-white text-foreground transition-colors hover:border-primary hover:text-primary"
          type="button"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-white">
            5
          </span>
        </button>

        <button
          className="flex h-10 items-center gap-2 rounded-sm border border-border bg-white px-2.5 text-sm font-semibold transition-colors hover:border-primary"
          type="button"
          aria-label="Admin profile"
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

function MetricCard({ metric }: { metric: Metric }) {
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

function DashboardPanel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
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

function BookingsOverview() {
  return (
    <DashboardPanel
      title="Bookings Overview"
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-sm border-border bg-white text-xs"
        >
          Weekly
          <ChevronDown className="size-3.5" />
        </Button>
      }
    >
      <div className="mb-3 flex items-center gap-5 text-xs text-foreground/55">
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-primary" />
          This Month
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-zinc-300" />
          Last Month
        </span>
      </div>

      <div className="h-[220px] w-full">
        <svg
          className="h-full w-full"
          viewBox="0 0 560 240"
          role="img"
          aria-label="Bookings overview line chart"
        >
          {[35, 80, 125, 170].map((y) => (
            <line
              key={y}
              x1="45"
              x2="535"
              y1={y}
              y2={y}
              stroke="#ece2da"
              strokeWidth="1"
            />
          ))}
          <polyline
            fill="none"
            points="48,175 168,125 288,96 408,84 528,48"
            stroke="#e6650a"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
          <polyline
            fill="none"
            points="48,198 168,155 288,132 408,145 528,118"
            stroke="#cfd3d6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
          {[["48", "175"], ["168", "125"], ["288", "96"], ["408", "84"], ["528", "48"]].map(
            ([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" fill="#e6650a" />
            )
          )}
          {[["48", "198"], ["168", "155"], ["288", "132"], ["408", "145"], ["528", "118"]].map(
            ([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" fill="#cfd3d6" />
            )
          )}
          {["0", "20", "40", "60", "80"].map((label, index) => (
            <text
              key={label}
              x="18"
              y={215 - index * 45}
              fill="#8f8178"
              fontSize="12"
            >
              {label}
            </text>
          ))}
          {["1 May", "8 May", "15 May", "22 May", "29 May"].map(
            (label, index) => (
              <text
                key={label}
                x={38 + index * 120}
                y="230"
                fill="#8f8178"
                fontSize="12"
              >
                {label}
              </text>
            )
          )}
        </svg>
      </div>
    </DashboardPanel>
  );
}

function BookingsStatus() {
  return (
    <DashboardPanel title="Bookings by Status">
      <div className="flex flex-col items-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
        <div
          className="relative size-44 shrink-0 rounded-full"
          style={{
            background:
              "conic-gradient(#44b96d 0 39.7%, #ff9f2e 39.7% 70.5%, #ef4444 70.5% 84.6%, #3b82f6 84.6% 96.1%, #8b5cf6 96.1% 100%)",
          }}
        >
          <div className="absolute inset-9 grid place-items-center rounded-full bg-white">
            <div className="text-center">
              <p className="text-4xl font-bold leading-none">156</p>
              <p className="mt-1 text-xs text-foreground/55">Total</p>
            </div>
          </div>
        </div>

        <div className="w-full space-y-3">
          {statusLegend.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="flex items-center gap-2 text-foreground/70">
                <span className={cn("size-2.5 rounded-full", item.dot)} />
                {item.label}
              </span>
              <span className="font-semibold text-foreground/70">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </DashboardPanel>
  );
}

function UpcomingTours() {
  return (
    <DashboardPanel
      title="Upcoming Tours"
      action={<PanelLink label="View All" />}
    >
      <div className="space-y-3">
        {upcomingTours.map((tour) => (
          <div
            key={tour.title}
            className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3"
          >
            <TourThumb tone={tour.tone} />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-foreground">
                {tour.title}
              </p>
              <p className="mt-1 text-[11px] text-foreground/55">{tour.date}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold leading-none">{tour.bookings}</p>
              <p className="mt-1 text-[10px] font-semibold text-primary">
                Bookings
              </p>
            </div>
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
}

function TopDestinations() {
  const maxBookings = Math.max(...destinations.map((item) => item.bookings));

  return (
    <DashboardPanel
      title="Top Destinations (By Bookings)"
      action={<PanelLink label="View All" />}
    >
      <div className="space-y-3.5">
        {destinations.map((destination, index) => (
          <div
            key={destination.name}
            className="grid grid-cols-[18px_48px_minmax(0,1fr)_32px] items-center gap-3"
          >
            <span className="text-xs font-semibold text-foreground/60">
              {index + 1}.
            </span>
            <TourThumb tone={destination.tone} size="sm" />
            <div className="min-w-0">
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="truncate text-xs font-bold">{destination.name}</p>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${(destination.bookings / maxBookings) * 100}%`,
                  }}
                />
              </div>
            </div>
            <span className="text-right text-xs font-bold">
              {destination.bookings}
            </span>
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
}

function RecentBookings() {
  return (
    <DashboardPanel
      title="Recent Bookings"
      action={<PanelLink label="View All" />}
    >
      <div className="space-y-3">
        {recentBookings.map((booking, index) => (
          <div
            key={`${booking.name}-${booking.tour}`}
            className="grid gap-3 rounded-sm border border-transparent py-0.5 sm:grid-cols-[minmax(0,1fr)_86px_82px_74px] sm:items-center"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white",
                  index % 2 === 0 ? "bg-[#7a3b22]" : "bg-primary"
                )}
              >
                {booking.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold">{booking.name}</p>
                <p className="truncate text-[11px] text-foreground/55">
                  {booking.tour}
                </p>
              </div>
            </div>
            <span className="text-xs text-foreground/60">{booking.date}</span>
            <span
              className={cn(
                "w-fit rounded-full px-2 py-1 text-[10px] font-semibold",
                booking.statusClass
              )}
            >
              {booking.status}
            </span>
            <span className="text-sm font-bold">{booking.amount}</span>
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
}

function EnquiriesOverview() {
  return (
    <DashboardPanel
      title="Enquiries Overview"
      action={<PanelLink label="View All" />}
    >
      <div className="space-y-4">
        {enquiryStats.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-sm",
                    item.tone
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="text-xs font-medium text-foreground/75">
                  {item.label}
                </span>
              </div>
              <span className="text-lg font-bold">{item.value}</span>
            </div>
          );
        })}
      </div>
    </DashboardPanel>
  );
}

function TourThumb({
  tone,
  size = "default",
}: {
  tone: string;
  size?: "default" | "sm";
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md bg-gradient-to-br",
        size === "default" ? "h-12 w-16" : "h-9 w-12",
        tone
      )}
    >
      <span className="absolute bottom-1 left-1 h-2 w-7 rounded-full bg-white/65" />
      <span className="absolute bottom-3 left-3 h-5 w-5 rounded-sm border border-white/60 bg-white/25" />
      <Plane className="absolute right-1 top-1 size-3 text-white/80" />
    </div>
  );
}

function PanelLink({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-xs font-bold text-primary transition-colors hover:text-accent"
    >
      {label}
      <Plus className="size-3 rotate-45" />
    </button>
  );
}
