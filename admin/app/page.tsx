"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
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
  UserRoundCheck,
  Users,
  XCircle,
  Pencil,
  type LucideIcon,
} from "lucide-react";

import {
  AdminDashboardShell,
  AdminSidebarToggle,
} from "@/components/admin-dashboard/admin-dashboard-shell";
import { HeaderDateRangePicker } from "@/components/admin-dashboard/header-date-range-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  getAdminSession,
  listenForAdminSessionChanges,
  type AdminUser,
} from "@/lib/admin-auth";
import {
  getAdminDashboardSummary,
  getDashboardMediaUrl,
  type AdminDashboardSummary,
  type DashboardBookingStatusKey,
  type DashboardEnquiryStatusKey,
  type DashboardMetricKey,
  type DashboardRecentBooking,
  type DashboardTopDestination,
  type DashboardUpcomingTour,
} from "@/lib/dashboard";
import { cn } from "@/lib/utils";

type MetricConfig = {
  key: DashboardMetricKey;
  label: string;
  icon: LucideIcon;
  tone: string;
};

type QuickAction = {
  label: string;
  href: string;
  icon: LucideIcon;
  tone: string;
};

type StatusConfig = {
  color: string;
  dot: string;
  label: string;
};

type EnquiryConfig = {
  icon: LucideIcon;
  label: string;
  tone: string;
};

const metricConfigs: MetricConfig[] = [
  {
    key: "totalBookings",
    label: "Total Bookings",
    icon: Ticket,
    tone: "bg-primary/10 text-primary",
  },
  {
    key: "upcomingTours",
    label: "Upcoming Tours",
    icon: CalendarDays,
    tone: "bg-orange-100 text-orange-600",
  },
  {
    key: "totalDestinations",
    label: "Total Destinations",
    icon: MapPin,
    tone: "bg-emerald-100 text-emerald-600",
  },
  {
    key: "totalUsers",
    label: "Total Users",
    icon: Users,
    tone: "bg-violet-100 text-violet-600",
  },
  {
    key: "totalEnquiries",
    label: "Total Enquiries",
    icon: MessageCircle,
    tone: "bg-amber-100 text-amber-600",
  },
];

const quickActions: QuickAction[] = [
  {
    label: "Add Destination",
    href: "/destinations",
    icon: MapPin,
    tone: "text-primary",
  },
  {
    label: "Add Tour",
    href: "/tours",
    icon: CalendarDays,
    tone: "text-orange-600",
  },
  {
    label: "Edit Pages",
    href: "/pages",
    icon: Pencil,
    tone: "text-orange-500",
  },
  {
    label: "Add Expert",
    href: "/experts",
    icon: UserRoundCheck,
    tone: "text-blue-600",
  },
  {
    label: "View Enquiries",
    href: "/enquiries",
    icon: MessageCircle,
    tone: "text-violet-600",
  },
  {
    label: "View Bookings",
    href: "/bookings",
    icon: Ticket,
    tone: "text-primary",
  },
  
];

const statusConfig: Record<DashboardBookingStatusKey, StatusConfig> = {
  cancelled: {
    color: "#ef4444",
    dot: "bg-red-500",
    label: "Cancelled",
  },
  completed: {
    color: "#3b82f6",
    dot: "bg-blue-500",
    label: "Completed",
  },
  confirmed: {
    color: "#44b96d",
    dot: "bg-emerald-500",
    label: "Confirmed",
  },
  pending: {
    color: "#ff9f2e",
    dot: "bg-orange-400",
    label: "Pending",
  },
  refunded: {
    color: "#8b5cf6",
    dot: "bg-violet-500",
    label: "Refunded",
  },
};

const enquiryConfig: Record<DashboardEnquiryStatusKey, EnquiryConfig> = {
  closed: {
    label: "Closed",
    icon: XCircle,
    tone: "bg-violet-100 text-violet-700",
  },
  inProgress: {
    label: "In Progress",
    icon: Clock3,
    tone: "bg-amber-100 text-amber-700",
  },
  new: {
    label: "New Enquiries",
    icon: Mail,
    tone: "bg-primary/10 text-primary",
  },
  replied: {
    label: "Replied",
    icon: CheckCircle2,
    tone: "bg-emerald-100 text-emerald-700",
  },
};

