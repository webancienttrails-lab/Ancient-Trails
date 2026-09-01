"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Play,
  Plus,
  Save,
  Star,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";

import {
  AdminDashboardShell,
  AdminSidebarToggle,
} from "@/components/admin-dashboard/admin-dashboard-shell";
import { HeaderDateRangePicker } from "@/components/admin-dashboard/header-date-range-picker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  listAdminDestinations,
  type AdminDestination,
} from "@/lib/destinations";
import {
  createAdminExperience,
  getAdminExperience,
  getExperiencePhotoSizeMessage,
  getExperienceMediaUrl,
  getUploadableExperiencePhotos,
  updateAdminExperience,
  uploadExperienceMedia,
  type AdminExperience,
  type ExperienceAttractionPhoto,
  type ExperiencePayload,
} from "@/lib/experiences";
import { cn } from "@/lib/utils";

export type ExperienceEditorMode = "add" | "edit";

type ExperienceFormState = Omit<
  ExperiencePayload,
  | "ratingAccommodation"
  | "ratingItinerary"
  | "ratingLocalTransport"
  | "ratingTourExpert"
  | "thingsToKnow"
  | "travellerVideoTitles"
  | "attractionPhotoGallery"
  | "experienceId"
  | "title"
> & {
  ratingAccommodation: string;
  ratingItinerary: string;
  ratingLocalTransport: string;
  ratingTourExpert: string;
  thingsToKnow: string;
  travellerVideoTitles: string[];
  attractionPhotoGallery: ExperienceAttractionPhoto[];
};

type ExperienceFormEntry = {
  form: ExperienceFormState;
  isUploadingAttractionPhotos: boolean;
  isUploadingPhotos: boolean;
  isUploadingVideos: boolean;
  localId: string;
};

const emptyExperienceForm: ExperienceFormState = {
  destinationId: "",
  travellerName: "",
  travellerEmail: "",
  writtenReview: "",
  thingsToKnow: "",
  travellerPhotoGallery: [],
  travellerVideos: [],
  travellerVideoTitles: [],
  attractionPhotoGallery: [],
  ratingItinerary: "5",
  ratingLocalTransport: "5",
  ratingAccommodation: "5",
  ratingTourExpert: "5",
  status: "Draft",
};

const inputClassName =
  "h-11 rounded-sm border border-border bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";
