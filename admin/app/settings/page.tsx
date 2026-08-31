"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { useState } from "react";
import {
  Bell,
  BellRing,
  CalendarDays,
  ChevronDown,
  CreditCard,
  DatabaseBackup,
  Globe,
  Mail,
  Save,
  Settings,
  ShieldCheck,
  Upload,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  AdminDashboardShell,
  AdminSidebarToggle,
} from "@/components/admin-dashboard/admin-dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type SettingsTab = {
  icon: LucideIcon;
  label: string;
};

const settingsTabs: SettingsTab[] = [
  { label: "General", icon: Settings },
  { label: "Profile", icon: UserRound },
  { label: "Website", icon: Globe },
  { label: "Email", icon: Mail },
  { label: "Booking", icon: CalendarDays },
  { label: "Payments", icon: CreditCard },
  { label: "Notifications", icon: BellRing },
  { label: "Security", icon: ShieldCheck },
  { label: "Backup", icon: DatabaseBackup },
];

const inputClassName =
  "h-9 rounded-sm border border-border bg-white px-3 text-xs font-medium text-foreground outline-none transition-colors placeholder:text-foreground/40 focus:border-primary focus:ring-3 focus:ring-primary/15";
const textareaClassName =
  "min-h-24 rounded-sm border border-border bg-white px-3 py-2 text-xs font-medium text-foreground outline-none transition-colors placeholder:text-foreground/40 focus:border-primary focus:ring-3 focus:ring-primary/15";

export default function SettingsPage() {
  const toast = useToast();
  const [siteName, setSiteName] = useState("Ancient Trails");
  const [tagline, setTagline] = useState("A Quest for Indian Heritage");
  const [adminEmail, setAdminEmail] = useState("admin@ancienttrails.com");
  const [contactPhone, setContactPhone] = useState("+91 98765 43210");
  const [timezone, setTimezone] = useState("(GMT+05:30) Asia/Kolkata");
  const [dateFormat, setDateFormat] = useState("31-07-2026 (DD-MM-YYYY)");
  const [footerText, setFooterText] = useState(
    "© 2026 Ancient Trails. All rights reserved.\nA Quest for Indian Heritage."
  );
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    "We are currently updating our site.\nPlease check back soon!"
  );
  const [socialLinks, setSocialLinks] = useState({
    facebook: "https://www.facebook.com/ancienttrails",
    instagram: "https://www.instagram.com/ancienttrails",
    youtube: "https://www.youtube.com/@ancienttrails",
    twitter: "https://twitter.com/ancienttrails",
  });

  function saveSettings(section: string) {
    toast.success("Settings saved", `${section} settings have been saved.`);
  }

  return (
    <AdminDashboardShell activeLabel="Settings">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4">
        <SettingsHeader />

        <section className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
          <div className="flex flex-wrap gap-x-5 gap-y-0 overflow-visible px-4 sm:flex-nowrap sm:overflow-x-auto sm:[-ms-overflow-style:none] sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden">
            {settingsTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.label === "General";

              return (
                <button
                  key={tab.label}
                  type="button"
                  className={cn(
                    "flex h-12 shrink-0 items-center gap-2 border-b-2 px-2 text-xs font-bold transition-colors",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-foreground/65 hover:text-primary"
                  )}
                >
                  <Icon className="size-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <SettingsPanel
            title="General Settings"
            description="Manage basic site information and preferences."
          >
            <div className="grid gap-4">
              <FormField label="Site Name">
                <input
                  value={siteName}
                  onChange={(event) => setSiteName(event.target.value)}
                  className={inputClassName}
                />
                <FieldHint>The name of your brand / platform.</FieldHint>
              </FormField>

              <FormField label="Tagline">
                <input
                  value={tagline}
                  onChange={(event) => setTagline(event.target.value)}
                  className={inputClassName}
                />
                <FieldHint>Short description or tagline.</FieldHint>
              </FormField>

              <FormField label="Admin Email">
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(event) => setAdminEmail(event.target.value)}
                  className={inputClassName}
                />
                <FieldHint>
                  This email will be used for important notifications.
                </FieldHint>
              </FormField>

              <FormField label="Contact Phone">
                <input
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  className={inputClassName}
                />
                <FieldHint>Primary contact number.</FieldHint>
              </FormField>

              <FormField label="Timezone">
                <Select
                  value={timezone}
                  onValueChange={(value) => setTimezone(String(value || timezone))}
                >
                  <SelectTrigger className={inputClassName}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "(GMT+05:30) Asia/Kolkata",
                      "(GMT+00:00) UTC",
                      "(GMT+04:00) Asia/Dubai",
                      "(GMT+08:00) Asia/Singapore",
                    ].map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldHint>Select your current timezone.</FieldHint>
              </FormField>

              <FormField label="Date Format">
                <Select
                  value={dateFormat}
                  onValueChange={(value) =>
                    setDateFormat(String(value || dateFormat))
                  }
                >
                  <SelectTrigger className={inputClassName}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "31-07-2026 (DD-MM-YYYY)",
                      "31 July 2026 (DD MMM YYYY)",
                      "2026-07-31 (YYYY-MM-DD)",
                    ].map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldHint>Choose the date format.</FieldHint>
              </FormField>

              <Button
                type="button"
                onClick={() => saveSettings("General")}
                className="h-9 w-fit rounded-sm px-3 text-xs font-bold"
              >
                <Save className="size-3.5" data-icon="inline-start" />
                Save Changes
              </Button>
            </div>
          </SettingsPanel>

          <div className="grid gap-4">
            <SettingsPanel
              title="Site Logo"
              description="Upload or update your brand logo."
            >
              <div className="flex flex-col gap-3">
                <div className="relative mx-auto flex h-20 w-full max-w-[360px] items-center justify-center rounded-sm border border-dashed border-primary/45 bg-white px-6">
                  <Image
                    src="/brand/header-logo.png"
                    alt="Ancient Trails"
                    width={248}
                    height={84}
                    className="h-auto w-[250px] max-w-full"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-stone-200 text-foreground/45 transition-colors hover:bg-primary hover:text-white"
                    aria-label="Remove logo"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-fit rounded-sm px-3 text-xs font-bold"
                >
                  <Upload className="size-3.5" data-icon="inline-start" />
                  Upload New Logo
                </Button>
                <p className="text-[11px] font-medium text-foreground/55">
                  PNG, JPG or SVG. Max size 2MB.
                </p>
              </div>
            </SettingsPanel>

            <SettingsPanel
              title="Footer Text"
              description="This text will appear in the website footer."
            >
              <textarea
                value={footerText}
                onChange={(event) => setFooterText(event.target.value)}
                className={textareaClassName}
              />
              <Button
                type="button"
                onClick={() => saveSettings("Footer")}
                className="mt-3 h-9 w-fit rounded-sm px-3 text-xs font-bold"
              >
                <Save className="size-3.5" data-icon="inline-start" />
                Save Changes
              </Button>
            </SettingsPanel>
          </div>

          <SettingsPanel
            title="Social Media Links"
            description="Manage your social media profiles."
          >
            <div className="grid gap-4">
              <SocialField
                label="Facebook"
                tone="bg-[#1877f2] text-white"
                value={socialLinks.facebook}
                onChange={(value) =>
                  setSocialLinks((links) => ({ ...links, facebook: value }))
                }
              />
              <SocialField
                label="Instagram"
                tone="bg-[#e1306c] text-white"
                value={socialLinks.instagram}
                onChange={(value) =>
                  setSocialLinks((links) => ({ ...links, instagram: value }))
                }
              />
              <SocialField
                label="YouTube"
                tone="bg-[#ff0000] text-white"
                value={socialLinks.youtube}
                onChange={(value) =>
                  setSocialLinks((links) => ({ ...links, youtube: value }))
                }
              />
              <SocialField
                label="X (Twitter)"
                tone="bg-[#111111] text-white"
                value={socialLinks.twitter}
                onChange={(value) =>
                  setSocialLinks((links) => ({ ...links, twitter: value }))
                }
              />
            </div>
          </SettingsPanel>

          <SettingsPanel
            title="Maintenance Mode"
            description="Enable maintenance mode to restrict public access to the website."
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setMaintenanceMode((value) => !value)}
                className={cn(
                  "mt-1 flex h-6 w-11 rounded-full p-0.5 transition-colors",
                  maintenanceMode ? "bg-primary" : "bg-stone-300"
                )}
                aria-pressed={maintenanceMode}
                aria-label="Enable maintenance mode"
              >
                <span
                  className={cn(
                    "size-5 rounded-full bg-white shadow-sm transition-transform",
                    maintenanceMode && "translate-x-5"
                  )}
                />
              </button>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground">
                  Enable Maintenance Mode
                </p>
                <p className="mt-1 text-[11px] text-foreground/55">
                  When enabled, only admins will be able to access the site.
                </p>
              </div>
            </div>

            <FormField className="mt-5" label="Maintenance Message">
              <textarea
                value={maintenanceMessage}
                onChange={(event) => setMaintenanceMessage(event.target.value)}
                className={textareaClassName}
              />
            </FormField>

            <Button
              type="button"
              onClick={() => saveSettings("Maintenance")}
              className="mt-3 h-9 w-fit rounded-sm px-3 text-xs font-bold"
            >
              <Save className="size-3.5" data-icon="inline-start" />
              Save Changes
            </Button>
          </SettingsPanel>
        </section>
      </div>
    </AdminDashboardShell>
  );
}

