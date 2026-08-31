"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  UserPlus,
  UserRoundCheck,
  UserX,
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

type UserMetric = {
  label: string;
  value: string;
  trend: string;
  trendClassName: string;
  icon: LucideIcon;
  tone: string;
};

type UserRecord = {
  email: string;
  initials: string;
  joinedOn: string;
  lastActive: string;
  name: string;
  phone: string;
  role: "Customer" | "Travel Agent";
  status: "Active" | "Inactive";
  tone: string;
};

const userMetrics: UserMetric[] = [
  {
    label: "Total Users",
    value: "1,248",
    trend: "+15.4% from Jun 2026",
    trendClassName: "text-emerald-600",
    icon: Users,
    tone: "bg-violet-100 text-violet-700",
  },
  {
    label: "Active Users",
    value: "1,086",
    trend: "87.0% of total users",
    trendClassName: "text-emerald-600",
    icon: UserRoundCheck,
    tone: "bg-emerald-100 text-emerald-700",
  },
  {
    label: "New This Month",
    value: "156",
    trend: "+12.7% from Jun 2026",
    trendClassName: "text-emerald-600",
    icon: UserPlus,
    tone: "bg-amber-100 text-amber-700",
  },
  {
    label: "Verified Users",
    value: "932",
    trend: "74.7% of total users",
    trendClassName: "text-emerald-600",
    icon: BadgeCheck,
    tone: "bg-sky-100 text-sky-700",
  },
  {
    label: "Inactive Users",
    value: "162",
    trend: "13.0% of total users",
    trendClassName: "text-red-600",
    icon: UserX,
    tone: "bg-red-100 text-red-700",
  },
];

const users: UserRecord[] = [
  {
    name: "Rahul Sharma",
    email: "rahul.sharma@gmail.com",
    phone: "+91 98765 43210",
    role: "Customer",
    status: "Active",
    initials: "RS",
    tone: "bg-[#7a3b22]",
    joinedOn: "30-05-2026",
    lastActive: "31-07-2026, 10:30 AM",
  },
  {
    name: "Priya Mehta",
    email: "priya.mehta@gmail.com",
    phone: "+91 87654 32109",
    role: "Customer",
    status: "Active",
    initials: "PM",
    tone: "bg-primary",
    joinedOn: "28-05-2026",
    lastActive: "31-07-2026, 09:15 AM",
  },
  {
    name: "Arjun Verma",
    email: "arjun.verma@gmail.com",
    phone: "+91 76543 21098",
    role: "Customer",
    status: "Active",
    initials: "AV",
    tone: "bg-[#7a3b22]",
    joinedOn: "27-05-2026",
    lastActive: "30-07-2026, 08:45 PM",
  },
  {
    name: "Sneha Iyer",
    email: "sneha.iyer@gmail.com",
    phone: "+91 65432 10987",
    role: "Travel Agent",
    status: "Active",
    initials: "SI",
    tone: "bg-amber-700",
    joinedOn: "24-05-2026",
    lastActive: "31-07-2026, 11:20 AM",
  },
  {
    name: "Karan Patel",
    email: "karan.patel@gmail.com",
    phone: "+91 54321 09876",
    role: "Customer",
    status: "Inactive",
    initials: "KP",
    tone: "bg-[#7a3b22]",
    joinedOn: "18-05-2026",
    lastActive: "20-07-2026, 06:30 PM",
  },
];

const roleOptions = ["All Roles", "Customer", "Travel Agent"];
const statusOptions = ["All Status", "Active", "Inactive"];
const registrationOptions = ["All Time", "Today", "This Week", "This Month"];

export default function UsersPage() {
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("All Roles");
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [selectedRegistration, setSelectedRegistration] = useState("All Time");

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch = query
        ? [user.name, user.email, user.phone, user.role, user.status]
            .join(" ")
            .toLowerCase()
            .includes(query)
        : true;
      const matchesRole = selectedRole === "All Roles" || user.role === selectedRole;
      const matchesStatus =
        selectedStatus === "All Status" || user.status === selectedStatus;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [searchQuery, selectedRole, selectedStatus]);

  return (
    <AdminDashboardShell activeLabel="Users">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <UsersHeader
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
        />

        <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-sans text-2xl font-bold tracking-normal text-foreground">
              User&apos;s
            </h1>
            <p className="mt-1 text-sm text-foreground/60">
              Manage all registered users of Ancient Trails.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => toast.info("Add User", "User form will open here.")}
            className="h-11 rounded-sm px-4 text-xs font-bold"
          >
            <Plus className="size-4" data-icon="inline-start" />
            Add New User
          </Button>
        </section>

        <section
          data-admin-metric-grid
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
        >
          {userMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </section>

        <section className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
          <UsersToolbar
            searchQuery={searchQuery}
            selectedRegistration={selectedRegistration}
            selectedRole={selectedRole}
            selectedStatus={selectedStatus}
            onRegistrationChange={setSelectedRegistration}
            onRoleChange={setSelectedRole}
            onSearchQueryChange={setSearchQuery}
            onStatusChange={setSelectedStatus}
          />
          <UsersTable users={filteredUsers} />
        </section>
      </div>
    </AdminDashboardShell>
  );
}