const textareaClassName =
  "min-h-24 rounded-sm border border-border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "details" in error &&
    Array.isArray((error as { details?: unknown }).details)
  ) {
    const detailMessages = (error as {
      details: Array<{ message?: unknown; path?: unknown }>;
    }).details
      .map((detail) => {
        const message =
          typeof detail.message === "string" ? detail.message.trim() : "";
        const path =
          typeof detail.path === "string" && detail.path.trim()
            ? `${detail.path}: `
            : "";

        return message ? `${path}${message}` : "";
      })
      .filter(Boolean);

    if (detailMessages.length > 0) {
      return detailMessages.join(" ");
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function createLocalId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `experience-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createExperienceEntry(
  form: Partial<ExperienceFormState> = {}
): ExperienceFormEntry {
  return {
    form: {
      ...emptyExperienceForm,
      ...form,
      travellerEmail: form.travellerEmail || "",
      travellerName: form.travellerName || "",
      writtenReview: form.writtenReview || "",
      thingsToKnow: form.thingsToKnow || "",
      travellerPhotoGallery: getUniqueMediaList(form.travellerPhotoGallery),
      travellerVideos: getUniqueMediaList(form.travellerVideos),
      travellerVideoTitles: getIndexedTextList(
        form.travellerVideoTitles,
        form.travellerVideos?.length || 0
      ),
      attractionPhotoGallery: getAttractionPhotoGallery(
        form.attractionPhotoGallery
      ),
    },
    isUploadingAttractionPhotos: false,
    isUploadingPhotos: false,
    isUploadingVideos: false,
    localId: createLocalId(),
  };
}

function parseTextList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getUniqueMediaList(values: string[] = []): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function appendMediaList(currentValues: string[], newValues: string[]): string[] {
  return getUniqueMediaList([...currentValues, ...newValues]);
}

function getIndexedTextList(values: string[] = [], length: number): string[] {
  return Array.from({ length }, (_item, index) => values[index]?.trim() || "");
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
    destinationId: experience.destinationId,
    travellerName: experience.travellerName || "",
    travellerEmail: experience.travellerEmail || "",
    writtenReview: experience.writtenReview || "",
    thingsToKnow: experience.thingsToKnow.join("\n"),
    travellerPhotoGallery: getUniqueMediaList(experience.travellerPhotoGallery),
    travellerVideos: getUniqueMediaList(experience.travellerVideos),
    travellerVideoTitles: getIndexedTextList(
      experience.travellerVideoTitles,
      experience.travellerVideos.length
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
  return {
    destinationId: form.destinationId.trim(),
    travellerName: form.travellerName.trim(),
    travellerEmail: form.travellerEmail.trim(),
    writtenReview: form.writtenReview.trim(),
    thingsToKnow: parseTextList(form.thingsToKnow),
    travellerPhotoGallery: getUniqueMediaList(form.travellerPhotoGallery),
    travellerVideos: getUniqueMediaList(form.travellerVideos),
    travellerVideoTitles: getIndexedTextList(
      form.travellerVideoTitles,
      form.travellerVideos.length
    ),
    attractionPhotoGallery: getAttractionPhotoGallery(
      form.attractionPhotoGallery
    ),
    ratingItinerary: getRatingValue(form.ratingItinerary),
    ratingLocalTransport: getRatingValue(form.ratingLocalTransport),
    ratingAccommodation: getRatingValue(form.ratingAccommodation),
    ratingTourExpert: getRatingValue(form.ratingTourExpert),
    status: form.status,
  };
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
  destinationId: string,
  destinationNameById: Map<string, string>
) {
  return destinationNameById.get(destinationId) || destinationId || "No destination";
}

function getBatchValidationError(entries: ExperienceFormEntry[]): string {
  const missingDestinationIndex = entries.findIndex(
    (entry) => !entry.form.destinationId.trim()
  );

  if (missingDestinationIndex !== -1) {
    return `Select destination for Experience ${missingDestinationIndex + 1}.`;
  }

  return "";
}

function getInheritedFormDefaults(form: ExperienceFormState) {
  return {
    destinationId: form.destinationId,
    ratingAccommodation: form.ratingAccommodation,
    ratingItinerary: form.ratingItinerary,
    ratingLocalTransport: form.ratingLocalTransport,
    ratingTourExpert: form.ratingTourExpert,
    status: form.status,
  };
}

export function ExperienceEditorPage({
  experienceId,
  mode,
}: {
  experienceId?: string;
  mode: ExperienceEditorMode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [entries, setEntries] = useState<ExperienceFormEntry[]>(() => [
    createExperienceEntry(),
  ]);
  const [destinations, setDestinations] = useState<AdminDestination[]>([]);
  const [selectedExperience, setSelectedExperience] =
    useState<AdminExperience | null>(null);
  const [isLoading, setIsLoading] = useState(
    () => !(mode === "edit" && !experienceId)
  );
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const destinationNameById = useMemo(
    () => createDestinationNameById(destinations),
    [destinations]
  );
  const isUploading = entries.some(
    (entry) =>
      entry.isUploadingAttractionPhotos ||
      entry.isUploadingPhotos ||
      entry.isUploadingVideos
  );
  const isBusy = isSaving || isUploading;
  const pageTitle = mode === "edit" ? "Edit Experience" : "Add Experiences";
  const pageDescription =
    mode === "edit"
      ? "Update destination-linked traveller experience details."
      : "Create one or more destination-linked traveller experiences.";
  const submitButtonLabel = isSaving
    ? "Saving..."
    : isUploading
      ? "Uploading media..."
      : mode === "edit"
        ? entries.length > 1
          ? `Update + Add ${entries.length - 1}`
          : "Update Experience"
        : entries.length > 1
          ? `Save ${entries.length} Experiences`
          : "Save Experience";
  const missingExperienceIdError =
    mode === "edit" && !experienceId ? "Experience record is missing." : "";
  const currentLoadError = loadError || missingExperienceIdError;

  useEffect(() => {
    if (mode === "edit" && !experienceId) {
      return;
    }

    let isMounted = true;

    async function loadEditorData() {
      setIsLoading(true);
      setLoadError("");

      try {
        if (mode === "edit" && experienceId) {
          const [destinationsResponse, experienceResponse] = await Promise.all([
            listAdminDestinations(),
            getAdminExperience(experienceId),
          ]);

          if (isMounted) {
            setDestinations(destinationsResponse.data.destinations);
            setSelectedExperience(experienceResponse.data.experience);
            setEntries([
              createExperienceEntry(
                experienceToForm(experienceResponse.data.experience)
              ),
            ]);
          }

          return;
        }

        const destinationsResponse = await listAdminDestinations();

        if (isMounted) {
          setDestinations(destinationsResponse.data.destinations);
        }
      } catch (error) {
        const message = getErrorMessage(error);

        if (isMounted) {
          setLoadError(message);
        }

        toast.error("Unable to load experience editor", message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadEditorData();

    return () => {
      isMounted = false;
    };
  }, [experienceId, mode, toast]);

  function updateEntryForm<K extends keyof ExperienceFormState>(
    localId: string,
    field: K,
    value: ExperienceFormState[K]
  ) {
    setEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.localId === localId
          ? {
              ...entry,
              form: {
                ...entry.form,
                [field]: value,
              },
            }
          : entry
      )
    );
  }

  function updateEntryUploadState(
    localId: string,
    field:
      | "isUploadingAttractionPhotos"
      | "isUploadingPhotos"
      | "isUploadingVideos",
    value: boolean
  ) {
    setEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.localId === localId ? { ...entry, [field]: value } : entry
      )
    );
  }

  function addExperienceEntry() {
    if (isBusy) {
      return;
    }

    setEntries((currentEntries) => {
      const lastEntry = currentEntries[currentEntries.length - 1];
      const inheritedForm = lastEntry
        ? getInheritedFormDefaults(lastEntry.form)
        : {};

      return [...currentEntries, createExperienceEntry(inheritedForm)];
    });
  }

  function removeExperienceEntry(localId: string) {
    if (isBusy) {
      return;
    }

    setEntries((currentEntries) =>
      currentEntries.length > 1
        ? currentEntries.filter((entry) => entry.localId !== localId)
        : currentEntries
    );
  }

  function removeTravellerPhoto(localId: string, indexToRemove: number) {
    setEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.localId === localId
          ? {
              ...entry,
              form: {
                ...entry.form,
                travellerPhotoGallery: entry.form.travellerPhotoGallery
                  .filter((_item, index) => index !== indexToRemove)
              },
            }
          : entry
      )
    );
  }

  function removeTravellerVideo(localId: string, indexToRemove: number) {
    setEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.localId === localId
          ? {
              ...entry,
              form: {
                ...entry.form,
                travellerVideos: entry.form.travellerVideos.filter(
                  (_item, index) => index !== indexToRemove
                ),
                travellerVideoTitles: entry.form.travellerVideoTitles.filter(
                  (_item, index) => index !== indexToRemove
                ),
              },
            }
          : entry
      )
    );
  }

  function removeAttractionPhoto(localId: string, indexToRemove: number) {
    setEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.localId === localId
          ? {
              ...entry,
              form: {
                ...entry.form,
                attractionPhotoGallery: entry.form.attractionPhotoGallery.filter(
                  (_item, index) => index !== indexToRemove
                ),
              },
            }
          : entry
      )
    );
  }

  function updateTravellerVideoTitle(
    localId: string,
    indexToUpdate: number,
    value: string
  ) {
    setEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.localId === localId
          ? {
              ...entry,
              form: {
                ...entry.form,
                travellerVideoTitles: getIndexedTextList(
                  entry.form.travellerVideos.map((_, index) =>
                    index === indexToUpdate
                      ? value
                      : entry.form.travellerVideoTitles[index] || ""
                  ),
                  entry.form.travellerVideos.length
                ),
              },
            }
          : entry
      )
    );
  }

  function updateAttractionPhotoName(
    localId: string,
    indexToUpdate: number,
    value: string
  ) {
    setEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.localId === localId
          ? {
              ...entry,
              form: {
                ...entry.form,
                attractionPhotoGallery: entry.form.attractionPhotoGallery.map(
                  (photo, index) =>
                    index === indexToUpdate ? { ...photo, name: value } : photo
                ),
              },
            }
          : entry
      )
    );
  }

  async function handlePhotoUpload(localId: string, files: FileList | null) {
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

      updateEntryUploadState(localId, "isUploadingPhotos", true);

      const response = await uploadExperienceMedia({
        travellerPhotoGallery: uploadablePhotos,
      });

      setEntries((currentEntries) =>
        currentEntries.map((entry) =>
          entry.localId === localId
            ? {
                ...entry,
                form: {
                  ...entry.form,
                  travellerPhotoGallery: appendMediaList(
                    entry.form.travellerPhotoGallery,
                    response.data.travellerPhotoGallery
                  ),
                },
              }
            : entry
        )
      );
      toast.success("Photos uploaded", response.message);
    } catch (error) {
      toast.error("Photo upload failed", getErrorMessage(error));
    } finally {
      updateEntryUploadState(localId, "isUploadingPhotos", false);
    }
  }

  async function handleAttractionPhotoUpload(
    localId: string,
    files: FileList | null
  ) {
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

      updateEntryUploadState(localId, "isUploadingAttractionPhotos", true);

      const response = await uploadExperienceMedia({
        attractionPhotoGallery: uploadablePhotos,
      });

      const uploadedPhotos = response.data.attractionPhotoGallery.map(
        (image, index) => ({
          image,
          name: createMediaName(uploadablePhotos[index]) || `Attraction ${index + 1}`,
        })
      );

      setEntries((currentEntries) =>
        currentEntries.map((entry) =>
          entry.localId === localId
            ? {
                ...entry,
                form: {
                  ...entry.form,
                  attractionPhotoGallery: getAttractionPhotoGallery([
                    ...entry.form.attractionPhotoGallery,
                    ...uploadedPhotos,
                  ]),
                },
              }
            : entry
        )
      );
      toast.success("Attraction photos uploaded", response.message);
    } catch (error) {
      toast.error("Attraction photo upload failed", getErrorMessage(error));
    } finally {
      updateEntryUploadState(localId, "isUploadingAttractionPhotos", false);
    }
  }

  async function handleVideoUpload(localId: string, files: FileList | null) {
    const travellerVideos = Array.from(files || []);

    if (travellerVideos.length === 0) {
      return;
    }

    updateEntryUploadState(localId, "isUploadingVideos", true);

    try {
      const response = await uploadExperienceMedia({ travellerVideos });

      setEntries((currentEntries) =>
        currentEntries.map((entry) =>
          entry.localId === localId
            ? {
                ...entry,
                form: {
                  ...entry.form,
                  travellerVideos: appendMediaList(
                    entry.form.travellerVideos,
                    response.data.travellerVideos
                  ),
                  travellerVideoTitles: [
                    ...entry.form.travellerVideoTitles,
                    ...travellerVideos.map(createMediaName),
                  ],
                },
              }
            : entry
        )
      );
      toast.success("Videos uploaded", response.message);
    } catch (error) {
      toast.error("Video upload failed", getErrorMessage(error));
    } finally {
      updateEntryUploadState(localId, "isUploadingVideos", false);
    }
  }

  async function handleSaveExperience(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isUploading) {
      return;
    }

    const validationError = getBatchValidationError(entries);

    if (validationError) {
      toast.error("Experience details incomplete", validationError);
      return;
    }

    setIsSaving(true);

    try {
      if (mode === "edit") {
        if (!selectedExperience) {
          throw new Error("Experience not loaded.");
        }

        const updateResponse = await updateAdminExperience(
          selectedExperience.id,
          createExperiencePayload(entries[0].form)
        );
        const addedEntries = entries.slice(1);

        for (const entry of addedEntries) {
          await createAdminExperience(createExperiencePayload(entry.form));
        }

        toast.success(
          addedEntries.length > 0
            ? "Experience updated and added"
            : "Experience updated",
          addedEntries.length > 0
            ? `${addedEntries.length} additional experience${
                addedEntries.length === 1 ? "" : "s"
              } created.`
            : updateResponse.message
        );
        router.push("/experiences");
        router.refresh();
        return;
      }

      let savedCount = 0;

      for (const entry of entries) {
        const response = await createAdminExperience(
          createExperiencePayload(entry.form)
        );

        savedCount += 1;

        if (savedCount === entries.length) {
          toast.success(
            entries.length > 1 ? "Experiences created" : "Experience created",
            response.message
          );
        }
      }

      router.push("/experiences");
      router.refresh();
    } catch (error) {
      toast.error(
        mode === "edit" ? "Experience not updated" : "Experience not saved",
        getErrorMessage(error)
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminDashboardShell activeLabel="Experiences">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <ExperienceEditorHeader current={pageTitle} />

        <form onSubmit={handleSaveExperience} className="flex flex-col gap-5">
          <section className="flex flex-col gap-4 rounded-sm border border-border bg-white p-5 shadow-sm shadow-stone-200/40 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <Button
                render={<Link href="/experiences" />}
                nativeButton={false}
                type="button"
                variant="outline"
                className="mb-4 h-9 rounded-sm border-border bg-white px-3 text-xs font-bold"
              >
                <ArrowLeft className="size-4" data-icon="inline-start" />
                Back to Experiences
              </Button>
              <h1 className="font-sans text-2xl font-bold tracking-normal text-foreground">
                {pageTitle}
              </h1>
              <p className="mt-1 text-sm text-foreground/60">
                {pageDescription}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={isBusy || isLoading || Boolean(currentLoadError)}
                onClick={addExperienceEntry}
                className="h-11 rounded-sm border-border bg-white px-4 text-sm font-bold"
              >
                <Plus className="size-4" data-icon="inline-start" />
                Add Another Experience
              </Button>
              <Button
                render={<Link href="/experiences" />}
                nativeButton={false}
                type="button"
                variant="outline"
                className="h-11 rounded-sm border-border bg-white px-4 text-sm font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isBusy || isLoading || Boolean(currentLoadError)}
                className="h-11 rounded-sm px-4 text-sm font-bold"
              >
                <Save className="size-4" data-icon="inline-start" />
                {submitButtonLabel}
              </Button>
            </div>
          </section>

          {isLoading ? (
            <section className="grid min-h-60 place-items-center rounded-sm border border-border bg-white p-8 text-sm font-semibold text-foreground/55 shadow-sm shadow-stone-200/40">
              Loading experience editor...
            </section>
          ) : null}

          {!isLoading && currentLoadError ? (
            <section className="rounded-sm border border-border bg-white p-8 text-center shadow-sm shadow-stone-200/40">
              <p className="text-sm font-bold text-foreground">
                Experience not available
              </p>
              <p className="mt-2 text-xs text-foreground/55">
                {currentLoadError}
              </p>
            </section>
          ) : null}

          {!isLoading && !currentLoadError ? (
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="grid gap-5">
                {entries.map((entry, index) => (
                  <ExperienceEntryCard
                    key={entry.localId}
                    canRemove={entries.length > 1 && (mode === "add" || index > 0)}
                    destinationNameById={destinationNameById}
                    destinations={destinations}
                    entry={entry}
                    index={index}
                    isBusy={isBusy}
                    mode={mode}
                    onAttractionPhotoUpload={handleAttractionPhotoUpload}
                    onAttractionPhotoNameChange={updateAttractionPhotoName}
                    onPhotoUpload={handlePhotoUpload}
                    onRemoveEntry={removeExperienceEntry}
                    onRemoveAttractionPhoto={removeAttractionPhoto}
                    onRemovePhoto={removeTravellerPhoto}
                    onRemoveVideo={removeTravellerVideo}
                    onUpdate={updateEntryForm}
                    onVideoTitleChange={updateTravellerVideoTitle}
                    onVideoUpload={handleVideoUpload}
                  />
                ))}
              </div>

              <ExperienceSummary
                destinationNameById={destinationNameById}
                entries={entries}
                mode={mode}
              />
            </div>
          ) : null}
        </form>
      </div>
    </AdminDashboardShell>
  );
}

function ExperienceEditorHeader({ current }: { current: string }) {
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
            <Link href="/experiences" className="transition-colors hover:text-primary">
              Experiences
            </Link>
            <span aria-hidden="true">&gt;</span>
            <span className="font-medium text-foreground/75">{current}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <HeaderDateRangePicker />
        <button
          onClick={() =>
            toast.info("Notifications", "Experience drafts appear on the list page.")
          }
          className="relative grid size-10 place-items-center rounded-sm border border-border bg-white text-foreground transition-colors hover:border-primary hover:text-primary"
          type="button"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-white">
            0
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

function ExperienceEntryCard({
  canRemove,
  destinationNameById,
  destinations,
  entry,
  index,
  isBusy,
  mode,
  onAttractionPhotoNameChange,
  onAttractionPhotoUpload,
  onPhotoUpload,
  onRemoveEntry,
  onRemoveAttractionPhoto,
  onRemovePhoto,
  onRemoveVideo,
  onUpdate,
  onVideoTitleChange,
  onVideoUpload,
}: {
  canRemove: boolean;
  destinationNameById: Map<string, string>;
  destinations: AdminDestination[];
  entry: ExperienceFormEntry;
  index: number;
  isBusy: boolean;
  mode: ExperienceEditorMode;
  onAttractionPhotoNameChange: (
    localId: string,
    index: number,
    value: string
  ) => void;
  onAttractionPhotoUpload: (localId: string, files: FileList | null) => void;
  onPhotoUpload: (localId: string, files: FileList | null) => void;
  onRemoveEntry: (localId: string) => void;
  onRemoveAttractionPhoto: (localId: string, index: number) => void;
  onRemovePhoto: (localId: string, index: number) => void;
  onRemoveVideo: (localId: string, index: number) => void;
  onUpdate: <K extends keyof ExperienceFormState>(
    localId: string,
    field: K,
    value: ExperienceFormState[K]
  ) => void;
  onVideoTitleChange: (localId: string, index: number, value: string) => void;
  onVideoUpload: (localId: string, files: FileList | null) => void;
}) {
  const overallRating = calculateOverallRating(entry.form);
  const title = entry.form.travellerName.trim() || `Experience ${index + 1}`;
  const destinationName = getDestinationName(
    entry.form.destinationId,
    destinationNameById
  );

  return (
    <section className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/25 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <UserRound className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">{title}</p>
            <p className="mt-1 truncate text-xs text-foreground/55">
              Traveller Experience {index + 1} / {destinationName}
            </p>
          </div>
        </div>

        {canRemove ? (
          <button
            type="button"
            onClick={() => onRemoveEntry(entry.localId)}
            disabled={isBusy}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-sm border border-red-200 bg-white px-3 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:pointer-events-none disabled:opacity-50"
          >
            <Trash2 className="size-4" />
            Remove
          </button>
        ) : null}
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-2">
        <FormField label="Destination ID" required>
          <Select
            disabled={destinations.length === 0}
            value={entry.form.destinationId}
            onValueChange={(value) =>
              onUpdate(entry.localId, "destinationId", String(value || ""))
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
                  <SelectItem key={destination.id} value={destination.destinationId}>
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
            value={entry.form.travellerName}
            onChange={(event) =>
              onUpdate(entry.localId, "travellerName", event.target.value)
            }
            className={inputClassName}
            placeholder="Rahul Sharma"
          />
        </FormField>

        <FormField label="Traveller Email">
          <input
            type="email"
            value={entry.form.travellerEmail}
            onChange={(event) =>
              onUpdate(entry.localId, "travellerEmail", event.target.value)
            }
            className={inputClassName}
            placeholder="traveller@example.com"
          />
        </FormField>

        <FormField className="sm:col-span-2" label="Written Reviews">
          <textarea
            value={entry.form.writtenReview}
            onChange={(event) =>
              onUpdate(entry.localId, "writtenReview", event.target.value)
            }
            className={textareaClassName}
            placeholder="Traveller review"
          />
        </FormField>

        <FormField className="sm:col-span-2" label="Things to Know">
          <textarea
            value={entry.form.thingsToKnow}
            onChange={(event) =>
              onUpdate(entry.localId, "thingsToKnow", event.target.value)
            }
            className={textareaClassName}
            placeholder={"Temple timings\nBest light for photos\nCarry water"}
          />
        </FormField>

        <RatingInput
          label="Itinerary Rating"
          value={entry.form.ratingItinerary}
          onChange={(value) => onUpdate(entry.localId, "ratingItinerary", value)}
        />

        <RatingInput
          label="Local Transport Rating"
          value={entry.form.ratingLocalTransport}
          onChange={(value) =>
            onUpdate(entry.localId, "ratingLocalTransport", value)
          }
        />

        <RatingInput
          label="Accommodation Rating"
          value={entry.form.ratingAccommodation}
          onChange={(value) =>
            onUpdate(entry.localId, "ratingAccommodation", value)
          }
        />

        <RatingInput
          label="Tour Expert Rating"
          value={entry.form.ratingTourExpert}
          onChange={(value) => onUpdate(entry.localId, "ratingTourExpert", value)}
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
            value={entry.form.status}
            onValueChange={(value) => {
              if (value === "Draft" || value === "Published") {
                onUpdate(entry.localId, "status", value);
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
          <UploadField
            accept="image/*"
            disabled={isBusy}
            isUploading={entry.isUploadingPhotos}
            label="Upload traveller photos"
            multiple
            onFilesSelected={(files) => onPhotoUpload(entry.localId, files)}
          />
          <ImagePreviewGrid
            images={entry.form.travellerPhotoGallery}
            onRemove={(photoIndex) => onRemovePhoto(entry.localId, photoIndex)}
          />
        </FormField>

        <FormField className="sm:col-span-2" label="Traveller Videos">
          <UploadField
            accept="video/mp4,video/quicktime,video/webm"
            disabled={isBusy}
            isUploading={entry.isUploadingVideos}
            label="Upload traveller videos"
            multiple
            onFilesSelected={(files) => onVideoUpload(entry.localId, files)}
          />
          <VideoPreviewGrid
            onTitleChange={(videoIndex, value) =>
              onVideoTitleChange(entry.localId, videoIndex, value)
            }
            onRemove={(videoIndex) => onRemoveVideo(entry.localId, videoIndex)}
            titles={entry.form.travellerVideoTitles}
            videos={entry.form.travellerVideos}
          />
        </FormField>

        <FormField className="sm:col-span-2" label="Attraction Photos">
          <UploadField
            accept="image/*"
            disabled={isBusy}
            isUploading={entry.isUploadingAttractionPhotos}
            label="Upload attraction photos"
            multiple
            onFilesSelected={(files) =>
              onAttractionPhotoUpload(entry.localId, files)
            }
          />
          <AttractionPhotoPreviewGrid
            onNameChange={(photoIndex, value) =>
              onAttractionPhotoNameChange(entry.localId, photoIndex, value)
            }
            onRemove={(photoIndex) =>
              onRemoveAttractionPhoto(entry.localId, photoIndex)
            }
            photos={entry.form.attractionPhotoGallery}
          />
        </FormField>

        {mode === "edit" ? (
          <div className="sm:col-span-2 rounded-sm border border-primary/20 bg-primary/5 px-4 py-3 text-xs font-semibold text-primary">
            Editing this record will keep its table position and update the saved
            traveller experience after submit.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ExperienceSummary({
  destinationNameById,
  entries,
  mode,
}: {
  destinationNameById: Map<string, string>;
  entries: ExperienceFormEntry[];
  mode: ExperienceEditorMode;
}) {
  const totalPhotos = entries.reduce(
    (total, entry) => total + entry.form.travellerPhotoGallery.length,
    0
  );
  const totalAttractionPhotos = entries.reduce(
    (total, entry) => total + entry.form.attractionPhotoGallery.length,
    0
  );
  const totalVideos = entries.reduce(
    (total, entry) => total + entry.form.travellerVideos.length,
    0
  );

  return (
    <aside className="sticky top-5 rounded-sm border border-border bg-white p-5 shadow-sm shadow-stone-200/40">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <FileText className="size-5" />
        </span>
        <div>
          <h2 className="font-sans text-lg font-bold tracking-normal text-foreground">
            {mode === "edit" ? "Record Summary" : "Batch Summary"}
          </h2>
          <p className="mt-1 text-xs text-foreground/55">
            {entries.length} experience{entries.length === 1 ? "" : "s"} /{" "}
            {totalPhotos} traveller photos / {totalAttractionPhotos} attraction
            photos / {totalVideos} videos
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-2">
        {entries.map((entry, index) => {
          const title = entry.form.travellerName.trim() || `Experience ${index + 1}`;
          const destinationName = getDestinationName(
            entry.form.destinationId,
            destinationNameById
          );
          const overallRating = calculateOverallRating(entry.form);

          return (
            <div
              key={entry.localId}
              className="rounded-sm border border-border bg-muted/20 px-3 py-3"
            >
              <p className="truncate text-xs font-bold text-foreground">
                {title}
              </p>
              <p className="mt-1 truncate text-[11px] text-foreground/55">
                {destinationName}
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-foreground/60">
                  {entry.form.status}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary">
                  {overallRating.toFixed(1)}
                  <Star className="size-3 fill-current" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function RatingInput({
  label,
  onChange,
  value,
}: {
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
        step={0.1}
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
      />
    </FormField>
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

function ImagePreviewGrid({
  images,
  onRemove,
}: {
  images: string[];
  onRemove: (index: number) => void;
}) {
  if (images.length === 0) {
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
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {images.map((image, index) => (
        <div
          key={`${image}-${index}`}
          className="relative h-24 overflow-hidden rounded-sm border border-border bg-muted"
        >
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="absolute right-1.5 top-1.5 z-10 grid size-6 place-items-center rounded-sm border border-white/70 bg-white/95 text-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
            aria-label={`Remove traveller photo ${index + 1}`}
          >
            <X className="size-3.5" />
          </button>
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
  onRemove,
  onTitleChange,
  titles,
  videos,
}: {
  onRemove: (index: number) => void;
  onTitleChange: (index: number, value: string) => void;
  titles: string[];
  videos: string[];
}) {
  if (videos.length === 0) {
    return (
      <div className="grid h-32 place-items-center rounded-sm border border-dashed border-border bg-muted/35 text-xs font-medium text-foreground/45">
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
          className="relative grid gap-3 overflow-hidden rounded-sm border border-border bg-muted p-3"
        >
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="absolute right-1.5 top-1.5 z-10 grid size-6 place-items-center rounded-sm border border-white/70 bg-white/95 text-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
            aria-label={`Remove traveller video ${index + 1}`}
          >
            <X className="size-3.5" />
          </button>
          <input
            value={titles[index] || ""}
            onChange={(event) => onTitleChange(index, event.target.value)}
            className={inputClassName}
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
  onNameChange,
  onRemove,
  photos,
}: {
  onNameChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
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
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="absolute right-3 top-3 z-10 grid size-6 place-items-center rounded-sm border border-white/70 bg-white/95 text-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
            aria-label={`Remove attraction photo ${index + 1}`}
          >
            <X className="size-3.5" />
          </button>
          <div
            className="h-28 rounded-sm bg-cover bg-center"
            role="img"
            aria-label={photo.name || `Attraction photo ${index + 1}`}
            style={{
              backgroundImage: `url("${getExperienceMediaUrl(photo.image)}")`,
            }}
          />
          <input
            value={photo.name}
            onChange={(event) => onNameChange(index, event.target.value)}
            className={inputClassName}
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
