"use client";

import { SiteLogo } from "@/components/site-logo";
import { announceSiteLogo, publishSiteLogo } from "@/lib/site-logo";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
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
import {
  getAdminSiteSettings,
  uploadAdminSiteLogo,
  resetAdminSiteLogo,
  updateAdminSiteSettings,
  type SiteContactSettings,
  type SiteSocialLinks,
} from "@/lib/site-settings";
import { SocialMediaIcon } from "@/components/ui/social-media-icon";
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

const defaultContactSettings: SiteContactSettings = {
  emailId: "Holidays@ancient.com",
  landline: "43131313",
  officeAddress:
    "387/1, Vinayak Apartments, Narayan Peth, Near Modi Ganpati Temple, Pune - 411030, Maharashtra, India",
  primaryCalling: "011-43033003",
  secondaryCalling: "",
  whatsapp: "",
};

export default function SettingsPage() {
  const toast = useToast();
  const [contactSettings, setContactSettings] = useState<SiteContactSettings>(
    defaultContactSettings
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isLogoSaving, setIsLogoSaving] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const [socialLinks, setSocialLinks] = useState<SiteSocialLinks>({ facebook: "", instagram: "", linkedin: "", youtube: "" });
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const response = await getAdminSiteSettings();

        if (isMounted) {
          setContactSettings(response.data.settings.contact);
          setSocialLinks(response.data.settings.socialLinks);
          publishSiteLogo(response.data.settings.logo);
          setSettingsLoaded(true);
        }
      } catch (error) {
        if (isMounted) {
          toast.error(
            "Settings unavailable",
            error instanceof Error ? error.message : "Unable to load settings."
          );
        }
      }
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  async function changeLogo(file?: File) {
    if (isLogoSaving || !settingsLoaded) return;
    if (file && (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      toast.error("Invalid logo", "Choose a PNG, JPG, WebP or GIF image up to 5 MB."); return;
    }
    setIsLogoSaving(true);
    try {
      const result = file ? await uploadAdminSiteLogo(file) : await resetAdminSiteLogo();
      announceSiteLogo(result.data.settings.logo);
      toast.success("Logo saved", file ? "Your new logo is now used across the website and admin dashboard." : "The default logo has been restored.");
    } catch (error) { toast.error("Logo not saved", error instanceof Error ? error.message : "Please try again."); }
    finally { setIsLogoSaving(false); }
  }

  function updateContactField(
    field: keyof SiteContactSettings,
    value: string
  ) {
    setContactSettings((settings) => ({
      ...settings,
      [field]: value,
    }));
  }

  async function saveSettings(section: string) {
    if (!settingsLoaded || isSaving) return;
    for (const [platform, url] of Object.entries(socialLinks)) {
      if (!url.trim()) continue;
      try { if (!["http:", "https:"].includes(new URL(url.trim()).protocol)) throw new Error(); }
      catch { toast.error("Invalid social media link", "Enter a valid http or https URL for " + platform + "."); return; }
    }
    if (
      contactSettings.emailId.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactSettings.emailId.trim())
    ) {
      toast.error("Invalid email", "Enter a valid Email ID before saving.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await updateAdminSiteSettings({
        contact: contactSettings,
        socialLinks,
      });

      setContactSettings(response.data.settings.contact);
      setSocialLinks(response.data.settings.socialLinks);
      toast.success("Settings saved", `${section} settings have been saved.`);
    } catch (error) {
      toast.error(
        "Settings not saved",
        error instanceof Error ? error.message : "Unable to save settings."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminDashboardShell activeLabel="Settings">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4">
        <SettingsHeader />

        

        <section>
          <SettingsPanel
            title="General Settings"
            description="Manage the site logo, contact details, and social media links."
          >
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)]">
              <div className="rounded-sm border border-border bg-stone-50/45 p-4">
                <h3 className="text-xs font-bold text-foreground">
                  Contact Details
                </h3>
                <p className="mt-1 text-[11px] font-medium text-foreground/55">
                  These details appear in website help and contact sections.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <ContactField
                    label="Primary Calling"
                    value={contactSettings.primaryCalling}
                    onChange={(value) => updateContactField("primaryCalling", value)}
                  />
                  <ContactField
                    label="Secondary Calling"
                    value={contactSettings.secondaryCalling}
                    onChange={(value) => updateContactField("secondaryCalling", value)}
                  />
                  <ContactField
                    label="WhatsApp"
                    value={contactSettings.whatsapp}
                    onChange={(value) => updateContactField("whatsapp", value)}
                  />
                  <ContactField
                    label="Landline"
                    value={contactSettings.landline}
                    onChange={(value) => updateContactField("landline", value)}
                  />
                  <ContactField
                    label="Email ID"
                    type="email"
                    value={contactSettings.emailId}
                    onChange={(value) => updateContactField("emailId", value)}
                  />
                  <ContactField
                    label="Office Address"
                    multiline
                    value={contactSettings.officeAddress}
                    onChange={(value) => updateContactField("officeAddress", value)}
                  />
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-sm border border-border bg-stone-50/45 p-4">
                  <h3 className="text-xs font-bold text-foreground">Site Logo</h3>
                  <div className="mt-4 flex flex-col gap-3">
                    <div className="relative flex h-24 w-full items-center justify-center rounded-sm border border-dashed border-primary/45 bg-white px-6">
                      <SiteLogo
                        alt="Ancient Trails"
                        width={248}
                        height={84}
                        className="h-auto w-[250px] max-w-full"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-stone-200 text-foreground/45 transition-colors hover:bg-primary hover:text-white"
                        aria-label="Restore default logo"
                        title="Restore default logo"
                        disabled={isLogoSaving || !settingsLoaded}
                        onClick={() => { void changeLogo(); }}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" aria-label="Select site logo" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void changeLogo(file); }} />
                    <Button
                      type="button"
                      disabled={isLogoSaving || !settingsLoaded}
                      onClick={() => logoInput.current?.click()}
                      variant="outline"
                      className="h-9 w-fit rounded-sm px-3 text-xs font-bold"
                    >
                      <Upload className="size-3.5" data-icon="inline-start" />
                      {isLogoSaving ? "Saving Logo..." : "Upload New Logo"}
                    </Button>
                    <p className="text-[11px] text-foreground/55">PNG, JPG, WebP or GIF, up to 5 MB. Uploads are saved automatically.</p>
                  </div>
                </div>

                <div className="rounded-sm border border-border bg-stone-50/45 p-4">
                  <h3 className="text-xs font-bold text-foreground">
                    Social Media Links
                  </h3>
                  <div className="mt-4 grid gap-3">
                    <SocialField
                      platform="facebook"
                      label="Facebook"
                      tone="bg-[#1877f2] text-white"
                      value={socialLinks.facebook}
                      onChange={(value) =>
                        setSocialLinks((links) => ({ ...links, facebook: value }))
                      }
                    />
                    <SocialField
                      platform="instagram"
                      label="Instagram"
                      tone="bg-[#e1306c] text-white"
                      value={socialLinks.instagram}
                      onChange={(value) =>
                        setSocialLinks((links) => ({ ...links, instagram: value }))
                      }
                    />
                    <SocialField
                      platform="youtube"
                      label="YouTube"
                      tone="bg-[#ff0000] text-white"
                      value={socialLinks.youtube}
                      onChange={(value) =>
                        setSocialLinks((links) => ({ ...links, youtube: value }))
                      }
                    />
                    <SocialField
                      platform="linkedin"
                      label="LinkedIn"
                      tone="bg-[#0a66c2] text-white"
                      value={socialLinks.linkedin}
                      onChange={(value) =>
                        setSocialLinks((links) => ({ ...links, linkedin: value }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => saveSettings("General")}
              disabled={isSaving || !settingsLoaded}
              className="mt-6 h-9 w-fit rounded-sm px-3 text-xs font-bold"
            >
              <Save className="size-3.5" data-icon="inline-start" />
              {isSaving ? "Saving" : "Save Changes"}
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

function ContactField({
  label,
  multiline,
  onChange,
  type = "text",
  value,
}: {
  label: string;
  multiline?: boolean;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-xs font-bold text-foreground">
      {label}
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          className="min-h-24 rounded-sm border border-border bg-white px-3 py-2 text-xs font-medium leading-relaxed text-foreground outline-none transition-colors placeholder:text-foreground/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClassName}
        />
      )}
    </label>
  );
}

function SocialField({
  label,
  platform,
  onChange,
  tone,
  value,
}: {
  label: string;
  platform: keyof SiteSocialLinks;
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
          <SocialMediaIcon platform={platform} className="size-4" />
        </span>
        {label}
      </span>
      <input
        type="url"
        placeholder="https://"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
      />
    </label>
  );
}
