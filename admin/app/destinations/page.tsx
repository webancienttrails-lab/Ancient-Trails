"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  AdminDashboardShell,
  AdminSidebarToggle,
} from "@/components/admin-dashboard/admin-dashboard-shell";
import { HeaderDateRangePicker } from "@/components/admin-dashboard/header-date-range-picker";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import {
  createAdminDestination,
  getDestinationMediaUrl,
  listAdminDestinations,
  updateAdminDestination,
  uploadDestinationImages,
  type AdminDestination,
  type DestinationPayload,
  type DestinationType,
} from "@/lib/destinations";
import { cn } from "@/lib/utils";

type DestinationMetric = {
  label: string;
  value: string;
  trend: string;
  icon: LucideIcon;
  tone: string;
  trendTone: string;
};

type DestinationFormState = Omit<
  DestinationPayload,
  "keyLandmarks" | "galleryImages" | "recommendedDurationDays"
> & {
  keyLandmarks: string;
  galleryImages: string;
  recommendedDurationDays: string;
};
type DestinationSheetMode = "add" | "view" | "edit";

const emptyDestinationForm: DestinationFormState = {
  destinationId: "",
  destinationName: "",
  destinationType: "Domestic",
  countryRegion: "",
  state: "",
  city: "",
  primaryHeritageFocus: "",
  unescoSite: false,
  keyLandmarks: "",
  recommendedDurationDays: "1",
  shortDescription: "",
  dressCode: "",
  footwear: "",
  permits: "",
  idRequirement: "",
  restrictions: "",
  bannerImage: "",
  galleryImages: "",
};

const thumbTones = [
  "from-orange-500 via-amber-300 to-stone-700",
  "from-amber-500 via-orange-200 to-stone-800",
  "from-sky-500 via-orange-200 to-stone-800",
  "from-lime-600 via-amber-200 to-stone-700",
  "from-green-600 via-lime-200 to-cyan-700",
  "from-emerald-500 via-sky-300 to-slate-700",
];

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

function appendTextList(currentValue: string, newValues: string[]): string {
  return Array.from(new Set([...parseTextList(currentValue), ...newValues]))
    .join("\n");
}

function destinationToForm(destination: AdminDestination): DestinationFormState {
  return {
    destinationId: destination.destinationId,
    destinationName: destination.destinationName,
    destinationType: destination.destinationType,
    countryRegion: destination.countryRegion,
    state: destination.state,
    city: destination.city,
    primaryHeritageFocus: destination.primaryHeritageFocus,
    unescoSite: destination.unescoSite,
    keyLandmarks: destination.keyLandmarks.join("\n"),
    recommendedDurationDays: destination.recommendedDurationDays.toString(),
    shortDescription: destination.shortDescription,
    dressCode: destination.dressCode,
    footwear: destination.footwear,
    permits: destination.permits,
    idRequirement: destination.idRequirement,
    restrictions: destination.restrictions,
    bannerImage: destination.bannerImage,
    galleryImages: destination.galleryImages.join("\n"),
  };
}