function UsersHeader({
  onSearchQueryChange,
  searchQuery,
}: {
  onSearchQueryChange: (value: string) => void;
  searchQuery: string;
}) {
  const toast = useToast();

  return (
    <header className="hidden flex-col gap-4 border-b border-border pb-4 md:flex xl:flex-row xl:items-center xl:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <AdminSidebarToggle />
        <div className="min-w-0">
          <h2 className="font-sans text-lg font-bold tracking-normal">
            Users
          </h2>
          <div className="mt-1 flex items-center gap-2 text-xs text-foreground/55">
            <span>Dashboard</span>
            <span aria-hidden="true">&gt;</span>
            <span className="font-medium text-foreground/75">Users</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[220px] flex-1 sm:flex-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
          <input
            className="h-10 w-full rounded-sm border border-border bg-white pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-foreground/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
            placeholder="Search users..."
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </label>
        <button
          onClick={() =>
            toast.info("Notifications", "You have 3 user notifications.")
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

function MetricCard({ metric }: { metric: UserMetric }) {
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

function UsersToolbar({
  onRegistrationChange,
  onRoleChange,
  onSearchQueryChange,
  onStatusChange,
  searchQuery,
  selectedRegistration,
  selectedRole,
  selectedStatus,
}: {
  onRegistrationChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onSearchQueryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  searchQuery: string;
  selectedRegistration: string;
  selectedRole: string;
  selectedStatus: string;
}) {
  return (
    <div className="grid gap-3 border-b border-border p-4 xl:grid-cols-[minmax(260px,1fr)_170px_170px_170px_120px] xl:items-end">
      <label className="relative min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
        <input
          className="h-10 w-full rounded-sm border border-border bg-white pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-foreground/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
          placeholder="Search by name, email or phone..."
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
        />
      </label>
      <ToolbarSelect
        label="Role"
        options={roleOptions}
        value={selectedRole}
        onChange={onRoleChange}
      />
      <ToolbarSelect
        label="Status"
        options={statusOptions}
        value={selectedStatus}
        onChange={onStatusChange}
      />
      <ToolbarSelect
        label="Registration Date"
        options={registrationOptions}
        value={selectedRegistration}
        onChange={onRegistrationChange}
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
      <span className="text-[11px] font-semibold text-foreground/55">
        {label}
      </span>
      <Select
        value={value}
        onValueChange={(nextValue) => onChange(String(nextValue || value))}
      >
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

function UsersTable({ users: visibleUsers }: { users: UserRecord[] }) {
  return (
    <>
      <div className="max-w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[13%]" />
            <col className="w-[15%]" />
            <col className="w-[13%]" />
            <col className="w-[15%]" />
            <col className="w-[16%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead className="bg-muted/35 text-[11px] uppercase text-foreground/55">
            <tr>
              <th className="px-4 py-3 font-bold">User</th>
              <th className="px-4 py-3 font-bold">Role</th>
              <th className="px-4 py-3 font-bold">Phone</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold">Joined On</th>
              <th className="px-4 py-3 font-bold">Last Active</th>
              <th className="px-4 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.length ? (
              visibleUsers.map((user) => (
                <tr
                  key={user.email}
                  className="border-t border-border transition-colors hover:bg-muted/25"
                >
                  <td data-label="User" data-mobile-primary className="px-4 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white",
                          user.tone
                        )}
                      >
                        {user.initials}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-foreground">
                          {user.name}
                        </p>
                        <p className="mt-1 truncate text-[11px] text-foreground/55">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td data-label="Role" className="px-4 py-4">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold",
                        user.role === "Customer"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-sky-100 text-sky-700"
                      )}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td
                    data-label="Phone"
                    className="px-4 py-4 text-xs font-semibold text-foreground/70"
                  >
                    {user.phone}
                  </td>
                  <td data-label="Status" className="px-4 py-4">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold",
                        user.status === "Active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      )}
                    >
                      <span className="mr-1.5 mt-1 size-1.5 rounded-full bg-current" />
                      {user.status}
                    </span>
                  </td>
                  <td
                    data-label="Joined On"
                    className="px-4 py-4 text-xs font-semibold text-foreground/70"
                  >
                    {user.joinedOn}
                  </td>
                  <td
                    data-label="Last Active"
                    className="px-4 py-4 text-xs font-semibold text-foreground/70"
                  >
                    {user.lastActive}
                  </td>
                  <td data-actions data-label="Actions" className="px-4 py-4">
                    <UserActions user={user} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="px-5 py-8 text-center text-xs text-foreground/55"
                  colSpan={7}
                >
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TableFooter label="users" showing="1 to 10" total="1,248" lastPage="125" />
    </>
  );
}

function UserActions({ user }: { user: UserRecord }) {
  const toast = useToast();

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="grid size-10 place-items-center rounded-full border border-border bg-white text-foreground/65 transition-colors hover:border-primary hover:text-primary"
              aria-label={`Open actions for ${user.name}`}
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
            onClick={() => toast.info("View User", `${user.name} details.`)}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            View
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => toast.info("Edit User", `${user.name} can be edited.`)}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              toast.info("User Status", `${user.name} status can be changed.`)
            }
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            Change Status
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TableFooter({
  label,
  lastPage,
  showing,
  total,
}: {
  label: string;
  lastPage: string;
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
        <PaginationButton label={`Page ${lastPage}`}>{lastPage}</PaginationButton>
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
