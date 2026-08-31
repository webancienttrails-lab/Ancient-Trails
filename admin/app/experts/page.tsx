"use client";

import type { FormEvent, ReactNode } from "react";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  ArrowLeft,
  Award,
  Bell,
  ChevronDown,
  Eye,
  ImageIcon,
  Languages,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Tags,
  Trash2,
  UserRoundCheck,
  X,
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
import { useToast } from "@/components/ui/toast";
import {
  createAdminExpert,
  deleteAdminExpert,
  getExpertMediaUrl,
  listAdminExperts,
  updateAdminExpert,
  uploadExpertImage,
  type AdminExpert,
  type ExpertPayload,
} from "@/lib/experts";
import { cn } from "@/lib/utils";

type ExpertMetric = {
  label: string;
  value: string;
  trend: string;
  icon: LucideIcon;
  tone: string;
  trendTone: string;
};

type ExpertFormState = Omit<
  ExpertPayload,
  "expertiseTags" | "qualifications" | "languages"
> & {
  expertiseTags: string;
  qualifications: string;
  languages: string;
};

type ExpertSheetMode = "add" | "view" | "edit";

type ExpertRouteState = {
  id: string | null;
  mode: ExpertSheetMode | null;
};

const emptyExpertForm: ExpertFormState = {
  expertId: "",
  fullName: "",
  image: "",
  fullBiography: "",
  expertiseTags: "",
  qualifications: "",
  languages: "",
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function parseTextList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function expertToForm(expert: AdminExpert): ExpertFormState {
  return {
    expertId: expert.expertId,
    fullName: expert.fullName,
    image: expert.image,
    fullBiography: expert.fullBiography,
    expertiseTags: expert.expertiseTags.join("\n"),
    qualifications: expert.qualifications.join("\n"),
    languages: expert.languages.join("\n"),
  };
}

function createExpertPayload(expertForm: ExpertFormState): ExpertPayload {
  return {
    expertId: expertForm.expertId.trim(),
    fullName: expertForm.fullName.trim(),
    image: expertForm.image.trim(),
    fullBiography: expertForm.fullBiography.trim(),
    expertiseTags: parseTextList(expertForm.expertiseTags),
    qualifications: parseTextList(expertForm.qualifications),
    languages: parseTextList(expertForm.languages),
  };
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}

function getInitials(name: string): string {
  const initials = name
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return initials || "EX";
}

function formatListPreview(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "-";
}

function createExpertMetrics(experts: AdminExpert[]): ExpertMetric[] {
  const uniqueTags = new Set(experts.flatMap((expert) => expert.expertiseTags));
  const qualifiedExperts = experts.filter(
    (expert) => expert.qualifications.length > 0
  ).length;
  const uniqueLanguages = new Set(experts.flatMap((expert) => expert.languages));

  return [
    {
      label: "Total Experts",
      value: experts.length.toString(),
      trend: "Live expert profiles",
      icon: UserRoundCheck,
      tone: "bg-primary/10 text-primary",
      trendTone: "text-emerald-600",
    },
    {
      label: "Expertise Tags",
      value: uniqueTags.size.toString(),
      trend: "Unique specialisations",
      icon: Tags,
      tone: "bg-emerald-100 text-emerald-700",
      trendTone: "text-emerald-600",
    },
    {
      label: "Qualified",
      value: qualifiedExperts.toString(),
      trend: "Profiles with credentials",
      icon: Award,
      tone: "bg-amber-100 text-amber-700",
      trendTone: "text-amber-600",
    },
    {
      label: "Languages",
      value: uniqueLanguages.size.toString(),
      trend: "Languages represented",
      icon: Languages,
      tone: "bg-sky-100 text-sky-700",
      trendTone: "text-sky-600",
    },
  ];
}

export default function ExpertsPage() {
  return (
    <Suspense fallback={null}>
      <ExpertsPageContent />
    </Suspense>
  );
}

function getExpertRouteState(
  pathname: string,
  id: string | null
): ExpertRouteState {
  const segments = pathname
    .split("/")
    .filter(Boolean);

  const expertsIndex =
    segments.findIndex(
      (segment) => segment === "experts"
    );

  const pageSegment =
    expertsIndex >= 0
      ? segments[expertsIndex + 1]
      : "";

  if (pageSegment === "add") {
    return {
      id: null,
      mode: "add",
    };
  }

  if (
    pageSegment === "edit" &&
    id
  ) {
    return {
      id,
      mode: "edit",
    };
  }

  if (
    pageSegment === "view" &&
    id
  ) {
    return {
      id,
      mode: "view",
    };
  }

  return {
    id: null,
    mode: null,
  };
}

function ExpertsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const searchParamString =
    searchParams.toString();
  const routeState = useMemo(
    () =>
      getExpertRouteState(
        pathname,
        new URLSearchParams(
          searchParamString
        ).get("id")
      ),
    [pathname, searchParamString]
  );
  const [experts, setExperts] = useState<AdminExpert[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingExperts, setIsLoadingExperts] = useState(true);
  const [expertSheetMode, setExpertSheetMode] =
    useState<ExpertSheetMode | null>(
      routeState.mode === "add"
        ? "add"
        : null
    );
  const [selectedExpert, setSelectedExpert] = useState<AdminExpert | null>(null);
  const [isSavingExpert, setIsSavingExpert] = useState(false);
  const [isUploadingExpertImage, setIsUploadingExpertImage] = useState(false);
  const [isDeletingExpertId, setIsDeletingExpertId] = useState<string | null>(
    null
  );
  const [expertForm, setExpertForm] =
    useState<ExpertFormState>(emptyExpertForm);

  useEffect(() => {
    let isMounted = true;

    async function loadExperts() {
      try {
        const response = await listAdminExperts();

        if (isMounted) {
          const loadedExperts =
            response.data.experts;

          setExperts(loadedExperts);

          if (
            routeState.mode &&
            routeState.mode !== "add"
          ) {
            const expert =
              loadedExperts.find(
                (item) =>
                  item.id === routeState.id
              );

            if (expert) {
              setExpertSheetMode(routeState.mode);
              setSelectedExpert(expert);
              setExpertForm(expertToForm(expert));
            }
          }
        }
      } catch (error) {
        toast.error("Unable to load experts", getErrorMessage(error));
      } finally {
        if (isMounted) {
          setIsLoadingExperts(false);
        }
      }
    }

    loadExperts();

    return () => {
      isMounted = false;
    };
  }, [routeState, toast]);

  const filteredExperts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return experts;
    }

    return experts.filter((expert) =>
      [
        expert.expertId,
        expert.fullName,
        expert.image,
        expert.fullBiography,
        ...expert.expertiseTags,
        ...expert.qualifications,
        ...expert.languages,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [experts, searchQuery]);

  const expertMetrics = useMemo(() => createExpertMetrics(experts), [experts]);
  const isExpertFormBusy = isSavingExpert || isUploadingExpertImage;
  const isExpertSheetOpen = expertSheetMode !== null;

  function updateExpertForm<K extends keyof ExpertFormState>(
    field: K,
    value: ExpertFormState[K]
  ) {
    setExpertForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function openAddExpertSheet() {
    router.push("/experts/add");
  }

  function openViewExpertSheet(expert: AdminExpert) {
    router.push(
      `/experts/view?id=${encodeURIComponent(expert.id)}`
    );
  }

  function openEditExpertSheet(expert: AdminExpert) {
    router.push(
      `/experts/edit?id=${encodeURIComponent(expert.id)}`
    );
  }

  function closeExpertSheet() {
    if (isExpertFormBusy) {
      return;
    }

    if (routeState.mode) {
      router.push("/experts");
      return;
    }

    setExpertSheetMode(null);
    setSelectedExpert(null);
    setExpertForm(emptyExpertForm);
  }

  async function handleExpertImageUpload(files: FileList | null) {
    const image = files?.[0];

    if (!image) {
      return;
    }

    setIsUploadingExpertImage(true);

    try {
      const response = await uploadExpertImage(image);

      updateExpertForm("image", response.data.image);
      toast.success("Expert image uploaded", response.message);
    } catch (error) {
      toast.error("Image not uploaded", getErrorMessage(error));
    } finally {
      setIsUploadingExpertImage(false);
    }
  }

  async function handleDeleteExpert(expert: AdminExpert) {
    const shouldDelete = window.confirm(`Delete ${expert.fullName}?`);

    if (!shouldDelete) {
      return;
    }

    setIsDeletingExpertId(expert.id);

    try {
      const response = await deleteAdminExpert(expert.id);

      setExperts((currentExperts) =>
        currentExperts.filter((currentExpert) => currentExpert.id !== expert.id)
      );
      toast.success("Expert deleted", response.message);
    } catch (error) {
      toast.error("Expert not deleted", getErrorMessage(error));
    } finally {
      setIsDeletingExpertId(null);
    }
  }

  async function handleSaveExpert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (expertSheetMode === "view") {
      return;
    }

    setIsSavingExpert(true);

    const payload = createExpertPayload(expertForm);

    try {
      if (expertSheetMode === "edit" && selectedExpert) {
        const response = await updateAdminExpert(selectedExpert.id, payload);

        setExperts((currentExperts) =>
          currentExperts.map((expert) =>
            expert.id === selectedExpert.id ? response.data.expert : expert
          )
        );
        setExpertSheetMode(null);
        setSelectedExpert(null);
        setExpertForm(emptyExpertForm);
        toast.success("Expert updated", response.message);
        router.push("/experts");
        return;
      }

      const response = await createAdminExpert(payload);

      setExperts((currentExperts) => [response.data.expert, ...currentExperts]);
      setExpertSheetMode(null);
      setSelectedExpert(null);
      setExpertForm(emptyExpertForm);
      toast.success("Expert added", response.message);
      router.push("/experts");
    } catch (error) {
      toast.error(
        expertSheetMode === "edit" ? "Expert not updated" : "Expert not saved",
        getErrorMessage(error)
      );
    } finally {
      setIsSavingExpert(false);
    }
  }

  if (routeState.mode) {
    return (
      <AdminDashboardShell activeLabel="Experts">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/experts")}
              className="h-10 rounded-sm border-border bg-white px-3 text-xs font-bold"
            >
              <ArrowLeft className="size-4" />
              Back to Experts
            </Button>
          </div>

          {routeState.mode !== "add" &&
          isLoadingExperts ? (
            <section className="rounded-sm border border-border bg-white p-8 text-sm text-foreground/60 shadow-sm shadow-stone-200/40">
              Loading expert...
            </section>
          ) : null}

          {expertSheetMode ? (
            <ExpertFormDialog
              form={expertForm}
              mode={expertSheetMode}
              isBusy={isExpertFormBusy}
              isOpen
              isSaving={isSavingExpert}
              isUploadingImage={isUploadingExpertImage}
              onClose={closeExpertSheet}
              onImageUpload={handleExpertImageUpload}
              onSubmit={handleSaveExpert}
              onUpdate={updateExpertForm}
            />
          ) : !isLoadingExperts ? (
            <section className="rounded-sm border border-red-200 bg-red-50 p-6">
              <p className="text-sm font-bold text-red-700">
                Expert not found.
              </p>
            </section>
          ) : null}
        </div>
      </AdminDashboardShell>
    );
  }

  return (
    <AdminDashboardShell activeLabel="Experts">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <AdminPageTopbar
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
        />

        <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-sans text-2xl font-bold tracking-normal text-foreground">
              Experts
            </h1>
            <p className="mt-1 text-sm text-foreground/60">
              Manage expert profiles for Ancient Trails.
            </p>
          </div>

          <Button
            type="button"
            onClick={openAddExpertSheet}
            className="h-10 rounded-sm px-4 text-xs font-bold"
          >
            <Plus className="size-4" data-icon="inline-start" />
            Add New Expert
          </Button>
        </section>

        <section
          data-admin-metric-grid
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {expertMetrics.map((metric) => (
            <ExpertMetricCard key={metric.label} metric={metric} />
          ))}
        </section>

        <section className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
          <ExpertFilters
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
          />
          <ExpertTable
            experts={filteredExperts}
            isDeletingExpertId={isDeletingExpertId}
            isLoading={isLoadingExperts}
            onDelete={handleDeleteExpert}
            onEdit={openEditExpertSheet}
            onView={openViewExpertSheet}
            totalCount={experts.length}
          />
        </section>
      </div>

      <ExpertFormDialog
        form={expertForm}
        mode={expertSheetMode}
        isBusy={isExpertFormBusy}
        isOpen={isExpertSheetOpen}
        isSaving={isSavingExpert}
        isUploadingImage={isUploadingExpertImage}
        onClose={closeExpertSheet}
        onImageUpload={handleExpertImageUpload}
        onSubmit={handleSaveExpert}
        onUpdate={updateExpertForm}
      />
    </AdminDashboardShell>
  );
}