function SettingsHeader() {
  const toast = useToast();

  return (
    <header className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <AdminSidebarToggle />
        <div className="min-w-0">
          <h1 className="font-sans text-2xl font-bold tracking-normal text-foreground">
            Settings
          </h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-foreground/55">
            <span>Dashboard</span>
            <span aria-hidden="true">&gt;</span>
            <span className="font-medium text-foreground/75">Settings</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() =>
            toast.info("Notifications", "You have 3 settings notifications.")
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

function SettingsPanel({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-sm border border-border bg-white p-4 shadow-sm shadow-stone-200/40">
      <h2 className="font-sans text-sm font-bold tracking-normal text-foreground">
        {title}
      </h2>
      <p className="mt-1 text-[11px] font-medium text-foreground/55">
        {description}
      </p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function FormField({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <label
      className={cn(
        "grid gap-2 text-xs font-bold text-foreground sm:grid-cols-[170px_minmax(0,1fr)] sm:items-start",
        className
      )}
    >
      <span className="pt-2">{label}</span>
      <span className="grid min-w-0 gap-1.5">{children}</span>
    </label>
  );
}

function FieldHint({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-medium text-foreground/50">
      {children}
    </span>
  );
}

function SocialField({
  label,
  onChange,
  tone,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  tone: string;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-xs font-bold text-foreground sm:grid-cols-[170px_minmax(0,1fr)] sm:items-center">
      <span className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold",
            tone
          )}
        >
          {label[0]}
        </span>
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
      />
    </label>
  );
}
