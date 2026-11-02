"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Search,
  UserPlus,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  AdminDashboardShell,
  AdminSidebarToggle,
} from "@/components/admin-dashboard/admin-dashboard-shell";
import { AdminMobileFilter } from "@/components/admin-dashboard/admin-mobile-filter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { listAdminUsers, updateAdminUser, type AdminDirectoryUser, type AdminUserStats, type AdminUserUpdate } from "@/lib/users";
import { AddAdminUserDialog } from "@/components/add-admin-user-dialog";
import { getAdminSession, listenForAdminSessionChanges } from "@/lib/admin-auth";
import { adminTabOptions } from "@/lib/admin-access";

type UserMetric = {
  label: string;
  value: string;
  trend: string;
  trendClassName: string;
  icon: LucideIcon;
  tone: string;
};

type UserRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  initials: string;
  joinedOn: string;
  lastActive: string;
  name: string;
  phone: string;
  role: "Traveller" | "Expert" | "Staff" | "Admin";
  status: "Active" | "Inactive";
  tone: string;
  createdAt: string;
  profession?: string;
  adminTabs?: string[];
};
const roleOptions = ["All Roles", "Admin", "Staff"];
const statusOptions = ["All Status", "Active", "Inactive"];
const registrationOptions = ["All Time", "Today", "This Week", "This Month"];

function toUserRecord(user: AdminDirectoryUser): UserRecord {
  const profileName = [user.firstName, user.lastName].map((part) => part?.trim()).filter(Boolean).join(" ");
  const name = profileName || "Profile incomplete";
  const adminRole = user.roles.find((role) => role !== "traveller" && role !== "super_admin");
  const role = adminRole === "expert"
    ? "Expert"
    : adminRole === "staff"
      ? "Staff"
      : adminRole
        ? "Admin"
        : "Traveller";

  return {
    id: user.id,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    name,
    email: user.email,
    phone: user.mobileNumber,
    role,
    status: user.status === "active" ? "Active" : "Inactive",
    initials: profileName ? profileName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() : "TR",
    tone: role === "Traveller" ? "bg-primary" : "bg-sky-700",
    joinedOn: new Date(user.createdAt).toLocaleDateString("en-GB"),
    lastActive: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("en-GB") : "Never",
    createdAt: user.createdAt,
    profession: user.profession,
    adminTabs: user.adminTabs,
  };
}