function createDestinationPayload(
  destinationForm: DestinationFormState
): DestinationPayload {
  return {
    ...destinationForm,
    destinationId: destinationForm.destinationId.trim(),
    destinationName: destinationForm.destinationName.trim(),
    countryRegion: destinationForm.countryRegion.trim(),
    state: destinationForm.state.trim(),
    city: destinationForm.city.trim(),
    primaryHeritageFocus: destinationForm.primaryHeritageFocus.trim(),
    recommendedDurationDays:
      Number(destinationForm.recommendedDurationDays) || 1,
    shortDescription: destinationForm.shortDescription.trim(),
    dressCode: destinationForm.dressCode.trim(),
    footwear: destinationForm.footwear.trim(),
    permits: destinationForm.permits.trim(),
    idRequirement: destinationForm.idRequirement.trim(),
    restrictions: destinationForm.restrictions.trim(),
    keyLandmarks: parseTextList(destinationForm.keyLandmarks),
    bannerImage: destinationForm.bannerImage.trim(),
    galleryImages: parseTextList(destinationForm.galleryImages),
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

function createDestinationMetrics(
  destinations: AdminDestination[]
): DestinationMetric[] {
  const domesticCount = destinations.filter(
    (destination) => destination.destinationType === "Domestic"
  ).length;
  const internationalCount = destinations.filter(
    (destination) => destination.destinationType === "International"
  ).length;
  const unescoCount = destinations.filter(
    (destination) => destination.unescoSite
  ).length;

  return [
    {
      label: "Total Destinations",
      value: destinations.length.toString(),
      trend: "Live destination records",
      icon: MapPin,
      tone: "bg-primary/10 text-primary",
      trendTone: "text-emerald-600",
    },
    {
      label: "Domestic",
      value: domesticCount.toString(),
      trend: "Indian heritage routes",
      icon: CheckCircle2,
      tone: "bg-emerald-100 text-emerald-700",
      trendTone: "text-emerald-600",
    },
    {
      label: "International",
      value: internationalCount.toString(),
      trend: "Global heritage routes",
      icon: Clock3,
      tone: "bg-amber-100 text-amber-700",
      trendTone: "text-amber-600",
    },
    {
      label: "UNESCO Sites",
      value: unescoCount.toString(),
      trend: "Marked as UNESCO",
      icon: Eye,
      tone: "bg-violet-100 text-violet-700",
      trendTone: "text-violet-600",
    },
  ];
}

export default function DestinationsPage() {
  const toast = useToast();
  const [destinations, setDestinations] = useState<AdminDestination[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingDestinations, setIsLoadingDestinations] = useState(true);
  const [destinationSheetMode, setDestinationSheetMode] =
    useState<DestinationSheetMode | null>(null);
  const [selectedDestination, setSelectedDestination] =
    useState<AdminDestination | null>(null);
  const [isSavingDestination, setIsSavingDestination] = useState(false);
  const [isUploadingBannerImage, setIsUploadingBannerImage] = useState(false);
  const [isUploadingGalleryImages, setIsUploadingGalleryImages] =
    useState(false);
  const [destinationForm, setDestinationForm] =
    useState<DestinationFormState>(emptyDestinationForm);

  useEffect(() => {
    let isMounted = true;

    async function loadDestinations() {
      try {
        const response = await listAdminDestinations();

        if (isMounted) {
          setDestinations(response.data.destinations);
        }
      } catch (error) {
        toast.error("Unable to load destinations", getErrorMessage(error));
      } finally {
        if (isMounted) {
          setIsLoadingDestinations(false);
        }
      }
    }

    loadDestinations();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  const filteredDestinations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return destinations;
    }

    return destinations.filter((destination) =>
      [
        destination.destinationId,
        destination.destinationName,
        destination.destinationType,
        destination.countryRegion,
        destination.state,
        destination.city,
        destination.primaryHeritageFocus,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [destinations, searchQuery]);

  const destinationMetrics = useMemo(
    () => createDestinationMetrics(destinations),
    [destinations]
  );
  const isDestinationFormBusy =
    isSavingDestination || isUploadingBannerImage || isUploadingGalleryImages;
  const isDestinationSheetOpen = destinationSheetMode !== null;

  function updateDestinationForm<K extends keyof DestinationFormState>(
    field: K,
    value: DestinationFormState[K]
  ) {
    setDestinationForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function openAddDestinationSheet() {
    setSelectedDestination(null);
    setDestinationForm(emptyDestinationForm);
    setDestinationSheetMode("add");
  }

  function openViewDestinationSheet(destination: AdminDestination) {
    setSelectedDestination(destination);
    setDestinationForm(destinationToForm(destination));
    setDestinationSheetMode("view");
  }

  function openEditDestinationSheet(destination: AdminDestination) {
    setSelectedDestination(destination);
    setDestinationForm(destinationToForm(destination));
    setDestinationSheetMode("edit");
  }

  function closeDestinationSheet() {
    if (isDestinationFormBusy) {
      return;
    }

    setDestinationSheetMode(null);
    setSelectedDestination(null);
    setDestinationForm(emptyDestinationForm);
  }

  async function handleBannerImageUpload(files: FileList | null) {
    const [bannerImage] = Array.from(files || []);

    if (!bannerImage) {
      return;
    }

    setIsUploadingBannerImage(true);

    try {
      const response = await uploadDestinationImages({ bannerImage });

      setDestinationForm((currentForm) => ({
        ...currentForm,
        bannerImage: response.data.bannerImage,
      }));
      toast.success("Banner uploaded", response.message);
    } catch (error) {
      toast.error("Banner upload failed", getErrorMessage(error));
    } finally {
      setIsUploadingBannerImage(false);
    }
  }

  async function handleGalleryImagesUpload(files: FileList | null) {
    const galleryImages = Array.from(files || []);

    if (galleryImages.length === 0) {
      return;
    }

    setIsUploadingGalleryImages(true);

    try {
      const response = await uploadDestinationImages({ galleryImages });

      setDestinationForm((currentForm) => ({
        ...currentForm,
        galleryImages: appendTextList(
          currentForm.galleryImages,
          response.data.galleryImages
        ),
      }));
      toast.success("Gallery uploaded", response.message);
    } catch (error) {
      toast.error("Gallery upload failed", getErrorMessage(error));
    } finally {
      setIsUploadingGalleryImages(false);
    }
  }

  function handleRemoveBannerImage() {
    updateDestinationForm("bannerImage", "");
  }

  function handleRemoveGalleryImage(indexToRemove: number) {
    setDestinationForm((currentForm) => ({
      ...currentForm,
      galleryImages: parseTextList(currentForm.galleryImages)
        .filter((_image, index) => index !== indexToRemove)
        .join("\n"),
    }));
  }

  function handleDeleteDestination(destination: AdminDestination) {
    toast.warning(
      "Delete destination",
      `${destination.destinationName} delete confirmation will open here.`
    );
  }

  async function handleSaveDestination(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      destinationSheetMode === "view" ||
      isUploadingBannerImage ||
      isUploadingGalleryImages
    ) {
      return;
    }

    setIsSavingDestination(true);

    const payload = createDestinationPayload(destinationForm);

    try {
      if (destinationSheetMode === "edit" && selectedDestination) {
        const response = await updateAdminDestination(
          selectedDestination.id,
          payload
        );

        setDestinations((currentDestinations) =>
          currentDestinations.map((destination) =>
            destination.id === selectedDestination.id
              ? response.data.destination
              : destination
          )
        );
        setDestinationSheetMode(null);
        setSelectedDestination(null);
        setDestinationForm(emptyDestinationForm);
        toast.success("Destination updated", response.message);
        return;
      }

      const response = await createAdminDestination(payload);

      setDestinations((currentDestinations) => [
        response.data.destination,
        ...currentDestinations,
      ]);
      setDestinationSheetMode(null);
      setSelectedDestination(null);
      setDestinationForm(emptyDestinationForm);
      toast.success("Destination added", response.message);
    } catch (error) {
      toast.error(
        destinationSheetMode === "edit"
          ? "Destination not updated"
          : "Destination not saved",
        getErrorMessage(error)
      );
    } finally {
      setIsSavingDestination(false);
    }
  }

  return (
    <AdminDashboardShell activeLabel="Destinations">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <AdminPageTopbar
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
        />

        <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-sans text-2xl font-bold tracking-normal text-foreground">
              Destinations
            </h1>
            <p className="mt-1 text-sm text-foreground/60">
              Manage all travel destinations on your website.
            </p>
          </div>

          <Button
            type="button"
            onClick={openAddDestinationSheet}
            className="h-10 rounded-sm px-4 text-xs font-bold"
          >
            <Plus className="size-4" data-icon="inline-start" />
            Add New Destination
          </Button>
        </section>

        <section
          data-admin-metric-grid
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {destinationMetrics.map((metric) => (
            <DestinationMetricCard key={metric.label} metric={metric} />
          ))}
        </section>

        <section className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
          <DestinationFilters
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
          />
          <DestinationTable
            destinations={filteredDestinations}
            isLoading={isLoadingDestinations}
            onDelete={handleDeleteDestination}
            onEdit={openEditDestinationSheet}
            onView={openViewDestinationSheet}
            totalCount={destinations.length}
          />
        </section>
      </div>

      <DestinationFormDialog
        form={destinationForm}
        mode={destinationSheetMode}
        isOpen={isDestinationSheetOpen}
        isBusy={isDestinationFormBusy}
        isSaving={isSavingDestination}
        isUploadingBannerImage={isUploadingBannerImage}
        isUploadingGalleryImages={isUploadingGalleryImages}
        onBannerImageUpload={handleBannerImageUpload}
        onClose={closeDestinationSheet}
        onGalleryImagesUpload={handleGalleryImagesUpload}
        onRemoveBannerImage={handleRemoveBannerImage}
        onRemoveGalleryImage={handleRemoveGalleryImage}
        onSubmit={handleSaveDestination}
        onUpdate={updateDestinationForm}
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
            Destinations
          </h2>
          <div className="mt-1 flex items-center gap-2 text-xs text-foreground/55">
            <span>Dashboard</span>
            <span aria-hidden="true">&gt;</span>
            <span className="font-medium text-foreground/75">Destinations</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[220px] flex-1 sm:flex-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
          <input
            className="h-10 w-full rounded-sm border border-border bg-white pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-foreground/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
            placeholder="Search destinations..."
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </label>

        <HeaderDateRangePicker />

        <button
          onClick={() =>
            toast.info("Notifications", "You have 6 destination notifications.")
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

function DestinationMetricCard({ metric }: { metric: DestinationMetric }) {
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

function DestinationFilters({
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
            placeholder="Search destinations..."
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </label>
      </div>
    </div>
  );
}

function DestinationTable({
  destinations,
  isLoading,
  onDelete,
  onEdit,
  onView,
  totalCount,
}: {
  destinations: AdminDestination[];
  isLoading: boolean;
  onDelete: (destination: AdminDestination) => void;
  onEdit: (destination: AdminDestination) => void;
  onView: (destination: AdminDestination) => void;
  totalCount: number;
}) {
  return (
    <>
      <div className="max-w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[12%]" />
            <col className="w-[28%]" />
            <col className="w-[10%]" />
            <col className="w-[16%]" />
            <col className="w-[14%]" />
            <col className="w-[8%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead className="bg-muted/35 text-[11px] uppercase text-foreground/55">
            <tr>
              <th className="px-2.5 py-3 font-bold">Destination ID</th>
              <th className="px-3 py-3 font-bold">Destination</th>
              <th className="px-2.5 py-3 font-bold">Type</th>
              <th className="px-2.5 py-3 font-bold">Country / Region</th>
              <th className="px-2.5 py-3 font-bold">State / City</th>
              <th className="px-2.5 py-3 font-bold">UNESCO</th>
              <th className="px-2.5 py-3 font-bold">Days</th>
              <th className="px-2.5 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-5 py-8 text-center text-xs text-foreground/55" colSpan={8}>
                  Loading destinations...
                </td>
              </tr>
            ) : null}

            {!isLoading && destinations.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-center text-xs text-foreground/55" colSpan={8}>
                  No destinations added yet.
                </td>
              </tr>
            ) : null}

            {!isLoading
              ? destinations.map((destination, index) => (
                  <tr
                    key={destination.id}
                    className="border-t border-border transition-colors hover:bg-muted/25"
                  >
                    <td
                      data-label="Destination ID"
                      className="px-2.5 py-3 text-xs font-semibold text-foreground/70"
                    >
                      <span className="block truncate">
                        {destination.destinationId}
                      </span>
                    </td>
                    <td
                      data-label="Destination"
                      data-mobile-primary
                      className="px-3 py-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <DestinationThumb
                          photo={
                            destination.bannerImage ||
                            destination.galleryImages[0]
                          }
                          tone={thumbTones[index % thumbTones.length]}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-foreground">
                            {destination.destinationName}
                          </p>
                          <p className="mt-1 text-[10px] text-foreground/45">
                            Added on {formatDate(destination.createdAt)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td data-label="Type" className="px-2.5 py-3">
                      <span
                        className={cn(
                          "inline-flex h-6 max-w-full items-center rounded-sm px-2 text-[11px] font-semibold",
                          destination.destinationType === "Domestic"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-violet-100 text-violet-700"
                        )}
                      >
                        {destination.destinationType}
                      </span>
                    </td>
                    <td data-label="Country / Region" className="px-2.5 py-3">
                      <div className="flex min-w-0 items-center gap-2 text-xs text-foreground/70">
                        <CountryFlag country={destination.countryRegion} />
                        <span className="truncate">
                          {destination.countryRegion}
                        </span>
                      </div>
                    </td>
                    <td
                      data-label="State / City"
                      className="px-2.5 py-3 text-xs text-foreground/70"
                    >
                      <span className="block truncate font-semibold">
                        {destination.state || "-"}
                      </span>
                      <span className="mt-1 block truncate text-foreground/50">
                        {destination.city || "-"}
                      </span>
                    </td>
                    <td
                      data-label="UNESCO"
                      className="px-2.5 py-3 text-xs font-semibold text-foreground/70"
                    >
                      {destination.unescoSite ? "Yes" : "No"}
                    </td>
                    <td data-label="Days" className="px-2.5 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-foreground/65">
                        <CalendarDays className="size-3.5 shrink-0" />
                        <span>{destination.recommendedDurationDays}</span>
                      </span>
                    </td>
                    <td
                      data-actions
                      data-label="Actions"
                      className="px-2.5 py-3"
                    >
                      <DestinationActionsMenu
                        destination={destination}
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
          Showing {destinations.length ? `1 to ${destinations.length}` : "0"} of{" "}
          {totalCount} destinations
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

function DestinationActionsMenu({
  destination,
  onDelete,
  onEdit,
  onView,
}: {
  destination: AdminDestination;
  onDelete: (destination: AdminDestination) => void;
  onEdit: (destination: AdminDestination) => void;
  onView: (destination: AdminDestination) => void;
}) {
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="grid size-10 place-items-center rounded-full border border-border bg-white text-foreground/65 transition-colors hover:border-primary hover:text-primary"
              aria-label={`Open actions for ${destination.destinationName}`}
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
            onClick={() => onView(destination)}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Eye className="size-4 text-foreground/60" />
            View
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onEdit(destination)}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Pencil className="size-4 text-primary" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(destination)}
            variant="destructive"
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function DestinationThumb({ photo, tone }: { photo?: string; tone: string }) {
  return (
    <div
      className={cn(
        "grid h-14 w-20 shrink-0 place-items-center overflow-hidden rounded-sm bg-gradient-to-br",
        !photo && tone
      )}
      style={
        photo
          ? {
              backgroundImage: `url("${getDestinationMediaUrl(photo)}")`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }
          : undefined
      }
    >
      {!photo ? <MapPin className="size-5 text-white/80" /> : null}
    </div>
  );
}

function CountryFlag({ country }: { country: string }) {
  if (country.toLowerCase().includes("egypt")) {
    return (
      <span className="grid h-3 w-5 overflow-hidden rounded-sm border border-border">
        <span className="bg-red-500" />
        <span className="bg-white" />
        <span className="bg-black" />
      </span>
    );
  }

  return (
    <span className="grid h-3 w-5 overflow-hidden rounded-sm border border-border">
      <span className="bg-orange-500" />
      <span className="bg-white" />
      <span className="bg-emerald-600" />
    </span>
  );
}

function DestinationFormDialog({
  form,
  isBusy,
  mode,
  isOpen,
  isSaving,
  isUploadingBannerImage,
  isUploadingGalleryImages,
  onBannerImageUpload,
  onClose,
  onGalleryImagesUpload,
  onRemoveBannerImage,
  onRemoveGalleryImage,
  onSubmit,
  onUpdate,
}: {
  form: DestinationFormState;
  isBusy: boolean;
  mode: DestinationSheetMode | null;
  isOpen: boolean;
  isSaving: boolean;
  isUploadingBannerImage: boolean;
  isUploadingGalleryImages: boolean;
  onBannerImageUpload: (files: FileList | null) => void;
  onClose: () => void;
  onGalleryImagesUpload: (files: FileList | null) => void;
  onRemoveBannerImage: () => void;
  onRemoveGalleryImage: (index: number) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof DestinationFormState>(
    field: K,
    value: DestinationFormState[K]
  ) => void;
}) {
  const isReadOnly = mode === "view";
  const sheetTitle =
    mode === "edit"
      ? "Edit Destination"
      : mode === "view"
        ? "View Destination"
        : "Add Destination";
  const sheetDescription =
    mode === "edit"
      ? "Update the destination profile and travel requirements."
      : mode === "view"
        ? "Review the destination profile and travel requirements."
        : "Add the destination profile and travel requirements.";
  const submitButtonLabel = isSaving
    ? "Saving..."
    : isUploadingBannerImage || isUploadingGalleryImages
      ? "Uploading images..."
      : mode === "edit"
        ? "Update Destination"
      : "Save Destination";
  const inputClassName =
    "h-11 rounded-sm border border-border bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";
  const textareaClassName =
    "min-h-20 rounded-sm border border-border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 border-l border-border bg-white p-0 shadow-2xl shadow-stone-900/20 duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] data-[side=right]:w-full data-[side=right]:sm:max-w-[620px]"
      >
      <form
        onSubmit={onSubmit}
        className="flex h-full min-h-0 flex-col bg-white"
      >
        <SheetHeader className="border-b border-border px-7 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <SheetTitle className="font-sans text-xl font-bold tracking-normal text-foreground">
              {sheetTitle}
              </SheetTitle>
              <SheetDescription className="mt-1 text-xs text-foreground/55">
              {sheetDescription}
              </SheetDescription>
            </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
              className="grid size-8 shrink-0 place-items-center rounded-sm border border-emerald-600 bg-white text-emerald-700 transition-colors hover:bg-emerald-50 disabled:pointer-events-none disabled:opacity-50"
            aria-label="Close add destination form"
          >
              <X className="size-4" />
          </button>
          </div>
        </SheetHeader>

          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-7 py-6 sm:grid-cols-2">
          <FormField label="Destination ID" required>
            <input
              required
              readOnly={isReadOnly}
              value={form.destinationId}
              onChange={(event) =>
                onUpdate("destinationId", event.target.value)
              }
                className={inputClassName}
              placeholder="AT-RAJ-001"
            />
          </FormField>

          <FormField label="Destination Name" required>
            <input
              required
              readOnly={isReadOnly}
              value={form.destinationName}
              onChange={(event) =>
                onUpdate("destinationName", event.target.value)
              }
                className={inputClassName}
              placeholder="Rajasthan Heritage Trail"
            />
          </FormField>

          <FormField label="Destination Type" required>
            <Select
              disabled={isReadOnly}
              required
              value={form.destinationType}
              onValueChange={(value) => {
                if (value === "Domestic" || value === "International") {
                  onUpdate("destinationType", value as DestinationType);
                }
              }}
            >
              <SelectTrigger className={inputClassName}>
                <SelectValue placeholder="Select destination type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Domestic">Domestic</SelectItem>
                <SelectItem value="International">International</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Country / Region" required>
            <input
              required
              readOnly={isReadOnly}
              value={form.countryRegion}
              onChange={(event) =>
                onUpdate("countryRegion", event.target.value)
              }
                className={inputClassName}
              placeholder="India"
            />
          </FormField>

          <FormField label="State">
            <input
              readOnly={isReadOnly}
              value={form.state}
              onChange={(event) => onUpdate("state", event.target.value)}
                className={inputClassName}
              placeholder="Rajasthan"
            />
          </FormField>

          <FormField label="City">
            <input
              readOnly={isReadOnly}
              value={form.city}
              onChange={(event) => onUpdate("city", event.target.value)}
                className={inputClassName}
              placeholder="Jaipur"
            />
          </FormField>

          <FormField label="Primary Heritage Focus">
            <input
              readOnly={isReadOnly}
              value={form.primaryHeritageFocus}
              onChange={(event) =>
                onUpdate("primaryHeritageFocus", event.target.value)
              }
                className={inputClassName}
              placeholder="Forts, palaces, living traditions"
            />
          </FormField>

          <FormField label="Recommended Duration (Days)" required>
            <input
              required
              min={1}
              readOnly={isReadOnly}
              type="number"
              value={form.recommendedDurationDays}
              onChange={(event) =>
                onUpdate("recommendedDurationDays", event.target.value)
              }
                className={inputClassName}
            />
          </FormField>

            <label className="flex h-11 items-center gap-3 rounded-sm border border-border bg-muted/35 px-3 text-sm font-semibold">
            <input
              checked={form.unescoSite}
              disabled={isReadOnly}
              onChange={(event) =>
                onUpdate("unescoSite", event.target.checked)
              }
              type="checkbox"
              className="size-4 accent-primary"
            />
            UNESCO Site
          </label>

            <FormField className="sm:col-span-2" label="Key Landmarks">
            <textarea
              readOnly={isReadOnly}
              value={form.keyLandmarks}
              onChange={(event) =>
                onUpdate("keyLandmarks", event.target.value)
              }
                className={textareaClassName}
              placeholder="Amber Fort, Hawa Mahal, City Palace"
            />
          </FormField>

            <FormField className="sm:col-span-2" label="Short Description">
            <textarea
              readOnly={isReadOnly}
              value={form.shortDescription}
              onChange={(event) =>
                onUpdate("shortDescription", event.target.value)
              }
                className={textareaClassName}
              placeholder="A concise public-facing destination summary."
            />
          </FormField>

          <FormField label="Dress Code">
            <input
              readOnly={isReadOnly}
              value={form.dressCode}
              onChange={(event) => onUpdate("dressCode", event.target.value)}
                className={inputClassName}
              placeholder="Modest clothing for temples"
            />
          </FormField>

          <FormField label="Footwear">
            <input
              readOnly={isReadOnly}
              value={form.footwear}
              onChange={(event) => onUpdate("footwear", event.target.value)}
                className={inputClassName}
              placeholder="Comfortable walking shoes"
            />
          </FormField>

          <FormField label="Permits">
            <input
              readOnly={isReadOnly}
              value={form.permits}
              onChange={(event) => onUpdate("permits", event.target.value)}
                className={inputClassName}
              placeholder="Entry passes where required"
            />
          </FormField>

          <FormField label="ID Requirement">
            <input
              readOnly={isReadOnly}
              value={form.idRequirement}
              onChange={(event) =>
                onUpdate("idRequirement", event.target.value)
              }
                className={inputClassName}
              placeholder="Government ID required"
            />
          </FormField>

            <FormField className="sm:col-span-2" label="Restrictions">
            <textarea
              readOnly={isReadOnly}
              value={form.restrictions}
              onChange={(event) =>
                onUpdate("restrictions", event.target.value)
              }
                className={textareaClassName}
              placeholder="Photography restrictions, access limits, timings"
            />
          </FormField>

            <FormField className="sm:col-span-2" label="Banner Image">
              {!isReadOnly ? (
                <UploadField
                  accept="image/*"
                  disabled={isBusy}
                  isUploading={isUploadingBannerImage}
                  label="Upload banner image"
                  onFilesSelected={onBannerImageUpload}
                />
              ) : null}
              <ImagePreviewGrid
                images={form.bannerImage.trim() ? [form.bannerImage.trim()] : []}
                onRemove={!isReadOnly ? onRemoveBannerImage : undefined}
                variant="banner"
              />
            </FormField>

            <FormField className="sm:col-span-2" label="Gallery Images">
              {!isReadOnly ? (
                <UploadField
                  accept="image/*"
                  disabled={isBusy}
                  isUploading={isUploadingGalleryImages}
                  label="Upload gallery images"
                  multiple
                  onFilesSelected={onGalleryImagesUpload}
                />
              ) : null}
              <ImagePreviewGrid
                images={parseTextList(form.galleryImages)}
                onRemove={!isReadOnly ? onRemoveGalleryImage : undefined}
              />
          </FormField>
        </div>

          {!isReadOnly ? (
          <SheetFooter className="border-t border-border bg-white px-7 py-6">
          <Button
            type="submit"
            disabled={isBusy}
              className="h-11 rounded-sm px-4 text-sm font-bold"
          >
            {submitButtonLabel}
          </Button>
          </SheetFooter>
          ) : null}
      </form>
      </SheetContent>
    </Sheet>
  );
}

function ImagePreviewGrid({
  images,
  onRemove,
  variant = "gallery",
}: {
  images: string[];
  onRemove?: (index: number) => void;
  variant?: "banner" | "gallery";
}) {
  if (images.length === 0) {
    return (
      <div
        className={cn(
          "grid place-items-center rounded-sm border border-dashed border-border bg-muted/35 text-xs font-medium text-foreground/45",
          variant === "banner" ? "h-28" : "h-20"
        )}
      >
        Preview will appear here
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-2",
        variant === "banner" ? "grid-cols-1" : "grid-cols-3"
      )}
    >
      {images.slice(0, variant === "banner" ? 1 : 6).map((image, index) => (
        <div
          key={`${image}-${index}`}
          className={cn(
            "relative overflow-hidden rounded-sm border border-border bg-muted",
            variant === "banner" ? "h-32" : "h-20"
          )}
        >
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="absolute right-1.5 top-1.5 z-10 grid size-6 place-items-center rounded-sm border border-white/70 bg-white/95 text-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
              aria-label={
                variant === "banner"
                  ? "Remove banner image"
                  : `Remove gallery image ${index + 1}`
              }
            >
              <X className="size-3.5" />
            </button>
          ) : null}
          <div
            className="h-full w-full bg-cover bg-center"
            role="img"
            aria-label={
              variant === "banner"
                ? "Destination banner preview"
                : `Destination gallery preview ${index + 1}`
            }
            style={{
              backgroundImage: `url("${getDestinationMediaUrl(image)}")`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

function UploadField({
  accept,
  disabled,
  isUploading,
  label,
  multiple,
  onFilesSelected,
}: {
  accept: string;
  disabled: boolean;
  isUploading: boolean;
  label: string;
  multiple?: boolean;
  onFilesSelected: (files: FileList | null) => void;
}) {
  return (
    <label
      className={cn(
        "flex h-11 cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed border-primary/30 bg-primary/5 px-3 text-sm font-bold text-primary transition-colors hover:border-primary hover:bg-primary/10",
        disabled && "pointer-events-none cursor-not-allowed opacity-60"
      )}
    >
      <Upload className="size-4 shrink-0" />
      <span>{isUploading ? "Uploading..." : label}</span>
      <input
        accept={accept}
        className="sr-only"
        disabled={disabled}
        multiple={multiple}
        onChange={(event) => {
          onFilesSelected(event.target.files);
          event.target.value = "";
        }}
        type="file"
      />
    </label>
  );
}

function FormField({
  children,
  className,
  label,
  required,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className={cn("grid gap-1.5 text-xs font-bold text-foreground", className)}>
      <span>
        {label}
        {required ? <span className="text-primary"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function PaginationButton({
  children,
  label,
  active,
  disabled,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className={cn(
        "grid size-8 place-items-center rounded-sm border border-border bg-white text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-45",
        active && "border-primary bg-primary text-primary-foreground hover:text-white"
      )}
    >
      {children}
    </button>
  );
}
