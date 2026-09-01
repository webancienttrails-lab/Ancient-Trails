"use client";

import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronDown,
  Eye,
  FileText,
  Image as ImageIcon,
  MapPin,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
  Video,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import {
  listAdminDestinations,
  type AdminDestination,
} from "@/lib/destinations";
import {
  createAdminExperience,
  deleteAdminExperience,
  getExperiencePhotoSizeMessage,
  getExperienceMediaUrl,
  getUploadableExperiencePhotos,
  listAdminExperiences,
  updateAdminExperience,
  uploadExperienceMedia,
  type AdminExperience,
  type ExperienceAttractionPhoto,
  type ExperiencePayload,
  type ExperienceStatus,
} from "@/lib/experiences";
import { cn } from "@/lib/utils";

type ExperienceMetric = {
  label: string;
  value: string;
  trend: string;
  icon: LucideIcon;
  tone: string;
  trendTone: string;
};

type ExperienceSheetMode = "add" | "view" | "edit";

type ExperienceFormState = Omit<
  ExperiencePayload,
  | "ratingAccommodation"
  | "ratingItinerary"
  | "ratingLocalTransport"
  | "ratingTourExpert"
  | "thingsToKnow"
  | "travellerPhotoGallery"
  | "travellerVideos"
  | "travellerVideoTitles"
  | "attractionPhotoGallery"
> & {
  ratingAccommodation: string;
  ratingItinerary: string;
  ratingLocalTransport: string;
  ratingTourExpert: string;
  thingsToKnow: string;
  travellerPhotoGallery: string;
  travellerVideos: string;
  travellerVideoTitles: string;
  attractionPhotoGallery: ExperienceAttractionPhoto[];
};

const emptyExperienceForm: ExperienceFormState = {
  experienceId: "",
  destinationId: "",
  travellerName: "",
  travellerEmail: "",
  title: "",
  writtenReview: "",
  thingsToKnow: "",
  travellerPhotoGallery: "",
  travellerVideos: "",
  travellerVideoTitles: "",
  attractionPhotoGallery: [],
  ratingItinerary: "5",
  ratingLocalTransport: "5",
  ratingAccommodation: "5",
  ratingTourExpert: "5",
  status: "Draft",
};

const statusOptions: Array<"All Status" | ExperienceStatus> = [
  "All Status",
  "Draft",
  "Published",
];
const mediaMetaInputClassName =
  "h-10 rounded-sm border border-border bg-white px-3 text-xs font-semibold outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35";

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
  return Array.from(new Set([...parseTextList(currentValue), ...newValues])).join(
    "\n"
  );
}

function getIndexedTextList(value: string, length: number): string[] {
  const values = value.split(/\r?\n/).map((item) => item.trim());

  return Array.from({ length }, (_item, index) => values[index] || "");
}

function joinIndexedTextList(values: string[]): string {
  return values.map((value) => value.trim()).join("\n");
}

function getAttractionPhotoGallery(
  photos: ExperienceAttractionPhoto[] = []
): ExperienceAttractionPhoto[] {
  const seenImages = new Set<string>();

  return photos
    .map((photo) => ({
      image: photo.image.trim(),
      name: photo.name.trim(),
    }))
    .filter((photo) => {
      if (!photo.image || seenImages.has(photo.image)) {
        return false;
      }

      seenImages.add(photo.image);

      return true;
    });
}