function AdminPageTopbar({
  searchQuery,
  onSearchQueryChange,
}: {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
}) {
  const toast = useToast();

  return (
    <header className="hidden flex-col gap-4 border-b border-border pb-4 md:flex xl:flex-row xl:items-center xl:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <AdminSidebarToggle className="size-9 rounded-sm" />

        <div className="min-w-0">
          <h2 className="font-sans text-lg font-bold tracking-normal">
            Experts
          </h2>
          <div className="mt-1 flex items-center gap-2 text-xs text-foreground/55">
            <span>Dashboard</span>
            <span aria-hidden="true">&gt;</span>
            <span className="font-medium text-foreground/75">Experts</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[220px] flex-1 sm:flex-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
          <input
            className="h-10 w-full rounded-sm border border-border bg-white pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-foreground/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
            placeholder="Search experts..."
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </label>

        <button
          onClick={() =>
            toast.info("Notifications", "You have 3 expert notifications.")
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

function ExpertMetricCard({ metric }: { metric: ExpertMetric }) {
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
          <p className={cn("mt-2 text-[11px] font-semibold", metric.trendTone)}>
            {metric.trend}
          </p>
        </div>
      </div>
    </div>
  );
}

function ExpertFilters({
  searchQuery,
  onSearchQueryChange,
}: {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
        <label className="relative min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
          <input
            className="h-9 w-full rounded-sm border border-border bg-white pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-foreground/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
            placeholder="Search experts..."
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </label>
      </div>
    </div>
  );
}

function ExpertTable({
  experts,
  isDeletingExpertId,
  isLoading,
  onDelete,
  onEdit,
  onView,
  totalCount,
}: {
  experts: AdminExpert[];
  isDeletingExpertId: string | null;
  isLoading: boolean;
  onDelete: (expert: AdminExpert) => void;
  onEdit: (expert: AdminExpert) => void;
  onView: (expert: AdminExpert) => void;
  totalCount: number;
}) {
  return (
    <>
      <div className="max-w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[9%]" />
            <col className="w-[22%]" />
            <col className="w-[25%]" />
            <col className="w-[22%]" />
            <col className="w-[16%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead className="bg-muted/35 text-[11px] uppercase text-foreground/55">
            <tr>
              <th className="px-2 py-3 font-bold">Expert ID</th>
              <th className="px-2 py-3 font-bold">Full Name</th>
              <th className="px-2 py-3 font-bold">Expertise Tags</th>
              <th className="px-2 py-3 font-bold">Qualifications</th>
              <th className="px-2 py-3 font-bold">Languages</th>
              <th className="px-2 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  className="px-5 py-8 text-center text-xs text-foreground/55"
                  colSpan={6}
                >
                  Loading experts...
                </td>
              </tr>
            ) : null}

            {!isLoading && experts.length === 0 ? (
              <tr>
                <td
                  className="px-5 py-8 text-center text-xs text-foreground/55"
                  colSpan={6}
                >
                  No experts added yet.
                </td>
              </tr>
            ) : null}

            {!isLoading
              ? experts.map((expert) => (
                  <tr
                    key={expert.id}
                    className="border-t border-border transition-colors hover:bg-muted/25"
                  >
                    <td
                      data-label="Expert ID"
                      className="px-2 py-3 text-xs font-semibold text-foreground/70"
                    >
                      <span className="block truncate">{expert.expertId}</span>
                    </td>
                    <td
                      data-label="Full Name"
                      data-mobile-primary
                      className="px-2 py-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <ExpertAvatar image={expert.image} name={expert.fullName} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-foreground">
                            {expert.fullName}
                          </p>
                          <p className="mt-1 truncate text-[10px] text-foreground/45">
                            Added on {formatDate(expert.createdAt)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td data-label="Expertise Tags" className="px-2 py-3">
                      <TagList values={expert.expertiseTags} />
                    </td>
                    <td
                      data-label="Qualifications"
                      className="px-2 py-3 text-xs text-foreground/70"
                    >
                      <span className="block truncate">
                        {formatListPreview(expert.qualifications)}
                      </span>
                    </td>
                    <td
                      data-label="Languages"
                      className="px-2 py-3 text-xs text-foreground/70"
                    >
                      <span className="block truncate">
                        {formatListPreview(expert.languages)}
                      </span>
                    </td>
                    <td data-actions data-label="Actions" className="px-2 py-3">
                      <ExpertActionsMenu
                        expert={expert}
                        isDeleting={isDeletingExpertId === expert.id}
                        onDelete={onDelete}
                        onEdit={onEdit}
                        onView={onView}
                      />
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-foreground/55">
          Showing {experts.length ? `1 to ${experts.length}` : "0"} of{" "}
          {totalCount} experts
        </p>
        <div className="flex items-center gap-2">
          <PaginationButton label="Previous" disabled>
            <ChevronDown className="size-4 rotate-90" />
          </PaginationButton>
          <PaginationButton label="Page 1" active>
            1
          </PaginationButton>
          <PaginationButton label="Next" disabled>
            <ChevronDown className="size-4 -rotate-90" />
          </PaginationButton>
        </div>
      </div>
    </>
  );
}

function ExpertAvatar({ image, name }: { image?: string; name: string }) {
  const resolvedImage = image ? getExpertMediaUrl(image) : "";

  return (
    <span
      className={cn(
        "grid size-12 shrink-0 place-items-center overflow-hidden rounded-sm bg-[#7a3b22] bg-cover bg-center text-xs font-bold text-white",
        resolvedImage && "bg-muted text-transparent"
      )}
      style={
        resolvedImage
          ? {
              backgroundImage: `url("${resolvedImage}")`,
            }
          : undefined
      }
      aria-label={`${name} expert image`}
    >
      {!resolvedImage ? getInitials(name) : null}
    </span>
  );
}

function TagList({ values }: { values: string[] }) {
  if (values.length === 0) {
    return <span className="text-xs text-foreground/45">-</span>;
  }

  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {values.slice(0, 3).map((value) => (
        <span
          key={value}
          className="inline-flex h-6 max-w-full items-center rounded-sm bg-emerald-100 px-2 text-[11px] font-semibold text-emerald-700"
        >
          <span className="truncate">{value}</span>
        </span>
      ))}
      {values.length > 3 ? (
        <span className="inline-flex h-6 items-center rounded-sm bg-muted px-2 text-[11px] font-semibold text-foreground/60">
          +{values.length - 3}
        </span>
      ) : null}
    </div>
  );
}

function ExpertActionsMenu({
  expert,
  isDeleting,
  onDelete,
  onEdit,
  onView,
}: {
  expert: AdminExpert;
  isDeleting: boolean;
  onDelete: (expert: AdminExpert) => void;
  onEdit: (expert: AdminExpert) => void;
  onView: (expert: AdminExpert) => void;
}) {
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="grid size-10 place-items-center rounded-full border border-border bg-white text-foreground/65 transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-50"
              aria-label={`Open actions for ${expert.fullName}`}
              disabled={isDeleting}
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
            onClick={() => onView(expert)}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Eye className="size-4 text-foreground/60" />
            View
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onEdit(expert)}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Pencil className="size-4 text-primary" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(expert)}
            variant="destructive"
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Trash2 className="size-4" />
            {isDeleting ? "Deleting..." : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ExpertFormDialog({
  form,
  isBusy,
  mode,
  isOpen,
  isSaving,
  isUploadingImage,
  onClose,
  onImageUpload,
  onSubmit,
  onUpdate,
}: {
  form: ExpertFormState;
  isBusy: boolean;
  mode: ExpertSheetMode | null;
  isOpen: boolean;
  isSaving: boolean;
  isUploadingImage: boolean;
  onClose: () => void;
  onImageUpload: (files: FileList | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof ExpertFormState>(
    field: K,
    value: ExpertFormState[K]
  ) => void;
}) {
  const isReadOnly = mode === "view";
  const panelTitle =
    mode === "edit" ? "Edit Expert" : mode === "view" ? "View Expert" : "Add Expert";
  const panelDescription =
    mode === "edit"
      ? "Update the expert profile and credentials."
      : mode === "view"
        ? "Review the expert profile and credentials."
        : "Add the expert profile and credentials.";
  const submitButtonLabel = isSaving
    ? "Saving..."
    : isUploadingImage
      ? "Uploading image..."
    : mode === "edit"
      ? "Update Expert"
      : "Save Expert";
  const inputClassName =
    "h-11 rounded-sm border border-border bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";
  const textareaClassName =
    "min-h-28 rounded-sm border border-border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";

  if (!isOpen) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-col bg-white"
        >
          <div className="border-b border-border px-7 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-sans text-xl font-bold tracking-normal text-foreground">
                  {panelTitle}
                </h2>
                <p className="mt-1 text-xs text-foreground/55">
                  {panelDescription}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isBusy}
                className="grid size-8 shrink-0 place-items-center rounded-sm border border-emerald-600 bg-white text-emerald-700 transition-colors hover:bg-emerald-50 disabled:pointer-events-none disabled:opacity-50"
                aria-label="Close expert form"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-5 px-7 py-6 sm:grid-cols-2">
            <FormField label="Expert ID" required>
              <input
                required
                readOnly={isReadOnly}
                value={form.expertId}
                onChange={(event) => onUpdate("expertId", event.target.value)}
                className={inputClassName}
                placeholder="AT-EXP-001"
              />
            </FormField>

            <FormField label="Full Name" required>
              <input
                required
                readOnly={isReadOnly}
                value={form.fullName}
                onChange={(event) => onUpdate("fullName", event.target.value)}
                className={inputClassName}
                placeholder="Dr. Meera Sharma"
              />
            </FormField>

            <FormField className="sm:col-span-2" label="Expert Image">
              <div className="grid gap-3 sm:grid-cols-[132px_minmax(0,1fr)]">
                <div
                  role="img"
                  aria-label={form.fullName || "Expert image preview"}
                  className={cn(
                    "grid aspect-square place-items-center overflow-hidden rounded-sm border border-border bg-white bg-cover bg-center text-foreground/35",
                    !form.image.trim() && "bg-muted/45"
                  )}
                  style={
                    form.image.trim()
                      ? {
                          backgroundImage: `url("${getExpertMediaUrl(form.image)}")`,
                        }
                      : undefined
                  }
                >
                  {!form.image.trim() ? <ImageIcon className="size-8" /> : null}
                </div>
                <div className="grid gap-3">
                  {!isReadOnly ? (
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isBusy}
                      onChange={(event) => {
                        onImageUpload(event.target.files);
                        event.currentTarget.value = "";
                      }}
                      className="block h-11 w-full rounded-sm border border-border bg-white px-3 py-2 text-sm file:mr-3 file:rounded-sm file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60"
                    />
                  ) : null}
                  <input
                    readOnly={isReadOnly}
                    value={form.image}
                    onChange={(event) => onUpdate("image", event.target.value)}
                    className={inputClassName}
                    placeholder="/uploads/experts/expert.webp"
                  />
                </div>
              </div>
            </FormField>

            <FormField className="sm:col-span-2" label="Full Biography">
              <textarea
                readOnly={isReadOnly}
                value={form.fullBiography}
                onChange={(event) =>
                  onUpdate("fullBiography", event.target.value)
                }
                className={cn(textareaClassName, "min-h-36")}
                placeholder="Heritage researcher and cultural travel mentor."
              />
            </FormField>

            <FormField className="sm:col-span-2" label="Expertise Tags">
              <textarea
                readOnly={isReadOnly}
                value={form.expertiseTags}
                onChange={(event) =>
                  onUpdate("expertiseTags", event.target.value)
                }
                className={textareaClassName}
                placeholder="Temple Architecture, Archaeology, Folk Traditions"
              />
            </FormField>

            <FormField className="sm:col-span-2" label="Qualifications">
              <textarea
                readOnly={isReadOnly}
                value={form.qualifications}
                onChange={(event) =>
                  onUpdate("qualifications", event.target.value)
                }
                className={textareaClassName}
                placeholder="PhD in Ancient Indian History, INTACH Consultant"
              />
            </FormField>

            <FormField className="sm:col-span-2" label="Languages">
              <textarea
                readOnly={isReadOnly}
                value={form.languages}
                onChange={(event) => onUpdate("languages", event.target.value)}
                className={textareaClassName}
                placeholder="English, Hindi, Kannada"
              />
            </FormField>
          </div>

          {!isReadOnly ? (
            <div className="border-t border-border bg-white px-7 py-6">
              <Button
                type="submit"
                disabled={isBusy}
                className="h-11 rounded-sm px-4 text-sm font-bold"
              >
                {submitButtonLabel}
              </Button>
            </div>
          ) : null}
        </form>
    </section>
  );
}

function FormField({
  children,
  className,
  label,
  required = false,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-2", className)}>
      <span className="text-xs font-bold uppercase tracking-normal text-foreground/55">
        {label}
        {required ? <span className="text-primary"> *</span> : null}
      </span>
      {children}
    </label>
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
