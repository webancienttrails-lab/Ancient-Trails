"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  Bell,
  ChevronDown,
  Save,
  Settings,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  AdminDashboardShell,
  AdminSidebarToggle,
} from "@/components/admin-dashboard/admin-dashboard-shell";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type SettingsTab = {
  icon: LucideIcon;
  label: string;
};

const settingsTabs: SettingsTab[] = [
  { label: "General", icon: Settings },
];

const inputClassName =
  "h-9 rounded-sm border border-border bg-white px-3 text-xs font-medium text-foreground outline-none transition-colors placeholder:text-foreground/40 focus:border-primary focus:ring-3 focus:ring-primary/15";

export default function SettingsPage() {
  const toast = useToast();
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

        

        <section>
          <SettingsPanel
            title="General Settings"
            description="Manage the site logo and social media links."
          >
            <div className="grid gap-6 xl:grid-cols-[minmax(280px,0.7fr)_minmax(0,1fr)]">
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-bold text-foreground">Site Logo</h3>
                <div className="relative flex h-20 w-full max-w-[360px] items-center justify-center rounded-sm border border-dashed border-primary/45 bg-white px-6">
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
              </div>

              <div className="grid gap-4">
                <h3 className="text-xs font-bold text-foreground">
                  Social Media Links
                </h3>
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
            </div>

            <Button
              type="button"
              onClick={() => saveSettings("General")}
              className="mt-6 h-9 w-fit rounded-sm px-3 text-xs font-bold"
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