const statusClassNames: Record<DashboardBookingStatusKey, string> = {
  cancelled: "bg-red-100 text-red-700",
  completed: "bg-blue-100 text-blue-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  refunded: "bg-violet-100 text-violet-700",
};

const avatarTones = [
  "bg-[#7a3b22]",
  "bg-primary",
  "bg-amber-700",
  "bg-emerald-700",
  "bg-violet-700",
];

const numberFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 0,
  style: "currency",
});

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value || 0);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return `${Number(value.toFixed(1))}%`;
}

function getDashboardErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unable to load dashboard data.";
}

function getDisplayName(user: AdminUser | null) {
  if (!user) {
    return "Admin";
  }

  const name = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return name || user.email.split("@")[0] || "Admin";
}

function getInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase() || "AU";
}

export default function DashboardPage() {
  const toast = useToast();
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setIsLoading(true);
      setLoadError("");

      try {
        const response = await getAdminDashboardSummary();

        if (isMounted) {
          setSummary(response.data);
        }
      } catch (error) {
        const message = getDashboardErrorMessage(error);

        if (isMounted) {
          setLoadError(message);
          setSummary(null);
        }

        toast.error("Dashboard unavailable", message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  return (
    <AdminDashboardShell activeLabel="Dashboard">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <DashboardHeader
          isLoading={isLoading}
          notificationCount={summary?.notificationCount ?? 0}
        />

        {loadError ? (
          <div className="rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
            {loadError}
          </div>
        ) : null}

        <section
          data-admin-metric-grid
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
        >
          {metricConfigs.map((config) => (
            <MetricCard
              key={config.key}
              config={config}
              isLoading={isLoading}
              metric={summary?.metrics[config.key]}
            />
          ))}
        </section>

        <DashboardPanel title="Quick Actions" className="p-3.5 sm:p-4">
          <QuickActions />
        </DashboardPanel>

        <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr_0.85fr]">
          <UpcomingTours
            isLoading={isLoading}
            tours={summary?.upcomingTours ?? []}
          />
          <BookingsOverview
            buckets={summary?.bookingChart ?? []}
            isLoading={isLoading}
          />
          <EnquiriesOverview
            isLoading={isLoading}
            stats={summary?.enquiryStats ?? []}
          />
        </section>
      </div>
    </AdminDashboardShell>
  );
}

function DashboardHeader({
  isLoading,
  notificationCount,
}: {
  isLoading: boolean;
  notificationCount: number;
}) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    const syncAdminUser = () => {
      setAdminUser(getAdminSession()?.user ?? null);
    };

    syncAdminUser();

    return listenForAdminSessionChanges(syncAdminUser);
  }, []);

  const displayName = getDisplayName(adminUser);
  const initials = getInitials(displayName);

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    </header>
  );
}

function MetricCard({
  config,
  isLoading,
  metric,
}: {
  config: MetricConfig;
  isLoading: boolean;
  metric?: AdminDashboardSummary["metrics"][DashboardMetricKey];
}) {
  const Icon = config.icon;

  return (
    <div className="rounded-sm border border-border bg-white p-4 shadow-sm shadow-stone-200/40">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-full",
            config.tone
          )}
        >
          <Icon className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground/60">
            {config.label}
          </p>
          {isLoading ? (
            <SkeletonLine className="mt-2 h-7 w-20" />
          ) : (
            <p className="mt-1 text-2xl font-bold leading-none text-foreground">
              {formatNumber(metric?.value ?? 0)}
            </p>
          )}
          {isLoading ? (
            <SkeletonLine className="mt-3 h-3 w-28" />
          ) : (
            <p
              className={cn(
                "mt-2 text-[11px] font-semibold",
                metric?.trend.startsWith("-")
                  ? "text-red-600"
                  : "text-emerald-600"
              )}
            >
              {metric?.trend ?? "0% from last month"}
            </p>
          )}
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