export default function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [stats, setStats] = useState<AdminUserStats>({
    travellers: { total: 0, adults: 0, children: 0, newThisMonth: 0 },
    admins: { expert: 0, staff: 0, admin: 0 },
  });
  const [activeTab, setActiveTab] = useState<"traveller" | "admin">("traveller");
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("All Roles");
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [selectedRegistration, setSelectedRegistration] = useState("All Time");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);

  useEffect(() => {
    const sync = () => setIsSuperAdmin(Boolean(getAdminSession()?.user.roles.includes("super_admin")));
    sync();
    return listenForAdminSessionChanges(sync);
  }, []);

  useEffect(() => {
    async function loadUsers() {
      try {
        const response = await listAdminUsers();
        setUsers(response.data.users.map(toUserRecord));
        setStats(response.data.stats);
      } catch (error) {
        toast.error("Unable to load users", error instanceof Error ? error.message : "Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadUsers();
  }, []);

  const tabUsers = users.filter((user) =>
    activeTab === "traveller" ? user.role === "Traveller" : user.role !== "Traveller"
  );

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return tabUsers.filter((user) => {
      const matchesSearch = query
        ? [user.name, user.email, user.phone, user.role, user.status]
            .join(" ")
            .toLowerCase()
            .includes(query)
        : true;
      const matchesRole = activeTab === "traveller" || selectedRole === "All Roles" || user.role === selectedRole;
      const matchesStatus =
        selectedStatus === "All Status" || user.status === selectedStatus;
      const createdAt = new Date(user.createdAt);
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const matchesRegistration = selectedRegistration === "All Time" ||
        (createdAt <= now && selectedRegistration === "Today" && createdAt >= startOfToday) ||
        (createdAt <= now && selectedRegistration === "This Week" && createdAt >= startOfWeek) ||
        (createdAt <= now && selectedRegistration === "This Month" && createdAt >= startOfMonth);

      return matchesSearch && matchesRole && matchesStatus && matchesRegistration;
    });
  }, [activeTab, searchQuery, selectedRole, selectedStatus, selectedRegistration, tabUsers]);

  const userMetrics: UserMetric[] = activeTab === "traveller"
    ? [
        { label: "Total Users", value: String(stats.travellers.total), trend: "", trendClassName: "", icon: Users, tone: "bg-violet-100 text-violet-700" },
        { label: "Total Adults", value: String(stats.travellers.adults), trend: "", trendClassName: "", icon: UserRoundCheck, tone: "bg-emerald-100 text-emerald-700" },
        { label: "Total Children", value: String(stats.travellers.children), trend: "", trendClassName: "", icon: UserPlus, tone: "bg-amber-100 text-amber-700" },
        { label: "New This Month", value: String(stats.travellers.newThisMonth), trend: "", trendClassName: "", icon: BadgeCheck, tone: "bg-sky-100 text-sky-700" },
      ]
    : [
        { label: "Total Expert", value: String(stats.admins.expert), trend: "", trendClassName: "", icon: UserRoundCheck, tone: "bg-violet-100 text-violet-700" },
        { label: "Total Staff", value: String(stats.admins.staff), trend: "", trendClassName: "", icon: Users, tone: "bg-emerald-100 text-emerald-700" },
        { label: "Total Admin", value: String(stats.admins.admin), trend: "", trendClassName: "", icon: BadgeCheck, tone: "bg-amber-100 text-amber-700" },
      ];

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
          <div className="flex gap-2">
            <Button type="button" variant={activeTab === "traveller" ? "default" : "outline"} onClick={() => setActiveTab("traveller")} className="h-11 rounded-sm px-4 text-xs font-bold">Traveller</Button>
            <Button type="button" variant={activeTab === "admin" ? "default" : "outline"} onClick={() => setActiveTab("admin")} className="h-11 rounded-sm px-4 text-xs font-bold">Admin</Button>
          </div>
        </section>

        <section
          data-admin-metric-grid
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
        >
          {userMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
          {activeTab === "admin" && isSuperAdmin ? <div className="flex items-center justify-end sm:col-span-2 xl:col-span-2">
            <Button type="button" onClick={() => setIsAddAdminOpen(true)} className="h-11 rounded-sm px-4 text-xs font-bold"><UserPlus className="size-4" />Add Admin User</Button>
          </div> : null}
        </section>

        <section className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
          <UsersToolbar
            showRole={activeTab !== "traveller"}
            searchQuery={searchQuery}
            selectedRegistration={selectedRegistration}
            selectedRole={activeTab === "traveller" ? selectedRole : "All Roles"}
            selectedStatus={selectedStatus}
            onRegistrationChange={setSelectedRegistration}
            onRoleChange={setSelectedRole}
            onSearchQueryChange={setSearchQuery}
            onStatusChange={setSelectedStatus}
          />
          <UsersTable showRole={activeTab !== "traveller"} users={filteredUsers} isLoading={isLoading} onUserUpdated={(updatedUser) => {
            setUsers((current) => current.map((user) => user.id === updatedUser.id ? toUserRecord(updatedUser) : user));
          }} />
        </section>
        {isAddAdminOpen && isSuperAdmin ? <AddAdminUserDialog onClose={() => setIsAddAdminOpen(false)} onCreated={(user) => {
          setUsers((current) => [toUserRecord(user), ...current.filter((item) => item.id !== user.id)]);
          setStats((current) => ({ ...current, admins: {
            ...current.admins,
            admin: current.admins.admin + (user.roles.includes("admin") ? 1 : 0),
            staff: current.admins.staff + (user.roles.includes("staff") ? 1 : 0),
            expert: current.admins.expert + (user.roles.includes("expert") ? 1 : 0),
          } }));
        }} /> : null}
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
  showRole,
  onRegistrationChange,
  onRoleChange,
  onSearchQueryChange,
  onStatusChange,
  searchQuery,
  selectedRegistration,
  selectedRole,
  selectedStatus,
}: {
  showRole: boolean;
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
    <AdminMobileFilter label="Users">
    <div className={cn("grid gap-3 border-b border-border p-4 xl:items-end", showRole
      ? "xl:grid-cols-[minmax(260px,1fr)_170px_170px_170px]"
      : "xl:grid-cols-[minmax(260px,1fr)_170px_170px]")}
    >
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
      {showRole ? <ToolbarSelect
        label="Role"
        options={roleOptions}
        value={selectedRole}
        onChange={onRoleChange}
      /> : null}
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
    </div>
    </AdminMobileFilter>
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

function UsersTable({
  showRole,
  users: visibleUsers,
  isLoading,
  onUserUpdated,
}: {
  showRole: boolean;
  users: UserRecord[];
  isLoading: boolean;
  onUserUpdated: (user: AdminDirectoryUser) => void;
}) {
  const [action, setAction] = useState<{ user: UserRecord; mode: UserActionMode } | null>(null);

  return (
    <>
      <div className="max-w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className={showRole ? "w-[22%]" : "w-[35%]"} />
            {showRole ? <col className="w-[13%]" /> : null}
            <col className="w-[15%]" />
            <col className="w-[13%]" />
            <col className="w-[15%]" />
            <col className="w-[16%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead className="bg-muted/35 text-[11px] uppercase text-foreground/55">
            <tr>
              <th className="px-4 py-3 font-bold">User</th>
              {showRole ? <th className="px-4 py-3 font-bold">Profession</th> : null}
              <th className="px-4 py-3 font-bold">Phone</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold">Joined On</th>
              <th className="px-4 py-3 font-bold">Last Active</th>
              <th className="px-4 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-5 py-8 text-center text-xs text-foreground/55" colSpan={showRole ? 7 : 6}>
                  Loading users...
                </td>
              </tr>
            ) : visibleUsers.length ? (
              visibleUsers.map((user) => (
                <tr
                  key={user.id}
                  onClick={(event) => {
                    if (shouldOpenTableRow(event)) {
                      setAction({ user, mode: "view" });
                    }
                  }}
                  className="cursor-pointer border-t border-border transition-colors hover:bg-muted/25"
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
                          {user.email || "Email not provided"}
                        </p>
                      </div>
                    </div>
                  </td>
                  {showRole ? <td data-label="Profession" className="px-4 py-4">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold",
                        "bg-sky-100 text-sky-700"
                      )}
                    >
                      {user.profession || "—"}
                    </span>
                  </td> : null}
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
                    <UserActions user={user} onAction={(mode) => setAction({ user, mode })} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="px-5 py-8 text-center text-xs text-foreground/55"
                  colSpan={showRole ? 7 : 6}
                >
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TableFooter label="users" showing={visibleUsers.length ? `1 to ${visibleUsers.length}` : "0"} total={String(visibleUsers.length)} />
      {action ? <UserDetailsDialog key={`${action.user.id}-${action.mode}`} user={action.user} mode={action.mode}
        onClose={() => setAction(null)} onUserUpdated={onUserUpdated} /> : null}
    </>
  );
}

type UserActionMode = "view" | "edit" | "status";

function UserActions({ user, onAction }: { user: UserRecord; onAction: (mode: UserActionMode) => void }) {

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
            onClick={() => onAction("view")}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            View
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onAction("edit")}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            Edit
          </DropdownMenuItem>
          {user.role !== "Traveller" ? <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onAction("status")}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            Change Status
          </DropdownMenuItem>
          </> : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function UserDetailsDialog({ user, mode, onClose, onUserUpdated }: {
  user: UserRecord;
  mode: UserActionMode;
  onClose: () => void;
  onUserUpdated: (user: AdminDirectoryUser) => void;
}) {
  const toast = useToast();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [profession, setProfession] = useState(user.profession || "");
  const [role, setRole] = useState<"admin" | "staff" | "expert">(user.role === "Staff" ? "staff" : user.role === "Expert" ? "expert" : "admin");
  const [status, setStatus] = useState<"active" | "blocked">(user.status === "Active" ? "active" : "blocked");
  const [adminTabs, setAdminTabs] = useState<string[]>(user.adminTabs ?? adminTabOptions.map((tab) => tab.key));
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const nextStatus = user.status === "Active" ? "blocked" : "active";

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving || mode === "view") return;
    setError("");
    if (mode === "edit" && user.role !== "Traveller" && adminTabs.length === 0) {
      setError("Select at least one dashboard tab.");
      return;
    }
    setIsSaving(true);
    try {
      const changes: AdminUserUpdate = mode === "status" ? { status: nextStatus } : {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        mobileNumber: phone.trim(),
        status,
        ...(user.role !== "Traveller" ? {
          profession: profession.trim(),
          role,
          adminTabs,
        } : {}),
        ...(password ? { password } : {}),
      };
      const response = await updateAdminUser(user.id, changes);
      onUserUpdated(response.data.user);
      toast.success("User updated", response.message);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to update user. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !isSaving) onClose(); }}>
    <DialogContent showCloseButton={!isSaving} className={cn(mode === "edit" ? "flex h-[90dvh] max-h-[90dvh] flex-col overflow-hidden sm:max-w-lg" : "sm:max-w-md")}>
      <DialogHeader className={cn(mode === "edit" && "shrink-0 border-b border-border pb-3 pr-8")}>
        <DialogTitle>{mode === "view" ? "User Details" : mode === "edit" ? "Edit User" : "Change User Status"}</DialogTitle>
        <DialogDescription>{user.name}</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSave} data-admin-ignore-save-reminder="true" className={cn(mode === "edit" ? "flex min-h-0 flex-1 flex-col gap-4 overflow-hidden" : "grid gap-4")}>
        <div className={cn(mode === "edit" && "min-h-0 flex-1 space-y-4 overflow-y-auto pt-4")}>
        {mode === "edit" ? <>
          <label className="grid gap-1.5 text-xs font-semibold">First Name
            <input value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={80} disabled={isSaving}
              className="h-10 rounded-sm border border-border px-3 text-sm font-normal" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold">Last Name
            <input value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={80} disabled={isSaving}
              className="h-10 rounded-sm border border-border px-3 text-sm font-normal" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold">Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} disabled={isSaving}
              className="h-10 rounded-sm border border-border px-3 text-sm font-normal" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold">Phone Number
            <input type="tel" inputMode="numeric" pattern={user.role === "Traveller" ? "[0-9]{10,15}" : "[0-9]{10}"} maxLength={user.role === "Traveller" ? 15 : 10} value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, user.role === "Traveller" ? 15 : 10))} disabled={isSaving}
              className="h-10 rounded-sm border border-border px-3 text-sm font-normal" />
          </label>
          {user.role !== "Traveller" ? <>
            <label className="grid gap-1.5 text-xs font-semibold">Profession
              <input value={profession} onChange={(event) => setProfession(event.target.value)} maxLength={120} disabled={isSaving} className="h-10 rounded-sm border border-border px-3 text-sm font-normal" />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold">Role
              <select value={role} onChange={(event) => setRole(event.target.value as "admin" | "staff" | "expert")} disabled={isSaving} className="h-10 rounded-sm border border-border bg-white px-3 text-sm font-normal">
                <option value="admin">Admin</option><option value="staff">Staff</option><option value="expert">Expert</option>
              </select>
            </label>
            <fieldset className="grid gap-2">
              <legend className="text-xs font-semibold">Dashboard Tab Access</legend>
              <div className="grid grid-cols-2 gap-2">{adminTabOptions.map((tab) => <label key={tab.key} className="flex items-center gap-2 rounded-sm border border-border px-3 py-2 text-xs font-medium"><input type="checkbox" checked={adminTabs.includes(tab.key)} disabled={isSaving} onChange={(event) => setAdminTabs(current => event.target.checked ? [...current, tab.key] : current.filter(key => key !== tab.key))} className="size-4 accent-primary" />{tab.label}</label>)}</div>
            </fieldset>
            <label className="grid gap-1.5 text-xs font-semibold">New Password (optional)
              <input type="password" minLength={12} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} disabled={isSaving} className="h-10 rounded-sm border border-border px-3 text-sm font-normal" />
              <span className="font-normal text-foreground/60">Leave blank to keep the current password.</span>
            </label>
          </> : null}
          <label className="grid gap-1.5 text-xs font-semibold">Status
            <select value={status} onChange={(event) => setStatus(event.target.value as "active" | "blocked")} disabled={isSaving} className="h-10 rounded-sm border border-border bg-white px-3 text-sm font-normal">
              <option value="active">Active</option><option value="blocked">Inactive</option>
            </select>
          </label>
        </> : mode === "status" ? <p className="text-sm text-foreground/75">
          {nextStatus === "blocked" ? "Deactivate" : "Activate"} this user account?
        </p> : <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
          <dt className="text-foreground/60">Name</dt><dd className="break-words">{user.name}</dd>
          <dt className="text-foreground/60">Email</dt><dd className="break-all">{user.email || "Not provided"}</dd>
          <dt className="text-foreground/60">Phone</dt><dd>{user.phone || "Not provided"}</dd>
          <dt className="text-foreground/60">Role</dt><dd>{user.role}</dd>
          {user.role !== "Traveller" ? <>
            <dt className="text-foreground/60">Profession</dt><dd>{user.profession || "Not provided"}</dd>
            <dt className="text-foreground/60">Tab Access</dt><dd>{user.adminTabs === undefined ? "All tabs" : adminTabOptions.filter((tab) => user.adminTabs?.includes(tab.key)).map((tab) => tab.label).join(", ") || "None"}</dd>
          </> : null}
          <dt className="text-foreground/60">Status</dt><dd>{user.status}</dd>
          <dt className="text-foreground/60">Joined On</dt><dd>{user.joinedOn}</dd>
          <dt className="text-foreground/60">Last Active</dt><dd>{user.lastActive}</dd>
        </dl>}
        </div>
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        <DialogFooter className={cn(mode === "edit" && "shrink-0")}>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>{mode === "view" ? "Close" : "Cancel"}</Button>
          {mode !== "view" ? <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : mode === "edit" ? "Save Changes" : nextStatus === "blocked" ? "Deactivate" : "Activate"}
          </Button> : null}
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
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
        <PaginationButton label="Page 1" active disabled>1</PaginationButton>
        <PaginationButton label="Next page" disabled>
          <ChevronRight className="size-4" />
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