function createMediaName(file: File): string {
  return file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

function getRatingValue(value: string | number): number {
  const rating = Number(value);

  if (!Number.isFinite(rating)) {
    return 1;
  }

  return Math.min(5, Math.max(1, rating));
}

function calculateOverallRating(form: Pick<
  ExperienceFormState,
  | "ratingAccommodation"
  | "ratingItinerary"
  | "ratingLocalTransport"
  | "ratingTourExpert"
>) {
  const values = [
    form.ratingItinerary,
    form.ratingLocalTransport,
    form.ratingAccommodation,
    form.ratingTourExpert,
  ].map(getRatingValue);
  const total = values.reduce((sum, rating) => sum + rating, 0);

  return Number((total / values.length).toFixed(1));
}

function experienceToForm(experience: AdminExperience): ExperienceFormState {
  return {
    experienceId: experience.experienceId,
    destinationId: experience.destinationId,
    travellerName: experience.travellerName || "",
    travellerEmail: experience.travellerEmail || "",
    title: experience.title,
    writtenReview: experience.writtenReview || "",
    thingsToKnow: experience.thingsToKnow.join("\n"),
    travellerPhotoGallery: experience.travellerPhotoGallery.join("\n"),
    travellerVideos: experience.travellerVideos.join("\n"),
    travellerVideoTitles: joinIndexedTextList(
      getIndexedTextList(
        (experience.travellerVideoTitles || []).join("\n"),
        experience.travellerVideos.length
      )
    ),
    attractionPhotoGallery: getAttractionPhotoGallery(
      experience.attractionPhotoGallery
    ),
    ratingItinerary: experience.ratingItinerary.toString(),
    ratingLocalTransport: experience.ratingLocalTransport.toString(),
    ratingAccommodation: experience.ratingAccommodation.toString(),
    ratingTourExpert: experience.ratingTourExpert.toString(),
    status: experience.status,
  };
}

function createExperiencePayload(form: ExperienceFormState): ExperiencePayload {
  const travellerVideos = parseTextList(form.travellerVideos);

  return {
    experienceId: (form.experienceId || "").trim(),
    destinationId: form.destinationId.trim(),
    travellerName: form.travellerName.trim(),
    travellerEmail: form.travellerEmail.trim(),
    title: (form.title || "").trim(),
    writtenReview: form.writtenReview.trim(),
    thingsToKnow: parseTextList(form.thingsToKnow),
    travellerPhotoGallery: parseTextList(form.travellerPhotoGallery),
    travellerVideos,
    travellerVideoTitles: getIndexedTextList(
      form.travellerVideoTitles,
      travellerVideos.length
    ),
    attractionPhotoGallery: getAttractionPhotoGallery(form.attractionPhotoGallery),
    ratingItinerary: getRatingValue(form.ratingItinerary),
    ratingLocalTransport: getRatingValue(form.ratingLocalTransport),
    ratingAccommodation: getRatingValue(form.ratingAccommodation),
    ratingTourExpert: getRatingValue(form.ratingTourExpert),
    status: form.status,
  };
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}

function createDestinationNameById(destinations: AdminDestination[]) {
  return new Map(
    destinations.map((destination) => [
      destination.destinationId,
      destination.destinationName,
    ])
  );
}

function getDestinationName(
  experience: Pick<AdminExperience, "destinationId" | "destinationName">,
  destinationNameById: Map<string, string>
) {
  return (
    experience.destinationName ||
    destinationNameById.get(experience.destinationId) ||
    experience.destinationId
  );
}

function getExperienceDisplayName(experience: AdminExperience): string {
  return (
    experience.travellerName.trim() ||
    experience.destinationName ||
    experience.destinationId ||
    "Traveller experience"
  );
}

function createExperienceMetrics(
  experiences: AdminExperience[]
): ExperienceMetric[] {
  const publishedCount = experiences.filter(
    (experience) => experience.status === "Published"
  ).length;
  const draftCount = experiences.length - publishedCount;
  const totalPhotos = experiences.reduce(
    (total, experience) => total + experience.travellerPhotoGallery.length,
    0
  );
  const totalAttractionPhotos = experiences.reduce(
    (total, experience) => total + experience.attractionPhotoGallery.length,
    0
  );
  const totalVideos = experiences.reduce(
    (total, experience) => total + experience.travellerVideos.length,
    0
  );
  const averageRating =
    experiences.length > 0
      ? (
          experiences.reduce(
            (total, experience) => total + experience.overallRating,
            0
          ) / experiences.length
        ).toFixed(1)
      : "0.0";

  return [
    {
      label: "Total Experiences",
      value: experiences.length.toString(),
      trend: "Live experience records",
      icon: MapPin,
      tone: "bg-primary/10 text-primary",
      trendTone: "text-emerald-600",
    },
    {
      label: "Published",
      value: publishedCount.toString(),
      trend: "Visible-ready entries",
      icon: Star,
      tone: "bg-emerald-100 text-emerald-700",
      trendTone: "text-emerald-600",
    },
    {
      label: "Draft",
      value: draftCount.toString(),
      trend: "Pending review",
      icon: FileText,
      tone: "bg-amber-100 text-amber-700",
      trendTone: "text-amber-600",
    },
    {
      label: "Media",
      value: `${totalPhotos + totalAttractionPhotos}/${totalVideos}`,
      trend: "Photos / videos",
      icon: ImageIcon,
      tone: "bg-sky-100 text-sky-700",
      trendTone: "text-sky-600",
    },
    {
      label: "Avg. Rating",
      value: averageRating,
      trend: "Calculated overall",
      icon: Video,
      tone: "bg-violet-100 text-violet-700",
      trendTone: "text-violet-600",
    },
  ];
}

export default function ExperiencesPage() {
  const toast = useToast();
  const [experiences, setExperiences] = useState<AdminExperience[]>([]);
  const [destinations, setDestinations] = useState<AdminDestination[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof statusOptions)[number]>("All Status");
  const [destinationFilter, setDestinationFilter] = useState("All Destinations");
  const [isLoading, setIsLoading] = useState(true);
  const [experienceSheetMode, setExperienceSheetMode] =
    useState<ExperienceSheetMode | null>(null);
  const [selectedExperience, setSelectedExperience] =
    useState<AdminExperience | null>(null);
  const [experienceForm, setExperienceForm] =
    useState<ExperienceFormState>(emptyExperienceForm);
  const [isSavingExperience, setIsSavingExperience] = useState(false);
  const [isUploadingAttractionPhotos, setIsUploadingAttractionPhotos] =
    useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [isUploadingVideos, setIsUploadingVideos] = useState(false);
  const [deletingExperienceId, setDeletingExperienceId] =
    useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadExperienceData() {
      try {
        const [experiencesResponse, destinationsResponse] = await Promise.all([
          listAdminExperiences(),
          listAdminDestinations(),
        ]);

        if (isMounted) {
          setExperiences(experiencesResponse.data.experiences);
          setDestinations(destinationsResponse.data.destinations);
        }
      } catch (error) {
        toast.error("Unable to load experiences", getErrorMessage(error));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadExperienceData();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  const destinationNameById = useMemo(
    () => createDestinationNameById(destinations),
    [destinations]
  );
  const experienceMetrics = useMemo(
    () => createExperienceMetrics(experiences),
    [experiences]
  );
  const calculatedOverallRating = useMemo(
    () => calculateOverallRating(experienceForm),
    [experienceForm]
  );
  const isExperienceFormBusy =
    isSavingExperience ||
    isUploadingAttractionPhotos ||
    isUploadingPhotos ||
    isUploadingVideos;

  const filteredExperiences = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return experiences.filter((experience) => {
      const destinationName = getDestinationName(experience, destinationNameById);
      const matchesQuery =
        !query ||
        [
          experience.destinationId,
          destinationName,
          experience.travellerName,
          experience.travellerEmail,
          experience.writtenReview,
          experience.thingsToKnow.join(" "),
          experience.travellerVideoTitles.join(" "),
          experience.attractionPhotoGallery
            .map((photo) => photo.name)
            .join(" "),
          experience.status,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesStatus =
        statusFilter === "All Status" || experience.status === statusFilter;
      const matchesDestination =
        destinationFilter === "All Destinations" ||
        experience.destinationId === destinationFilter;

      return matchesQuery && matchesStatus && matchesDestination;
    });
  }, [
    destinationFilter,
    destinationNameById,
    experiences,
    searchQuery,
    statusFilter,
  ]);

  function updateExperienceForm<K extends keyof ExperienceFormState>(
    field: K,
    value: ExperienceFormState[K]
  ) {
    setExperienceForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function openViewExperienceSheet(experience: AdminExperience) {
    setSelectedExperience(experience);
    setExperienceForm(experienceToForm(experience));
    setExperienceSheetMode("view");
  }

  function closeExperienceSheet() {
    if (isExperienceFormBusy) {
      return;
    }

    setExperienceSheetMode(null);
    setSelectedExperience(null);
    setExperienceForm(emptyExperienceForm);
  }

  function handleRemovePhoto(indexToRemove: number) {
    setExperienceForm((currentForm) => ({
      ...currentForm,
      travellerPhotoGallery: parseTextList(currentForm.travellerPhotoGallery)
        .filter((_photo, index) => index !== indexToRemove)
        .join("\n"),
    }));
  }

  function handleRemoveVideo(indexToRemove: number) {
    setExperienceForm((currentForm) => ({
      ...currentForm,
      travellerVideos: parseTextList(currentForm.travellerVideos)
        .filter((_video, index) => index !== indexToRemove)
        .join("\n"),
      travellerVideoTitles: joinIndexedTextList(
        getIndexedTextList(
          currentForm.travellerVideoTitles,
          parseTextList(currentForm.travellerVideos).length
        ).filter((_title, index) => index !== indexToRemove)
      ),
    }));
  }

  function handleRemoveAttractionPhoto(indexToRemove: number) {
    setExperienceForm((currentForm) => ({
      ...currentForm,
      attractionPhotoGallery: currentForm.attractionPhotoGallery.filter(
        (_photo, index) => index !== indexToRemove
      ),
    }));
  }

  function handleTravellerVideoTitleChange(indexToUpdate: number, value: string) {
    setExperienceForm((currentForm) => ({
      ...currentForm,
      travellerVideoTitles: joinIndexedTextList(
        getIndexedTextList(
          currentForm.travellerVideoTitles,
          parseTextList(currentForm.travellerVideos).length
        ).map((title, index) => (index === indexToUpdate ? value : title))
      ),
    }));
  }

  function handleAttractionPhotoNameChange(indexToUpdate: number, value: string) {
    setExperienceForm((currentForm) => ({
      ...currentForm,
      attractionPhotoGallery: currentForm.attractionPhotoGallery.map(
        (photo, index) =>
          index === indexToUpdate ? { ...photo, name: value } : photo
      ),
    }));
  }

  async function handlePhotoUpload(files: FileList | null) {
    const selectedPhotos = Array.from(files || []);

    if (selectedPhotos.length === 0) {
      return;
    }

    try {
      const { rejectedPhotos, uploadablePhotos } =
        await getUploadableExperiencePhotos(selectedPhotos);

      if (rejectedPhotos.length > 0) {
        toast.error("Photo too large", getExperiencePhotoSizeMessage(rejectedPhotos));
      }

      if (uploadablePhotos.length === 0) {
        return;
      }

      setIsUploadingPhotos(true);

      const response = await uploadExperienceMedia({
        travellerPhotoGallery: uploadablePhotos,
      });

      setExperienceForm((currentForm) => ({
        ...currentForm,
        travellerPhotoGallery: appendTextList(
          currentForm.travellerPhotoGallery,
          response.data.travellerPhotoGallery
        ),
      }));
      toast.success("Photos uploaded", response.message);
    } catch (error) {
      toast.error("Photo upload failed", getErrorMessage(error));
    } finally {
      setIsUploadingPhotos(false);
    }
  }

  async function handleVideoUpload(files: FileList | null) {
    const travellerVideos = Array.from(files || []);

    if (travellerVideos.length === 0) {
      return;
    }

    setIsUploadingVideos(true);

    try {
      const response = await uploadExperienceMedia({ travellerVideos });

      setExperienceForm((currentForm) => ({
        ...currentForm,
        travellerVideos: appendTextList(
          currentForm.travellerVideos,
          response.data.travellerVideos
        ),
        travellerVideoTitles: joinIndexedTextList([
          ...getIndexedTextList(
            currentForm.travellerVideoTitles,
            parseTextList(currentForm.travellerVideos).length
          ),
          ...response.data.travellerVideos.map(
            (_video, index) =>
              createMediaName(travellerVideos[index]) || `Video ${index + 1}`
          ),
        ]),
      }));
      toast.success("Videos uploaded", response.message);
    } catch (error) {
      toast.error("Video upload failed", getErrorMessage(error));
    } finally {
      setIsUploadingVideos(false);
    }
  }

  async function handleAttractionPhotoUpload(files: FileList | null) {
    const selectedPhotos = Array.from(files || []);

    if (selectedPhotos.length === 0) {
      return;
    }

    try {
      const { rejectedPhotos, uploadablePhotos } =
        await getUploadableExperiencePhotos(selectedPhotos);

      if (rejectedPhotos.length > 0) {
        toast.error("Photo too large", getExperiencePhotoSizeMessage(rejectedPhotos));
      }

      if (uploadablePhotos.length === 0) {
        return;
      }

      setIsUploadingAttractionPhotos(true);

      const response = await uploadExperienceMedia({
        attractionPhotoGallery: uploadablePhotos,
      });

      setExperienceForm((currentForm) => ({
        ...currentForm,
        attractionPhotoGallery: getAttractionPhotoGallery([
          ...currentForm.attractionPhotoGallery,
          ...response.data.attractionPhotoGallery.map((image, index) => ({
            image,
            name: createMediaName(uploadablePhotos[index]) || `Attraction ${index + 1}`,
          })),
        ]),
      }));
      toast.success("Attraction photos uploaded", response.message);
    } catch (error) {
      toast.error("Attraction photo upload failed", getErrorMessage(error));
    } finally {
      setIsUploadingAttractionPhotos(false);
    }
  }

  async function handleSaveExperience(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (experienceSheetMode === "view") {
      return;
    }

    const payload = createExperiencePayload(experienceForm);

    setIsSavingExperience(true);

    try {
      if (experienceSheetMode === "edit" && selectedExperience) {
        const response = await updateAdminExperience(
          selectedExperience.id,
          payload
        );

        setExperiences((currentExperiences) =>
          currentExperiences.map((experience) =>
            experience.id === selectedExperience.id
              ? response.data.experience
              : experience
          )
        );
        toast.success("Experience updated", response.message);
      } else {
        const response = await createAdminExperience(payload);

        setExperiences((currentExperiences) => [
          response.data.experience,
          ...currentExperiences,
        ]);
        toast.success("Experience created", response.message);
      }

      setExperienceSheetMode(null);
      setSelectedExperience(null);
      setExperienceForm(emptyExperienceForm);
    } catch (error) {
      toast.error("Unable to save experience", getErrorMessage(error));
    } finally {
      setIsSavingExperience(false);
    }
  }

  async function handleDeleteExperience(experience: AdminExperience) {
    if (
      !window.confirm(
        `Delete experience for ${getExperienceDisplayName(experience)}? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingExperienceId(experience.id);

    try {
      const response = await deleteAdminExperience(experience.id);

      setExperiences((currentExperiences) =>
        currentExperiences.filter((item) => item.id !== experience.id)
      );
      toast.success("Experience deleted", response.message);
    } catch (error) {
      toast.error("Unable to delete experience", getErrorMessage(error));
    } finally {
      setDeletingExperienceId(null);
    }
  }

  return (
    <AdminDashboardShell activeLabel="Experiences">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <ExperiencesHeader draftCount={experienceMetrics[2]?.value || "0"} />

        <div className="flex justify-end">
          <Button
            render={<Link href="/experiences/add" />}
            nativeButton={false}
            type="button"
            className="h-11 rounded-sm px-4 text-xs font-bold"
          >
            <Plus className="size-4" data-icon="inline-start" />
            Add New Experience
          </Button>
        </div>

        <section
          data-admin-metric-grid
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
        >
          {experienceMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </section>

        <section className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
          <ExperiencesToolbar
            destinationFilter={destinationFilter}
            destinations={destinations}
            onDestinationFilterChange={setDestinationFilter}
            onSearchChange={setSearchQuery}
            onStatusFilterChange={setStatusFilter}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
          />
          <ExperiencesTable
            deletingExperienceId={deletingExperienceId}
            destinationNameById={destinationNameById}
            experiences={filteredExperiences}
            isLoading={isLoading}
            onDelete={handleDeleteExperience}
            onView={openViewExperienceSheet}
            totalCount={experiences.length}
          />
        </section>

        <ExperienceSheet
          destinations={destinations}
          form={experienceForm}
          isBusy={isExperienceFormBusy}
          isOpen={experienceSheetMode !== null}
          isUploadingAttractionPhotos={isUploadingAttractionPhotos}
          isUploadingPhotos={isUploadingPhotos}
          isUploadingVideos={isUploadingVideos}
          mode={experienceSheetMode}
          onAttractionPhotoNameChange={handleAttractionPhotoNameChange}
          onAttractionPhotoUpload={handleAttractionPhotoUpload}
          onClose={closeExperienceSheet}
          onPhotoUpload={handlePhotoUpload}
          onRemoveAttractionPhoto={handleRemoveAttractionPhoto}
          onRemovePhoto={handleRemovePhoto}
          onRemoveVideo={handleRemoveVideo}
          onSubmit={handleSaveExperience}
          onUpdate={updateExperienceForm}
          onVideoTitleChange={handleTravellerVideoTitleChange}
          onVideoUpload={handleVideoUpload}
          overallRating={calculatedOverallRating}
        />
      </div>
    </AdminDashboardShell>
  );
}

function ExperiencesHeader({ draftCount }: { draftCount: string }) {
  const toast = useToast();

  return (
    <header className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <AdminSidebarToggle />
        <div className="min-w-0">
          <h1 className="font-sans text-2xl font-bold tracking-normal text-foreground">
            Experiences
          </h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-foreground/55">
            <span>Dashboard</span>
            <span aria-hidden="true">&gt;</span>
            <span className="font-medium text-foreground/75">Experiences</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <HeaderDateRangePicker />
        <button
          onClick={() =>
            toast.info("Notifications", `${draftCount} experience drafts found.`)
          }
          className="relative grid size-10 place-items-center rounded-sm border border-border bg-white text-foreground transition-colors hover:border-primary hover:text-primary"
          type="button"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-white">
            {draftCount}
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

function MetricCard({ metric }: { metric: ExperienceMetric }) {
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

function ExperiencesToolbar({
  destinationFilter,
  destinations,
  onDestinationFilterChange,
  onSearchChange,
  onStatusFilterChange,
  searchQuery,
  statusFilter,
}: {
  destinationFilter: string;
  destinations: AdminDestination[];
  onDestinationFilterChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: (typeof statusOptions)[number]) => void;
  searchQuery: string;
  statusFilter: (typeof statusOptions)[number];
}) {
  return (
    <div className="grid gap-3 border-b border-border p-4 xl:grid-cols-[minmax(260px,1fr)_180px_240px] xl:items-end">
      <label className="relative min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
        <input
          className="h-10 w-full rounded-sm border border-border bg-white pl-9 pr-3 text-xs font-medium outline-none transition-colors placeholder:text-foreground/40 focus:border-primary focus:ring-3 focus:ring-primary/15"
          placeholder="Search experiences, traveller, destination..."
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>

      <ToolbarSelect
        label="Status"
        onChange={(value) => {
          if (
            value === "All Status" ||
            value === "Draft" ||
            value === "Published"
          ) {
            onStatusFilterChange(value);
          }
        }}
        options={statusOptions}
        value={statusFilter}
      />

      <ToolbarSelect
        label="Destination"
        onChange={onDestinationFilterChange}
        options={[
          "All Destinations",
          ...destinations.map((destination) => destination.destinationId),
        ]}
        renderOption={(option) =>
          option === "All Destinations"
            ? option
            : `${option} - ${
                destinations.find(
                  (destination) => destination.destinationId === option
                )?.destinationName || "Destination"
              }`
        }
        value={destinationFilter}
      />
    </div>
  );
}

function ToolbarSelect({
  label,
  onChange,
  options,
  renderOption,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  renderOption?: (option: string) => ReactNode;
  value: string;
}) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-[11px] font-semibold text-foreground/55">
        {label}
      </span>
      <Select value={value} onValueChange={(nextValue) => onChange(String(nextValue))}>
        <SelectTrigger className="h-10 min-h-10 rounded-sm border-border bg-white px-3 py-2 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {renderOption ? renderOption(option) : option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function ExperiencesTable({
  deletingExperienceId,
  destinationNameById,
  experiences,
  isLoading,
  onDelete,
  onView,
  totalCount,
}: {
  deletingExperienceId: string | null;
  destinationNameById: Map<string, string>;
  experiences: AdminExperience[];
  isLoading: boolean;
  onDelete: (experience: AdminExperience) => void;
  onView: (experience: AdminExperience) => void;
  totalCount: number;
}) {
  return (
    <>
      <div className="max-w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[16%]" />
            <col className="w-[14%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[9%]" />
            <col className="w-[8%]" />
            <col className="w-[5%]" />
          </colgroup>
          <thead className="bg-muted/35 text-[11px] uppercase text-foreground/55">
            <tr>
              <th className="px-4 py-3 font-bold">Experience</th>
              <th className="px-4 py-3 font-bold">Destination</th>
              <th className="px-4 py-3 font-bold">Traveller</th>
              <th className="px-4 py-3 font-bold">Media</th>
              <th className="px-4 py-3 font-bold">Overall Rating</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold">Updated</th>
              <th className="px-4 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm font-semibold text-foreground/55"
                >
                  Loading experiences...
                </td>
              </tr>
            ) : null}

            {!isLoading && experiences.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm font-semibold text-foreground/55"
                >
                  No experiences found.
                </td>
              </tr>
            ) : null}

            {!isLoading
              ? experiences.map((experience) => (
                  <tr
                    key={experience.id}
                    className="border-t border-border transition-colors hover:bg-muted/25"
                  >
                    <td
                      data-label="Experience"
                      data-mobile-primary
                      className="px-4 py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-foreground">
                          {getExperienceDisplayName(experience)}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-foreground/65">
                          {experience.writtenReview || "-"}
                        </p>
                      </div>
                    </td>
                    <td data-label="Destination" className="px-4 py-4">
                      <p className="truncate text-xs font-bold text-foreground">
                        {getDestinationName(experience, destinationNameById)}
                      </p>
                      <p className="mt-1 truncate text-[10px] font-semibold text-foreground/55">
                        {experience.destinationId}
                      </p>
                    </td>
                    <td data-label="Traveller" className="px-4 py-4">
                      <p className="truncate text-xs font-bold text-foreground">
                        {experience.travellerName || "Traveller"}
                      </p>
                      <p className="mt-1 truncate text-[10px] text-foreground/55">
                        {experience.travellerEmail || "-"}
                      </p>
                    </td>
                    <td data-label="Media" className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-[10px] font-bold text-sky-700">
                          <ImageIcon className="size-3" />
                          {experience.travellerPhotoGallery.length +
                            experience.attractionPhotoGallery.length}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-1 text-[10px] font-bold text-violet-700">
                          <Video className="size-3" />
                          {experience.travellerVideos.length}
                        </span>
                      </div>
                    </td>
                    <td data-label="Overall Rating" className="px-4 py-4">
                      <div className="grid gap-1">
                        <span className="text-xs font-bold text-foreground">
                          {experience.overallRating.toFixed(1)}
                        </span>
                        <RatingStars value={experience.overallRating} />
                      </div>
                    </td>
                    <td data-label="Status" className="px-4 py-4">
                      <StatusBadge status={experience.status} />
                    </td>
                    <td
                      data-label="Updated"
                      className="px-4 py-4 text-xs font-semibold text-foreground/70"
                    >
                      {formatDate(experience.updatedAt)}
                    </td>
                    <td data-actions data-label="Actions" className="px-4 py-4">
                      <RowActions
                        disabled={deletingExperienceId === experience.id}
                        experience={experience}
                        onDelete={onDelete}
                        onView={onView}
                      />
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      <TableFooter
        label="experiences"
        showing={experiences.length.toString()}
        total={totalCount.toString()}
      />
    </>
  );
}

function RatingStars({ value }: { value: number }) {
  const filledCount = Math.round(value);

  return (
    <div className="flex items-center gap-0.5 text-primary">
      {Array.from({ length: 5 }, (_item, index) => (
        <Star
          key={index}
          className={cn(
            "size-3.5",
            index < filledCount ? "fill-current" : "text-stone-300"
          )}
        />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: ExperienceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold",
        status === "Published"
          ? "bg-emerald-100 text-emerald-700"
          : "bg-amber-100 text-amber-700"
      )}
    >
      {status}
    </span>
  );
}

function RowActions({
  disabled,
  experience,
  onDelete,
  onView,
}: {
  disabled: boolean;
  experience: AdminExperience;
  onDelete: (experience: AdminExperience) => void;
  onView: (experience: AdminExperience) => void;
}) {
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="grid size-10 place-items-center rounded-full border border-border bg-white text-foreground/65 transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-50"
              aria-label={`Open actions for ${getExperienceDisplayName(experience)}`}
              disabled={disabled}
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
            onClick={() => onView(experience)}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Eye className="size-4 text-foreground/60" />
            View
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<Link href={`/experiences/edit?id=${experience.id}`} />}
            className="cursor-pointer rounded-sm px-2 py-2 text-xs font-semibold"
          >
            <Pencil className="size-4 text-primary" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(experience)}
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
          <span className="text-sm leading-none">&lt;</span>
        </PaginationButton>
        <PaginationButton label="Page 1" active>
          1
        </PaginationButton>
        <PaginationButton label="Next page" disabled>
          <span className="text-sm leading-none">&gt;</span>
        </PaginationButton>
        <PaginationButton label="Last page" disabled>
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

function ExperienceSheet({
  destinations,
  form,
  isBusy,
  isOpen,
  isUploadingAttractionPhotos,
  isUploadingPhotos,
  isUploadingVideos,
  mode,
  onAttractionPhotoNameChange,
  onAttractionPhotoUpload,
  onClose,
  onPhotoUpload,
  onRemoveAttractionPhoto,
  onRemovePhoto,
  onRemoveVideo,
  onSubmit,
  onUpdate,
  onVideoTitleChange,
  onVideoUpload,
  overallRating,
}: {
  destinations: AdminDestination[];
  form: ExperienceFormState;
  isBusy: boolean;
  isOpen: boolean;
  isUploadingAttractionPhotos: boolean;
  isUploadingPhotos: boolean;
  isUploadingVideos: boolean;
  mode: ExperienceSheetMode | null;
  onAttractionPhotoNameChange: (index: number, value: string) => void;
  onAttractionPhotoUpload: (files: FileList | null) => void;
  onClose: () => void;
  onPhotoUpload: (files: FileList | null) => void;
  onRemoveAttractionPhoto: (index: number) => void;
  onRemovePhoto: (index: number) => void;
  onRemoveVideo: (index: number) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof ExperienceFormState>(
    field: K,
    value: ExperienceFormState[K]
  ) => void;
  onVideoTitleChange: (index: number, value: string) => void;
  onVideoUpload: (files: FileList | null) => void;
  overallRating: number;
}) {
  const isReadOnly = mode === "view";
  const sheetTitle =
    mode === "edit"
      ? "Edit Experience"
      : mode === "view"
        ? "View Experience"
        : "Add Experience";
  const sheetDescription =
    mode === "edit"
      ? "Update destination-linked traveller experience details."
      : mode === "view"
        ? "Review the stored traveller experience details."
        : "Create a destination-linked traveller experience.";
  const submitButtonLabel = mode === "edit" ? "Update Experience" : "Save Experience";
  const inputClassName =
    "h-11 rounded-sm border border-border bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";
  const textareaClassName =
    "min-h-24 rounded-sm border border-border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";

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
        className="w-full gap-0 border-l border-border bg-white p-0 shadow-2xl shadow-stone-900/20 duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] data-[side=right]:w-full data-[side=right]:sm:max-w-[680px]"
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
                aria-label="Close experience form"
              >
                <X className="size-4" />
              </button>
            </div>
          </SheetHeader>

          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-7 py-6 sm:grid-cols-2">
            <FormField label="Destination ID" required>
              <Select
                disabled={isReadOnly || destinations.length === 0}
                value={form.destinationId}
                onValueChange={(value) =>
                  onUpdate("destinationId", String(value || ""))
                }
              >
                <SelectTrigger className={inputClassName}>
                  <SelectValue
                    placeholder={
                      destinations.length
                        ? "Select destination"
                        : "No destinations available"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {destinations.length > 0 ? (
                    destinations.map((destination) => (
                      <SelectItem
                        key={destination.id}
                        value={destination.destinationId}
                      >
                        <span className="flex min-w-max flex-col gap-0.5">
                          <span className="whitespace-nowrap">
                            {destination.destinationId}
                          </span>
                          <span className="whitespace-nowrap text-xs font-medium text-foreground/55">
                            {destination.destinationName}
                          </span>
                        </span>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem disabled value="empty-destinations">
                      No destinations available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Traveller Name">
              <input
                readOnly={isReadOnly}
                value={form.travellerName}
                onChange={(event) =>
                  onUpdate("travellerName", event.target.value)
                }
                className={inputClassName}
                placeholder="Rahul Sharma"
              />
            </FormField>

            <FormField label="Traveller Email">
              <input
                readOnly={isReadOnly}
                type="email"
                value={form.travellerEmail}
                onChange={(event) =>
                  onUpdate("travellerEmail", event.target.value)
                }
                className={inputClassName}
                placeholder="traveller@example.com"
              />
            </FormField>

            <FormField className="sm:col-span-2" label="Written Reviews">
              <textarea
                readOnly={isReadOnly}
                value={form.writtenReview}
                onChange={(event) =>
                  onUpdate("writtenReview", event.target.value)
                }
                className={textareaClassName}
                placeholder="Traveller review"
              />
            </FormField>

            <FormField className="sm:col-span-2" label="Things to Know">
              <textarea
                readOnly={isReadOnly}
                value={form.thingsToKnow}
                onChange={(event) =>
                  onUpdate("thingsToKnow", event.target.value)
                }
                className={textareaClassName}
                placeholder={"Temple timings\nBest light for photos\nCarry water"}
              />
            </FormField>

            <RatingInput
              className={inputClassName}
              isReadOnly={isReadOnly}
              label="Itinerary Rating"
              value={form.ratingItinerary}
              onChange={(value) => onUpdate("ratingItinerary", value)}
            />

            <RatingInput
              className={inputClassName}
              isReadOnly={isReadOnly}
              label="Local Transport Rating"
              value={form.ratingLocalTransport}
              onChange={(value) => onUpdate("ratingLocalTransport", value)}
            />

            <RatingInput
              className={inputClassName}
              isReadOnly={isReadOnly}
              label="Accommodation Rating"
              value={form.ratingAccommodation}
              onChange={(value) => onUpdate("ratingAccommodation", value)}
            />

            <RatingInput
              className={inputClassName}
              isReadOnly={isReadOnly}
              label="Tour Expert Rating"
              value={form.ratingTourExpert}
              onChange={(value) => onUpdate("ratingTourExpert", value)}
            />

            <FormField label="Overall Rating">
              <div className="flex h-11 items-center justify-between gap-3 rounded-sm border border-border bg-muted/35 px-3">
                <span className="text-sm font-bold text-foreground">
                  {overallRating.toFixed(1)}
                </span>
                <RatingStars value={overallRating} />
              </div>
            </FormField>

            <FormField label="Status">
              <Select
                disabled={isReadOnly}
                value={form.status}
                onValueChange={(value) => {
                  if (value === "Draft" || value === "Published") {
                    onUpdate("status", value);
                  }
                }}
              >
                <SelectTrigger className={inputClassName}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Published">Published</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField className="sm:col-span-2" label="Traveller Photo Gallery">
              {!isReadOnly ? (
                <UploadField
                  accept="image/*"
                  disabled={isBusy}
                  isUploading={isUploadingPhotos}
                  label="Upload traveller photos"
                  multiple
                  onFilesSelected={onPhotoUpload}
                />
              ) : null}
              <ImagePreviewGrid
                images={parseTextList(form.travellerPhotoGallery)}
                onRemove={!isReadOnly ? onRemovePhoto : undefined}
              />
            </FormField>

            <FormField className="sm:col-span-2" label="Traveller Videos">
              {!isReadOnly ? (
                <UploadField
                  accept="video/mp4,video/quicktime,video/webm"
                  disabled={isBusy}
                  isUploading={isUploadingVideos}
                  label="Upload traveller videos"
                  multiple
                  onFilesSelected={onVideoUpload}
                />
              ) : null}
              <VideoPreviewGrid
                isReadOnly={isReadOnly}
                onRemove={!isReadOnly ? onRemoveVideo : undefined}
                onTitleChange={!isReadOnly ? onVideoTitleChange : undefined}
                titles={getIndexedTextList(
                  form.travellerVideoTitles,
                  parseTextList(form.travellerVideos).length
                )}
                videos={parseTextList(form.travellerVideos)}
              />
            </FormField>

            <FormField className="sm:col-span-2" label="Attraction Photos">
              {!isReadOnly ? (
                <UploadField
                  accept="image/*"
                  disabled={isBusy}
                  isUploading={isUploadingAttractionPhotos}
                  label="Upload attraction photos"
                  multiple
                  onFilesSelected={onAttractionPhotoUpload}
                />
              ) : null}
              <AttractionPhotoPreviewGrid
                isReadOnly={isReadOnly}
                onNameChange={!isReadOnly ? onAttractionPhotoNameChange : undefined}
                onRemove={!isReadOnly ? onRemoveAttractionPhoto : undefined}
                photos={form.attractionPhotoGallery}
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

function RatingInput({
  className,
  isReadOnly,
  label,
  onChange,
  value,
}: {
  className: string;
  isReadOnly: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <FormField label={label} required>
      <input
        required
        min={1}
        max={5}
        readOnly={isReadOnly}
        step={0.1}
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={className}
      />
    </FormField>
  );
}

function ImagePreviewGrid({
  images,
  onRemove,
}: {
  images: string[];
  onRemove?: (index: number) => void;
}) {
  if (images.length === 0) {
    return (
      <div className="grid h-20 place-items-center rounded-sm border border-dashed border-border bg-muted/35 text-xs font-medium text-foreground/45">
        Preview will appear here
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {images.map((image, index) => (
        <div
          key={`${image}-${index}`}
          className="relative h-20 overflow-hidden rounded-sm border border-border bg-muted"
        >
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="absolute right-1.5 top-1.5 z-10 grid size-6 place-items-center rounded-sm border border-white/70 bg-white/95 text-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
              aria-label={`Remove traveller photo ${index + 1}`}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
          <div
            className="h-full w-full bg-cover bg-center"
            role="img"
            aria-label={`Traveller photo ${index + 1}`}
            style={{
              backgroundImage: `url("${getExperienceMediaUrl(image)}")`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

function VideoPreviewGrid({
  isReadOnly,
  onRemove,
  onTitleChange,
  titles,
  videos,
}: {
  isReadOnly?: boolean;
  onRemove?: (index: number) => void;
  onTitleChange?: (index: number, value: string) => void;
  titles?: string[];
  videos: string[];
}) {
  if (videos.length === 0) {
    return (
      <div className="grid h-28 place-items-center rounded-sm border border-dashed border-border bg-muted/35 text-xs font-medium text-foreground/45">
        <span className="inline-flex items-center gap-2">
          <Play className="size-4" />
          Preview will appear here
        </span>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {videos.map((video, index) => (
        <div
          key={`${video}-${index}`}
          className="relative grid gap-2 overflow-hidden rounded-sm border border-border bg-muted p-2"
        >
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="absolute right-1.5 top-1.5 z-10 grid size-6 place-items-center rounded-sm border border-white/70 bg-white/95 text-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
              aria-label={`Remove traveller video ${index + 1}`}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
          <input
            readOnly={isReadOnly}
            value={titles?.[index] || ""}
            onChange={(event) => onTitleChange?.(index, event.target.value)}
            className={mediaMetaInputClassName}
            placeholder={`Video title ${index + 1}`}
          />
          <video
            className="aspect-video w-full rounded-sm bg-black object-cover"
            controls
            preload="metadata"
            src={getExperienceMediaUrl(video)}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      ))}
    </div>
  );
}

function AttractionPhotoPreviewGrid({
  isReadOnly,
  onNameChange,
  onRemove,
  photos,
}: {
  isReadOnly?: boolean;
  onNameChange?: (index: number, value: string) => void;
  onRemove?: (index: number) => void;
  photos: ExperienceAttractionPhoto[];
}) {
  if (photos.length === 0) {
    return (
      <div className="grid h-24 place-items-center rounded-sm border border-dashed border-border bg-muted/35 text-xs font-medium text-foreground/45">
        <span className="inline-flex items-center gap-2">
          <ImageIcon className="size-4" />
          Preview will appear here
        </span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {photos.map((photo, index) => (
        <div
          key={`${photo.image}-${index}`}
          className="relative grid gap-2 rounded-sm border border-border bg-muted p-2"
        >
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="absolute right-3 top-3 z-10 grid size-6 place-items-center rounded-sm border border-white/70 bg-white/95 text-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
              aria-label={`Remove attraction photo ${index + 1}`}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
          <div
            className="h-24 rounded-sm bg-cover bg-center"
            role="img"
            aria-label={photo.name || `Attraction photo ${index + 1}`}
            style={{
              backgroundImage: `url("${getExperienceMediaUrl(photo.image)}")`,
            }}
          />
          <input
            readOnly={isReadOnly}
            value={photo.name}
            onChange={(event) => onNameChange?.(index, event.target.value)}
            className={mediaMetaInputClassName}
            placeholder={`Attraction name ${index + 1}`}
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