function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-flow-col sm:auto-cols-[minmax(150px,1fr)] sm:overflow-x-auto sm:pb-1 sm:[-ms-overflow-style:none] sm:[scrollbar-width:none] xl:grid-flow-row xl:grid-cols-6 xl:auto-cols-auto xl:overflow-visible xl:pb-0 sm:[&::-webkit-scrollbar]:hidden">
      {quickActions.map((action) => {
        const Icon = action.icon;

        const label = action.label.startsWith("Add ")
          ? `+ ${action.label}`
          : action.label;

        const isViewBooking = action.label === "View Bookings";

        return (
          <Link
            key={action.label}
            href={action.href}
            data-slot="button"
            className={cn(
              buttonVariants({
                variant: isViewBooking ? "default" : "outline",
              }),
              "group h-11 w-full cursor-pointer justify-start rounded-sm px-3 text-left text-xs font-semibold transition-colors",

              isViewBooking
                ? "border border-primary bg-primary text-primary-foreground hover:border-primary hover:bg-white hover:text-primary"
                : "border-border bg-white text-foreground hover:border-primary hover:bg-primary/5 hover:text-primary"
            )}
          >
            <span className="grid w-5 shrink-0 place-items-center">
              <Icon
                className={cn(
                  "size-4 transition-colors",
                  isViewBooking
                    ? "text-primary-foreground group-hover:text-primary"
                    : action.tone
                )}
              />
            </span>

            <span className="min-w-0 truncate">
              {label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function BookingsOverview({
  buckets,
  isLoading,
}: {
  buckets: AdminDashboardSummary["bookingChart"];
  isLoading: boolean;
}) {
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

      {isLoading ? (
        <SkeletonBlock className="h-[220px]" />
      ) : (
        <BookingLineChart buckets={buckets} />
      )}
    </DashboardPanel>
  );
}

function BookingLineChart({
  buckets,
}: {
  buckets: AdminDashboardSummary["bookingChart"];
}) {
  const visibleBuckets =
    buckets.length > 0
      ? buckets
      : [{ current: 0, label: "This month", previous: 0 }];
  const maxValue = Math.max(
    1,
    ...visibleBuckets.flatMap((bucket) => [bucket.current, bucket.previous])
  );
  const chartLeft = 48;
  const chartRight = 528;
  const chartTop = 35;
  const chartBottom = 200;
  const chartHeight = chartBottom - chartTop;
  const step = visibleBuckets.length > 1
    ? (chartRight - chartLeft) / (visibleBuckets.length - 1)
    : 0;
  const getY = (value: number) =>
    chartBottom - (value / maxValue) * chartHeight;
  const createPoints = (key: "current" | "previous") =>
    visibleBuckets
      .map((bucket, index) => {
        const x = chartLeft + index * step;
        const y = getY(bucket[key]);

        return `${x},${y}`;
      })
      .join(" ");
  const guideValues = [0, 0.25, 0.5, 0.75, 1].map((ratio) =>
    Math.round(maxValue * ratio)
  );

  return (
    <div className="h-[220px] w-full">
      <svg
        className="h-full w-full"
        viewBox="0 0 560 240"
        role="img"
        aria-label="Bookings overview line chart"
      >
        {guideValues.map((value, index) => {
          const y = chartBottom - index * (chartHeight / 4);

          return (
            <g key={`${value}-${index}`}>
              <line
                x1="45"
                x2="535"
                y1={y}
                y2={y}
                stroke="#ece2da"
                strokeWidth="1"
              />
              <text x="18" y={y + 4} fill="#8f8178" fontSize="12">
                {value}
              </text>
            </g>
          );
        })}
        <polyline
          fill="none"
          points={createPoints("current")}
          stroke="#e6650a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
        />
        <polyline
          fill="none"
          points={createPoints("previous")}
          stroke="#cfd3d6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
        />
        {visibleBuckets.map((bucket, index) => {
          const x = chartLeft + index * step;

          return (
            <g key={`${bucket.label}-${index}`}>
              <circle cx={x} cy={getY(bucket.current)} r="5" fill="#e6650a" />
              <circle cx={x} cy={getY(bucket.previous)} r="5" fill="#cfd3d6" />
              <text x={x - 10} y="230" fill="#8f8178" fontSize="12">
                {bucket.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function UpcomingTours({
  isLoading,
  tours,
}: {
  isLoading: boolean;
  tours: DashboardUpcomingTour[];
}) {
  return (
    <DashboardPanel
      title="Upcoming Tours"
      action={<PanelLink href="/tours" label="View All" />}
    >
      {isLoading ? (
        <PanelListSkeleton />
      ) : tours.length > 0 ? (
        <div className="space-y-3">
          {tours.map((tour, index) => (
            <div
              key={tour.departureId}
              className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3"
            >
              <TourThumb image={tour.image} index={index} />
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-foreground">
                  {tour.title}
                </p>
                <p className="mt-1 text-[11px] text-foreground/55">
                  {tour.date}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold leading-none">
                  {formatNumber(tour.bookings)}
                </p>
                <p className="mt-1 text-[10px] font-semibold text-primary">
                  Bookings
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyPanelMessage message="No upcoming departures found." />
      )}
    </DashboardPanel>
  );
}

function EnquiriesOverview({
  isLoading,
  stats,
}: {
  isLoading: boolean;
  stats: AdminDashboardSummary["enquiryStats"];
}) {
  return (
    <DashboardPanel
      title="Enquiries Overview"
      action={<PanelLink href="/enquiries" label="View All" />}
    >
      {isLoading ? (
        <PanelListSkeleton />
      ) : (
        <div className="space-y-4">
          {stats.map((item) => {
            const config = enquiryConfig[item.key];
            const Icon = config.icon;

            return (
              <div
                key={item.key}
                className="flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-sm",
                      config.tone
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="text-xs font-medium text-foreground/75">
                    {config.label}
                  </span>
                </div>
                <span className="text-lg font-bold">
                  {formatNumber(item.value)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </DashboardPanel>
  );
}

function TourThumb({
  image,
  index,
  size = "default",
}: {
  image: string;
  index: number;
  size?: "default" | "sm";
}) {
  const imageUrl = getDashboardMediaUrl(image);
  const fallbackClassName = [
    "from-orange-500 via-amber-300 to-stone-700",
    "from-emerald-500 via-sky-300 to-slate-700",
    "from-amber-500 via-orange-200 to-stone-800",
    "from-green-600 via-lime-200 to-cyan-700",
    "from-violet-500 via-sky-300 to-stone-700",
  ][index % 5];

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-sm bg-gradient-to-br",
        size === "default" ? "h-12 w-16" : "h-9 w-12",
        !imageUrl && fallbackClassName
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="size-full object-cover"
        />
      ) : (
        <>
          <span className="absolute bottom-1 left-1 h-2 w-7 rounded-full bg-white/65" />
          <span className="absolute bottom-3 left-3 h-5 w-5 rounded-sm border border-white/60 bg-white/25" />
          <Plane className="absolute right-1 top-1 size-3 text-white/80" />
        </>
      )}
    </div>
  );
}

function PanelLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs font-bold text-primary transition-colors hover:text-accent"
    >
      {label}
      <Plus className="size-3 rotate-45" />
    </Link>
  );
}

function EmptyPanelMessage({ message }: { message: string }) {
  return (
    <div className="rounded-sm border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-xs font-medium text-foreground/55">
      {message}
    </div>
  );
}

function SkeletonLine({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "block animate-pulse rounded-sm bg-muted",
        className
      )}
    />
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-sm bg-muted",
        className
      )}
    />
  );
}

function PanelListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_item, index) => (
        <div
          key={index}
          className="grid grid-cols-[64px_minmax(0,1fr)_48px] items-center gap-3"
        >
          <SkeletonBlock className="h-12 w-16" />
          <div>
            <SkeletonLine className="h-3 w-32" />
            <SkeletonLine className="mt-2 h-3 w-20" />
          </div>
          <SkeletonLine className="h-5 w-10" />
        </div>
      ))}
    </div>
  );
}
