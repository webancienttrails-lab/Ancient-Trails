"use client";

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Globe2,
  Image as ImageIcon,
  MapPin,
  Plus,
  Save,
  Trash2,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  AdminDashboardShell,
  AdminSidebarToggle,
} from "@/components/admin-dashboard/admin-dashboard-shell";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  getAboutMediaUrl,
  getAdminAboutPage,
  updateAdminAboutPage,
  uploadAboutImage,
  type AboutPageContent,
  type AboutPagePayload,
  type AboutStatIcon,
} from "@/lib/about";
import { cn } from "@/lib/utils";

type AboutFormState = AboutPagePayload;

const statIconOptions: Array<{ label: string; value: AboutStatIcon }> = [
  { label: "Book", value: "BookOpen" },
  { label: "Location", value: "MapPin" },
  { label: "Travellers", value: "Users" },
  { label: "Calendar", value: "CalendarDays" },
  { label: "Globe", value: "Globe2" },
];

const statIconMap: Record<AboutStatIcon, LucideIcon> = {
  BookOpen,
  CalendarDays,
  Globe2,
  MapPin,
  Users,
};

const emptyForm: AboutFormState = {
  stats: [
    {
      value: "150+",
      label: "Curated Tours",
      icon: "BookOpen",
      sortOrder: 0,
    },
  ],
  teamMembers: [
    {
      name: "Team Member",
      role: "Role",
      bio: "Short profile description.",
      image: "",
      sortOrder: 0,
    },
  ],
};

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "details" in error &&
    Array.isArray((error as { details?: unknown }).details)
  ) {
    return (error as { details: Array<{ path?: string; message?: string }> })
      .details.map((detail) =>
        [detail.path, detail.message].filter(Boolean).join(": ")
      )
      .filter(Boolean)
      .join(", ");
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function createFormState(content: AboutPageContent): AboutFormState {
  return {
    stats: content.stats.map(({ icon, label, sortOrder, value }, index) => ({
      icon,
      label,
      sortOrder: sortOrder ?? index,
      value,
    })),
    teamMembers: content.teamMembers.map(
      ({ bio, image, name, role, sortOrder }, index) => ({
        bio,
        image,
        name,
        role,
        sortOrder: sortOrder ?? index,
      })
    ),
  };
}

function createPayload(form: AboutFormState): AboutPagePayload {
  return {
    stats: form.stats.map((stat, index) => ({
      ...stat,
      sortOrder: index,
    })),
    teamMembers: form.teamMembers.map((member, index) => ({
      ...member,
      sortOrder: index,
    })),
  };
}

export default function AboutAdminPage() {
  return <AboutPageEditor />;
}

export function AboutPageEditor() {
  const toast = useToast();
  const [form, setForm] = useState<AboutFormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingMemberIndex, setUploadingMemberIndex] = useState<number | null>(
    null
  );
  const isBusy = isSaving || uploadingMemberIndex !== null;

  useEffect(() => {
    let isMounted = true;

    async function loadAboutPage() {
      try {
        const response = await getAdminAboutPage();

        if (isMounted) {
          setForm(createFormState(response.data.about));
        }
      } catch (error) {
        toast.error("Unable to load about page", getErrorMessage(error));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadAboutPage();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  const overviewMetrics = useMemo(
    () => [
      {
        label: "Stats",
        value: form.stats.length.toString(),
        detail: "Public counters",
        icon: BookOpen,
      },
      {
        label: "Team Members",
        value: form.teamMembers.length.toString(),
        detail: "Shown on About page",
        icon: Users,
      },
      {
        label: "Images",
        value: form.teamMembers
          .filter((member) => member.image.trim())
          .length.toString(),
        detail: "Team profiles with photos",
        icon: ImageIcon,
      },
    ],
    [form.stats.length, form.teamMembers]
  );

  function updateStat<K extends keyof AboutFormState["stats"][number]>(
    index: number,
    field: K,
    value: AboutFormState["stats"][number][K]
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      stats: currentForm.stats.map((stat, statIndex) =>
        statIndex === index ? { ...stat, [field]: value } : stat
      ),
    }));
  }

  function updateTeamMember<
    K extends keyof AboutFormState["teamMembers"][number],
  >(
    index: number,
    field: K,
    value: AboutFormState["teamMembers"][number][K]
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      teamMembers: currentForm.teamMembers.map((member, memberIndex) =>
        memberIndex === index ? { ...member, [field]: value } : member
      ),
    }));
  }

  function addStat() {
    setForm((currentForm) => ({
      ...currentForm,
      stats: [
        ...currentForm.stats,
        {
          value: "0+",
          label: "New Stat",
          icon: "BookOpen",
          sortOrder: currentForm.stats.length,
        },
      ],
    }));
  }

  function removeStat(index: number) {
    if (form.stats.length <= 1) {
      toast.error("Stat required", "At least one stat must remain.");
      return;
    }

    setForm((currentForm) => ({
      ...currentForm,
      stats: currentForm.stats.filter((_stat, statIndex) => statIndex !== index),
    }));
  }

  function addTeamMember() {
    setForm((currentForm) => ({
      ...currentForm,
      teamMembers: [
        ...currentForm.teamMembers,
        {
          name: "Team Member",
          role: "Role",
          bio: "Short profile description.",
          image: "",
          sortOrder: currentForm.teamMembers.length,
        },
      ],
    }));
  }

  function removeTeamMember(index: number) {
    if (form.teamMembers.length <= 1) {
      toast.error("Team member required", "At least one team member must remain.");
      return;
    }

    setForm((currentForm) => ({
      ...currentForm,
      teamMembers: currentForm.teamMembers.filter(
        (_member, memberIndex) => memberIndex !== index
      ),
    }));
  }

  async function handleTeamImageUpload(index: number, files: FileList | null) {
    const image = files?.[0];

    if (!image) {
      return;
    }

    setUploadingMemberIndex(index);

    try {
      const response = await uploadAboutImage(image);

      updateTeamMember(index, "image", response.data.image);
      toast.success("Image uploaded", response.message);
    } catch (error) {
      toast.error("Image not uploaded", getErrorMessage(error));
    } finally {
      setUploadingMemberIndex(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const response = await updateAdminAboutPage(createPayload(form));

      setForm(createFormState(response.data.about));
      toast.success("About page saved", response.message);
    } catch (error) {
      toast.error("About page not saved", getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminDashboardShell activeLabel="Pages">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-[1480px] flex-col gap-5"
      >
        <AboutHeader isBusy={isBusy} isSaving={isSaving} />

        <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-sm text-foreground/60">
            Update the About page counters and team profiles shown on the public
            website.
          </p>
          <Button
            type="submit"
            disabled={isBusy || isLoading}
            className="h-11 rounded-sm px-4 text-xs font-bold"
          >
            <Save className="size-4" data-icon="inline-start" />
            {isSaving ? "Saving..." : "Save About Page"}
          </Button>
        </section>

        <section
          data-admin-metric-grid
          className="grid gap-3 sm:grid-cols-3"
        >
          {overviewMetrics.map((metric) => (
            <OverviewMetric key={metric.label} metric={metric} />
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.45fr]">
          <div className="rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
            <SectionHeader
              actionLabel="Add Stat"
              onAction={addStat}
              title="About Stats"
            />
            <div className="grid gap-4 p-4">
              {isLoading ? (
                <LoadingPanel label="Loading stats..." />
              ) : (
                form.stats.map((stat, index) => (
                  <StatEditor
                    key={`${stat.label}-${index}`}
                    index={index}
                    onRemove={removeStat}
                    onUpdate={updateStat}
                    stat={stat}
                  />
                ))
              )}
            </div>
          </div>

          <div className="rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
            <SectionHeader
              actionLabel="Add Member"
              onAction={addTeamMember}
              title="Our Team"
            />
            <div className="grid gap-4 p-4">
              {isLoading ? (
                <LoadingPanel label="Loading team..." />
              ) : (
                form.teamMembers.map((member, index) => (
                  <TeamMemberEditor
                    key={`${member.name}-${index}`}
                    index={index}
                    isUploading={uploadingMemberIndex === index}
                    member={member}
                    onImageUpload={handleTeamImageUpload}
                    onRemove={removeTeamMember}
                    onUpdate={updateTeamMember}
                  />
                ))
              )}
            </div>
          </div>
        </section>
      </form>
    </AdminDashboardShell>
  );
}

function AboutHeader({
  isBusy,
  isSaving,
}: {
  isBusy: boolean;
  isSaving: boolean;
}) {
  const toast = useToast();

  return (
    <header className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <AdminSidebarToggle />
        <div className="min-w-0">
          <h1 className="font-sans text-2xl font-bold tracking-normal text-foreground">
            About Page
          </h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-foreground/55">
            <span>Dashboard</span>
            <span aria-hidden="true">&gt;</span>
            <span>Pages</span>
            <span aria-hidden="true">&gt;</span>
            <span className="font-medium text-foreground/75">About</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() =>
            toast.info("Notifications", "About page editor is ready.")
          }
          className="relative grid size-10 place-items-center rounded-sm border border-border bg-white text-foreground transition-colors hover:border-primary hover:text-primary"
          type="button"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-white">
            1
          </span>
        </button>
        <Button
          type="submit"
          disabled={isBusy}
          className="h-10 rounded-sm px-4 text-xs font-bold"
        >
          <Save className="size-4" data-icon="inline-start" />
          {isSaving ? "Saving..." : "Save"}
        </Button>
        <button
          onClick={() => toast.info("Admin profile", "Profile menu will open here.")}
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

function OverviewMetric({
  metric,
}: {
  metric: {
    detail: string;
    icon: LucideIcon;
    label: string;
    value: string;
  };
}) {
  const Icon = metric.icon;

  return (
    <div className="rounded-sm border border-border bg-white p-4 shadow-sm shadow-stone-200/40">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground/60">
            {metric.label}
          </p>
          <p className="mt-1 text-2xl font-bold leading-none text-foreground">
            {metric.value}
          </p>
          <p className="mt-2 text-[11px] font-semibold text-foreground/55">
            {metric.detail}
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  actionLabel,
  onAction,
  title,
}: {
  actionLabel: string;
  onAction: () => void;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <h2 className="font-sans text-base font-bold text-foreground">{title}</h2>
      <Button
        type="button"
        variant="outline"
        onClick={onAction}
        className="h-9 rounded-sm px-3 text-xs font-bold"
      >
        <Plus className="size-4" data-icon="inline-start" />
        {actionLabel}
      </Button>
    </div>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="rounded-sm border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-xs font-semibold text-foreground/55">
      {label}
    </div>
  );
}

function StatEditor({
  index,
  onRemove,
  onUpdate,
  stat,
}: {
  index: number;
  onRemove: (index: number) => void;
  onUpdate: <K extends keyof AboutFormState["stats"][number]>(
    index: number,
    field: K,
    value: AboutFormState["stats"][number][K]
  ) => void;
  stat: AboutFormState["stats"][number];
}) {
  const Icon = statIconMap[stat.icon] || BookOpen;

  return (
    <article className="rounded-sm border border-border bg-[#fffaf7] p-3">
      <div className="grid gap-3 sm:grid-cols-[44px_minmax(0,1fr)_minmax(0,1fr)_44px] sm:items-end">
        <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <FormField label="Value">
          <input
            required
            value={stat.value}
            onChange={(event) => onUpdate(index, "value", event.target.value)}
            className={inputClassName}
            placeholder="150+"
          />
        </FormField>
        <FormField label="Label">
          <input
            required
            value={stat.label}
            onChange={(event) => onUpdate(index, "label", event.target.value)}
            className={inputClassName}
            placeholder="Curated Tours"
          />
        </FormField>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="grid size-11 place-items-center rounded-sm border border-border bg-white text-foreground/55 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          aria-label={`Remove stat ${index + 1}`}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <FormField className="mt-3" label="Icon">
        <select
          value={stat.icon}
          onChange={(event) =>
            onUpdate(index, "icon", event.target.value as AboutStatIcon)
          }
          className={inputClassName}
        >
          {statIconOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>
    </article>
  );
}

function TeamMemberEditor({
  index,
  isUploading,
  member,
  onImageUpload,
  onRemove,
  onUpdate,
}: {
  index: number;
  isUploading: boolean;
  member: AboutFormState["teamMembers"][number];
  onImageUpload: (index: number, files: FileList | null) => void;
  onRemove: (index: number) => void;
  onUpdate: <K extends keyof AboutFormState["teamMembers"][number]>(
    index: number,
    field: K,
    value: AboutFormState["teamMembers"][number][K]
  ) => void;
}) {
  const image = member.image.trim();

  return (
    <article className="grid gap-4 rounded-sm border border-border bg-[#fffaf7] p-3 lg:grid-cols-[190px_minmax(0,1fr)]">
      <div>
        <div
          role="img"
          aria-label={member.name || "Team member image"}
          className={cn(
            "grid aspect-[4/3] place-items-center overflow-hidden rounded-sm border border-border bg-white bg-cover bg-center text-foreground/35",
            !image && "bg-muted/45"
          )}
          style={image ? { backgroundImage: `url("${getAboutMediaUrl(image)}")` } : undefined}
        >
          {!image ? <ImageIcon className="size-8" /> : null}
        </div>
        <label className="mt-3 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-sm border border-primary bg-white px-3 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-white">
          <Upload className="size-4" />
          {isUploading ? "Uploading..." : "Upload Photo"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={isUploading}
            onChange={(event) => {
              onImageUpload(index, event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Name">
          <input
            required
            value={member.name}
            onChange={(event) => onUpdate(index, "name", event.target.value)}
            className={inputClassName}
            placeholder="Girinath Bharade"
          />
        </FormField>
        <FormField label="Role">
          <input
            required
            value={member.role}
            onChange={(event) => onUpdate(index, "role", event.target.value)}
            className={inputClassName}
            placeholder="Founder & Heritage Expert"
          />
        </FormField>
        <FormField className="sm:col-span-2" label="Image URL">
          <input
            value={member.image}
            onChange={(event) => onUpdate(index, "image", event.target.value)}
            className={inputClassName}
            placeholder="/uploads/about/member.webp"
          />
        </FormField>
        <FormField className="sm:col-span-2" label="Bio">
          <textarea
            required
            value={member.bio}
            onChange={(event) => onUpdate(index, "bio", event.target.value)}
            className={textareaClassName}
            placeholder="Short profile description"
          />
        </FormField>
        <div className="sm:col-span-2">
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="inline-flex h-10 items-center gap-2 rounded-sm border border-border bg-white px-3 text-xs font-bold text-foreground/60 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="size-4" />
            Remove Member
          </button>
        </div>
      </div>
    </article>
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
    <label className={cn("grid min-w-0 gap-1.5", className)}>
      <span className="text-[11px] font-bold uppercase tracking-normal text-foreground/55">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClassName =
  "h-10 w-full rounded-sm border border-border bg-white px-3 text-xs font-semibold text-foreground outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15";
const textareaClassName =
  "min-h-24 w-full rounded-sm border border-border bg-white px-3 py-2 text-xs font-medium leading-relaxed text-foreground outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15";
