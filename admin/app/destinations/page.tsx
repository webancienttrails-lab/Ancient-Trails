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
  Star,
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
import {
  getAdminHomePage,
  getDefaultDestinationMarker,
  updateAdminHomePage,
  type HomePageContent,
  type HomePagePayload,
} from "@/lib/home";
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
  | "keyLandmarks"
  | "keyLandmarkImages"
  | "galleryImages"
  | "recommendedDurationDays"
> & {
  keyLandmarks: string;
  keyLandmarkImages: string;
  galleryImages: string;
  recommendedDurationDays: string;
};
type DestinationSheetMode = "add" | "view" | "edit";

type DestinationRouteState = {
  id: string | null;
  mode: DestinationSheetMode | null;
};

const emptyDestinationForm: DestinationFormState = {
  destinationId: "",
  destinationName: "",
  destinationType: "Domestic",
  countryRegion: "",
  region: "",
  state: "",
  city: "",
  primaryHeritageFocus: "",
  bestTimeToVisit: "",
  unescoSite: false,
  keyLandmarks: "",
  keyLandmarkImages: "",
  recommendedDurationDays: "1",
  shortDescription: "",
  dressCode: "",
  footwear: "",
  permits: "",
  idRequirement: "",
  restrictions: "",
  thumbnailImage: "",
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

const domesticRegionOptions = [
  "North India",
  "South India",
  "Central India",
  "West India",
  "East India",
];

const internationalRegionOptions = [
  "Central Asia",
  "Southeast Asia",
  "South Asia",
  "East Asia",
  "Middle East",
  "Caucasus",
  "Central Europe",
  "Eastern Europe",
  "Western Europe",
  "Northern Europe",
  "Southern Europe",
  "Scandinavia",
  "Balkans",
  "Mediterranean",
  "North Africa",
  "East Africa",
  "Southern Africa",
  "West Africa",
  "Central Africa",
  "North America",
  "Central America",
  "South America",
  "Caribbean",
  "Oceania",
  "Pacific Islands",
];

function getRegionOptions(destinationType: DestinationType) {
  return destinationType === "Domestic"
    ? domesticRegionOptions
    : internationalRegionOptions;
}

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

function parseFormLineList(value: string): string[] {
  return value === "" ? [] : value.split("\n");
}

function serializeFormLineList(values: string[]): string {
  return values.join("\n");
}

function updateFormLineListValue(
  currentValue: string,
  indexToUpdate: number,
  nextValue: string
): string {
  const values = parseFormLineList(currentValue);

  while (values.length <= indexToUpdate) {
    values.push("");
  }

  values[indexToUpdate] = nextValue;

  return serializeFormLineList(values);
}

function trimTrailingEmptyValues(values: string[]): string[] {
  const trimmedValues = values.map((value) => value.trim());

  while (
    trimmedValues.length > 0 &&
    trimmedValues[trimmedValues.length - 1] === ""
  ) {
    trimmedValues.pop();
  }

  return trimmedValues;
}

function getLandmarkRows(destinationForm: DestinationFormState) {
  const landmarkNames = parseFormLineList(destinationForm.keyLandmarks);
  const landmarkImages = parseFormLineList(destinationForm.keyLandmarkImages);
  const rowCount = Math.max(landmarkNames.length, landmarkImages.length, 1);

  return Array.from({ length: rowCount }, (_item, index) => ({
    image: landmarkImages[index] || "",
    name: landmarkNames[index] || "",
  }));
}

function createKeyLandmarkPayload(destinationForm: DestinationFormState) {
  const landmarkRows = getLandmarkRows(destinationForm)
    .map((row) => ({
      image: row.image.trim(),
      name: row.name.trim(),
    }))
    .filter((row) => row.name);

  return {
    keyLandmarkImages: trimTrailingEmptyValues(
      landmarkRows.map((row) => row.image)
    ),
    keyLandmarks: landmarkRows.map((row) => row.name),
  };
}

function destinationToForm(destination: AdminDestination): DestinationFormState {
  return {
    destinationId: destination.destinationId,
    destinationName: destination.destinationName,
    destinationType: destination.destinationType,
    countryRegion: destination.countryRegion,
    region: destination.region || "",
    state: destination.state,
    city: destination.city,
    primaryHeritageFocus: destination.primaryHeritageFocus,
    bestTimeToVisit: destination.bestTimeToVisit || "",
    unescoSite: destination.unescoSite,
    keyLandmarks: destination.keyLandmarks.join("\n"),
    keyLandmarkImages: (destination.keyLandmarkImages || []).join("\n"),
    recommendedDurationDays: destination.recommendedDurationDays.toString(),
    shortDescription: destination.shortDescription,
    dressCode: destination.dressCode,
    footwear: destination.footwear,
    permits: destination.permits,
    idRequirement: destination.idRequirement,
    restrictions: destination.restrictions,
    thumbnailImage: destination.thumbnailImage || "",
    bannerImage: destination.bannerImage,
    galleryImages: destination.galleryImages.join("\n"),
  };
}

function createDestinationPayload(
  destinationForm: DestinationFormState
): DestinationPayload {
  const keyLandmarkPayload = createKeyLandmarkPayload(destinationForm);

  return {
    ...destinationForm,
    destinationId: destinationForm.destinationId.trim(),
    destinationName: destinationForm.destinationName.trim(),
    countryRegion: destinationForm.countryRegion.trim(),
    region: destinationForm.region.trim(),
    state: destinationForm.state.trim(),
    city: destinationForm.city.trim(),
    primaryHeritageFocus: destinationForm.primaryHeritageFocus.trim(),
    bestTimeToVisit: destinationForm.bestTimeToVisit.trim(),
    recommendedDurationDays:
      Number(destinationForm.recommendedDurationDays) || 1,
    shortDescription: destinationForm.shortDescription.trim(),
    dressCode: destinationForm.dressCode.trim(),
    footwear: destinationForm.footwear.trim(),
    permits: destinationForm.permits.trim(),
    idRequirement: destinationForm.idRequirement.trim(),
    restrictions: destinationForm.restrictions.trim(),
    thumbnailImage: destinationForm.thumbnailImage.trim(),
    keyLandmarks: keyLandmarkPayload.keyLandmarks,
    keyLandmarkImages: keyLandmarkPayload.keyLandmarkImages,
    bannerImage: destinationForm.bannerImage.trim(),
    galleryImages: parseTextList(destinationForm.galleryImages),
  };
}

function sortBySortOrder<TItem extends { sortOrder: number }>(items: TItem[]) {
  return [...items].sort((left, right) => left.sortOrder - right.sortOrder);
}

type HomeTrendingDestinationInput = Pick<
  HomePageContent["trendingDestinations"][number],
  "destinationId" | "markerX" | "markerY" | "sortOrder"
>;

function createHomePagePayload(
  content: HomePageContent,
  trendingDestinations: HomeTrendingDestinationInput[]
): HomePagePayload {
  return {
    upcomingTours: sortBySortOrder(content.upcomingTours).map(
      ({ departureId, tourId }, index) => ({
        departureId,
        sortOrder: index,
        tourId,
      })
    ),
    trendingDestinations: trendingDestinations.map(
      ({ destinationId, markerX, markerY }, index) => ({
        destinationId,
        markerX,
        markerY,
        sortOrder: index,
      })
    ),
    customisedTourDestinations: sortBySortOrder(
      content.customisedTourDestinations || []
    ).map(({ destinationId }, index) => ({
      destinationId,
      sortOrder: index,
    })),
    homeExperiences: sortBySortOrder(content.homeExperiences || []).map(
      ({ experienceId }, index) => ({
        experienceId,
        sortOrder: index,
      })
    ),
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
  destinations: AdminDestination[],
  topDestinationCount: number
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
    {
      label: "Top Destinations",
      value: `${topDestinationCount}/8`,
      trend: "Homepage destination cards",
      icon: Star,
      tone: "bg-sky-100 text-sky-700",
      trendTone: "text-sky-600",
    },
  ];
}

export default function DestinationsPage() {
  return (
    <Suspense fallback={null}>
      <DestinationsPageContent />
    </Suspense>
  );
}

function getDestinationRouteState(
  pathname: string,
  id: string | null
): DestinationRouteState {
  const segments = pathname
    .split("/")
    .filter(Boolean);

  const destinationsIndex =
    segments.findIndex(
      (segment) =>
        segment === "destinations"
    );

  const pageSegment =
    destinationsIndex >= 0
      ? segments[destinationsIndex + 1]
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

function DestinationsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const searchParamString =
    searchParams.toString();
  const routeState = useMemo(
    () =>
      getDestinationRouteState(
        pathname,
        new URLSearchParams(
          searchParamString
        ).get("id")
      ),
    [pathname, searchParamString]
  );
  const [destinations, setDestinations] = useState<AdminDestination[]>([]);
  const [homePageContent, setHomePageContent] =
    useState<HomePageContent | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingDestinations, setIsLoadingDestinations] = useState(true);
  const [isLoadingHomePage, setIsLoadingHomePage] = useState(true);
  const [destinationSheetMode, setDestinationSheetMode] =
    useState<DestinationSheetMode | null>(
      routeState.mode === "add"
        ? "add"
        : null
    );
  const [selectedDestination, setSelectedDestination] =
    useState<AdminDestination | null>(null);
  const [isSavingDestination, setIsSavingDestination] = useState(false);
  const [isUploadingThumbnailImage, setIsUploadingThumbnailImage] =
    useState(false);
  const [isUploadingBannerImage, setIsUploadingBannerImage] = useState(false);
  const [
    uploadingKeyLandmarkImageIndex,
    setUploadingKeyLandmarkImageIndex,
  ] = useState<number | null>(null);
  const [isUploadingGalleryImages, setIsUploadingGalleryImages] =
    useState(false);
  const [savingTopDestinationId, setSavingTopDestinationId] =
    useState<string | null>(null);
  const [destinationForm, setDestinationForm] =
    useState<DestinationFormState>(emptyDestinationForm);

  useEffect(() => {
    let isMounted = true;

    async function loadDestinationAdmin() {
      const [destinationsResult, homeResult] = await Promise.allSettled([
        listAdminDestinations(),
        getAdminHomePage(),
      ]);

      if (!isMounted) {
        return;
      }

      if (destinationsResult.status === "fulfilled") {
        const loadedDestinations =
          destinationsResult.value.data.destinations;

        setDestinations(loadedDestinations);

        if (
          routeState.mode &&
          routeState.mode !== "add"
        ) {
          const destination =
            loadedDestinations.find(
              (item) =>
                item.id === routeState.id
            );

          if (destination) {
            setDestinationSheetMode(routeState.mode);
            setSelectedDestination(destination);
            setDestinationForm(destinationToForm(destination));
            setUploadingKeyLandmarkImageIndex(null);
          }
        }
      } else {
        toast.error(
          "Unable to load destinations",
          getErrorMessage(destinationsResult.reason)
        );
      }

      if (homeResult.status === "fulfilled") {
        setHomePageContent(homeResult.value.data.home);
      } else {
        toast.error(
          "Unable to load top destinations",
          getErrorMessage(homeResult.reason)
        );
      }

      setIsLoadingDestinations(false);
      setIsLoadingHomePage(false);
    }

    loadDestinationAdmin();

    return () => {
      isMounted = false;
    };
  }, [routeState, toast]);

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
        destination.region,
        destination.state,
        destination.city,
        destination.primaryHeritageFocus,
        destination.bestTimeToVisit,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [destinations, searchQuery]);

  const topDestinationSettings = useMemo(
    () =>
      sortBySortOrder(homePageContent?.trendingDestinations || []).slice(0, 8),
    [homePageContent?.trendingDestinations]
  );
  const topDestinationIds = useMemo(
    () =>
      new Set(
        topDestinationSettings.map((destination) => destination.destinationId)
      ),
    [topDestinationSettings]
  );
  const destinationMetrics = useMemo(
    () => createDestinationMetrics(destinations, topDestinationSettings.length),
    [destinations, topDestinationSettings.length]
  );
  const isDestinationFormBusy =
    isSavingDestination ||
    isUploadingThumbnailImage ||
    isUploadingBannerImage ||
    uploadingKeyLandmarkImageIndex !== null ||
    isUploadingGalleryImages;
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
    router.push("/destinations/add");
  }

  function openViewDestinationSheet(destination: AdminDestination) {
    router.push(
      `/destinations/view?id=${encodeURIComponent(destination.id)}`
    );
  }

  function openEditDestinationSheet(destination: AdminDestination) {
    router.push(
      `/destinations/edit?id=${encodeURIComponent(destination.id)}`
    );
  }

  function closeDestinationSheet() {
    if (isDestinationFormBusy) {
      return;
    }

    if (routeState.mode) {
      router.push("/destinations");
      return;
    }

    setDestinationSheetMode(null);
    setSelectedDestination(null);
    setDestinationForm(emptyDestinationForm);
    setUploadingKeyLandmarkImageIndex(null);
  }

  async function handleThumbnailImageUpload(files: FileList | null) {
    const [thumbnailImage] = Array.from(files || []);

    if (!thumbnailImage) {
      return;
    }

    setIsUploadingThumbnailImage(true);

    try {
      const response = await uploadDestinationImages({ thumbnailImage });

      setDestinationForm((currentForm) => ({
        ...currentForm,
        thumbnailImage: response.data.thumbnailImage,
      }));
      toast.success("Thumbnail uploaded", response.message);
    } catch (error) {
      toast.error("Thumbnail upload failed", getErrorMessage(error));
    } finally {
      setIsUploadingThumbnailImage(false);
    }
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

  async function handleKeyLandmarkImageUpload(
    landmarkIndex: number,
    files: FileList | null
  ) {
    const [keyLandmarkImage] = Array.from(files || []);

    if (!keyLandmarkImage) {
      return;
    }

    setUploadingKeyLandmarkImageIndex(landmarkIndex);

    try {
      const response = await uploadDestinationImages({
        galleryImages: [keyLandmarkImage],
      });
      const [uploadedImage] = response.data.galleryImages;

      if (!uploadedImage) {
        throw new Error("No landmark image was returned from the upload.");
      }

      setDestinationForm((currentForm) => ({
        ...currentForm,
        keyLandmarkImages: updateFormLineListValue(
          currentForm.keyLandmarkImages,
          landmarkIndex,
          uploadedImage
        ),
      }));
      toast.success("Landmark image uploaded", response.message);
    } catch (error) {
      toast.error("Landmark image upload failed", getErrorMessage(error));
    } finally {
      setUploadingKeyLandmarkImageIndex(null);
    }
  }

  function handleRemoveThumbnailImage() {
    updateDestinationForm("thumbnailImage", "");
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

  function handleRemoveKeyLandmarkImage(indexToRemove: number) {
    setDestinationForm((currentForm) => ({
      ...currentForm,
      keyLandmarkImages: updateFormLineListValue(
        currentForm.keyLandmarkImages,
        indexToRemove,
        ""
      ),
    }));
  }

  function handleDeleteDestination(destination: AdminDestination) {
    toast.warning(
      "Delete destination",
      `${destination.destinationName} delete confirmation will open here.`
    );
  }

  async function handleToggleTopDestination(
    destination: AdminDestination,
    isSelected: boolean
  ) {
    if (!homePageContent) {
      toast.error(
        "Top destinations unavailable",
        "Please wait for the home page settings to finish loading."
      );
      return;
    }

    const currentTopDestinations = sortBySortOrder(
      homePageContent.trendingDestinations
    );
    const isAlreadySelected = currentTopDestinations.some(
      (item) => item.destinationId === destination.destinationId
    );

    if (isSelected && isAlreadySelected) {
      return;
    }

    if (!isSelected && !isAlreadySelected) {
      return;
    }

    if (isSelected && currentTopDestinations.length >= 8) {
      toast.error(
        "Limit reached",
        "Top Destinations can show up to 8 cards."
      );
      return;
    }

    const nextTopDestinations = isSelected
      ? [
          ...currentTopDestinations,
          {
            destinationId: destination.destinationId,
            ...getDefaultDestinationMarker(
              destination,
              currentTopDestinations.length
            ),
            sortOrder: currentTopDestinations.length,
          },
        ]
      : currentTopDestinations.filter(
          (item) => item.destinationId !== destination.destinationId
        );

    setSavingTopDestinationId(destination.destinationId);

    try {
      const response = await updateAdminHomePage(
        createHomePagePayload(homePageContent, nextTopDestinations)
      );

      setHomePageContent(response.data.home);
      toast.success(
        isSelected ? "Top destination added" : "Top destination removed",
        `${destination.destinationName} has been ${
          isSelected ? "added to" : "removed from"
        } the home page.`
      );
    } catch (error) {
      toast.error("Top destination not updated", getErrorMessage(error));
    } finally {
      setSavingTopDestinationId(null);
    }
  }

  async function handleSaveDestination(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      destinationSheetMode === "view" ||
      isUploadingThumbnailImage ||
      isUploadingBannerImage ||
      uploadingKeyLandmarkImageIndex !== null ||
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
        setUploadingKeyLandmarkImageIndex(null);
        toast.success("Destination updated", response.message);
        router.push("/destinations");
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
      setUploadingKeyLandmarkImageIndex(null);
      toast.success("Destination added", response.message);
      router.push("/destinations");
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

  if (routeState.mode) {
    return (
      <AdminDashboardShell activeLabel="Destinations">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/destinations")}
              className="h-10 rounded-sm border-border bg-white px-3 text-xs font-bold"
            >
              <ArrowLeft className="size-4" />
              Back to Destinations
            </Button>
          </div>

          {routeState.mode !== "add" &&
          isLoadingDestinations ? (
            <section className="rounded-sm border border-border bg-white p-8 text-sm text-foreground/60 shadow-sm shadow-stone-200/40">
              Loading destination...
            </section>
          ) : null}

          {destinationSheetMode ? (
            <DestinationFormDialog
              form={destinationForm}
              mode={destinationSheetMode}
              isOpen
              isBusy={isDestinationFormBusy}
              isSaving={isSavingDestination}
              isUploadingThumbnailImage={isUploadingThumbnailImage}
              isUploadingBannerImage={isUploadingBannerImage}
              uploadingKeyLandmarkImageIndex={uploadingKeyLandmarkImageIndex}
              isUploadingGalleryImages={isUploadingGalleryImages}
              onThumbnailImageUpload={handleThumbnailImageUpload}
              onBannerImageUpload={handleBannerImageUpload}
              onClose={closeDestinationSheet}
              onGalleryImagesUpload={handleGalleryImagesUpload}
              onKeyLandmarkImageUpload={handleKeyLandmarkImageUpload}
              onRemoveThumbnailImage={handleRemoveThumbnailImage}
              onRemoveBannerImage={handleRemoveBannerImage}
              onRemoveGalleryImage={handleRemoveGalleryImage}
              onRemoveKeyLandmarkImage={handleRemoveKeyLandmarkImage}
              onSubmit={handleSaveDestination}
              onUpdate={updateDestinationForm}
            />
          ) : !isLoadingDestinations ? (
            <section className="rounded-sm border border-red-200 bg-red-50 p-6">
              <p className="text-sm font-bold text-red-700">
                Destination not found.
              </p>
            </section>
          ) : null}
        </div>
      </AdminDashboardShell>
    );
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
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
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
            isTopDestinationLoading={isLoadingHomePage}
            onDelete={handleDeleteDestination}
            onEdit={openEditDestinationSheet}
            onToggleTopDestination={handleToggleTopDestination}
            onView={openViewDestinationSheet}
            savingTopDestinationId={savingTopDestinationId}
            topDestinationCount={topDestinationSettings.length}
            topDestinationIds={topDestinationIds}
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
        isUploadingThumbnailImage={isUploadingThumbnailImage}
        isUploadingBannerImage={isUploadingBannerImage}
        uploadingKeyLandmarkImageIndex={uploadingKeyLandmarkImageIndex}
        isUploadingGalleryImages={isUploadingGalleryImages}
        onThumbnailImageUpload={handleThumbnailImageUpload}
        onBannerImageUpload={handleBannerImageUpload}
        onClose={closeDestinationSheet}
        onGalleryImagesUpload={handleGalleryImagesUpload}
        onKeyLandmarkImageUpload={handleKeyLandmarkImageUpload}
        onRemoveThumbnailImage={handleRemoveThumbnailImage}
        onRemoveBannerImage={handleRemoveBannerImage}
        onRemoveGalleryImage={handleRemoveGalleryImage}
        onRemoveKeyLandmarkImage={handleRemoveKeyLandmarkImage}
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
  isTopDestinationLoading,
  onDelete,
  onEdit,
  onToggleTopDestination,
  onView,
  savingTopDestinationId,
  topDestinationCount,
  topDestinationIds,
  totalCount,
}: {
  destinations: AdminDestination[];
  isLoading: boolean;
  isTopDestinationLoading: boolean;
  onDelete: (destination: AdminDestination) => void;
  onEdit: (destination: AdminDestination) => void;
  onToggleTopDestination: (
    destination: AdminDestination,
    isSelected: boolean
  ) => void;
  onView: (destination: AdminDestination) => void;
  savingTopDestinationId: string | null;
  topDestinationCount: number;
  topDestinationIds: Set<string>;
  totalCount: number;
}) {
  return (
    <>
      <div className="max-w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[12%]" />
            <col className="w-[24%]" />
            <col className="w-[9%]" />
            <col className="w-[14%]" />
            <col className="w-[12%]" />
            <col className="w-[6%]" />
            <col className="w-[10%]" />
            <col className="w-[6%]" />
            <col className="w-[7%]" />
          </colgroup>
          <thead className="bg-muted/35 text-[11px] uppercase text-foreground/55">
            <tr>
              <th className="px-2.5 py-3 font-bold">Destination ID</th>
              <th className="px-3 py-3 font-bold">Destination</th>
              <th className="px-2.5 py-3 font-bold">Type</th>
              <th className="px-2.5 py-3 font-bold">Country</th>
              <th className="px-2.5 py-3 font-bold">State / City</th>
              <th className="px-2.5 py-3 font-bold">UNESCO</th>
              <th className="px-2.5 py-3 text-center font-bold">
                Top Destination
              </th>
              <th className="px-2.5 py-3 font-bold">Days</th>
              <th className="px-2.5 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-5 py-8 text-center text-xs text-foreground/55" colSpan={9}>
                  Loading destinations...
                </td>
              </tr>
            ) : null}

            {!isLoading && destinations.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-center text-xs text-foreground/55" colSpan={9}>
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
                            destination.thumbnailImage ||
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
                    <td data-label="Country" className="px-2.5 py-3">
                      <div className="flex min-w-0 items-start gap-2 text-xs text-foreground/70">
                        <CountryFlag country={destination.countryRegion} />
                        <div className="min-w-0">
                          <span className="block truncate">
                            {destination.countryRegion}
                          </span>
                          <span className="mt-1 block truncate text-foreground/50">
                            {destination.region || "-"}
                          </span>
                        </div>
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
                    <td
                      data-label="Top Destination"
                      className="px-2.5 py-3 text-center"
                    >
                      <TopDestinationToggle
                        destination={destination}
                        isChecked={topDestinationIds.has(
                          destination.destinationId
                        )}
                        isLoading={isTopDestinationLoading}
                        isSaving={
                          savingTopDestinationId ===
                          destination.destinationId
                        }
                        isTemporarilyLocked={savingTopDestinationId !== null}
                        limitReached={topDestinationCount >= 8}
                        onToggle={onToggleTopDestination}
                      />
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

function TopDestinationToggle({
  destination,
  isChecked,
  isLoading,
  isSaving,
  isTemporarilyLocked,
  limitReached,
  onToggle,
}: {
  destination: AdminDestination;
  isChecked: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isTemporarilyLocked: boolean;
  limitReached: boolean;
  onToggle: (destination: AdminDestination, isSelected: boolean) => void;
}) {
  const isLimitDisabled = !isChecked && limitReached;
  const isDisabled =
    isLoading || isSaving || isTemporarilyLocked || isLimitDisabled;

  return (
    <label
      className={cn(
        "inline-grid size-9 place-items-center rounded-sm border border-border bg-white transition-colors",
        isChecked && "border-primary bg-primary/10",
        isLimitDisabled && "cursor-not-allowed opacity-45",
        isSaving && "opacity-60",
        !isDisabled && "cursor-pointer hover:border-primary"
      )}
      title={
        isLimitDisabled
          ? "Top Destinations can show up to 8 cards."
          : undefined
      }
    >
      <input
        checked={isChecked}
        disabled={isDisabled}
        onChange={(event) => onToggle(destination, event.target.checked)}
        type="checkbox"
        className="size-4 accent-primary disabled:cursor-not-allowed"
        aria-label={`Mark ${destination.destinationName} as a top destination`}
      />
    </label>
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
  isUploadingThumbnailImage,
  isUploadingBannerImage,
  uploadingKeyLandmarkImageIndex,
  isUploadingGalleryImages,
  onThumbnailImageUpload,
  onBannerImageUpload,
  onClose,
  onGalleryImagesUpload,
  onKeyLandmarkImageUpload,
  onRemoveThumbnailImage,
  onRemoveBannerImage,
  onRemoveGalleryImage,
  onRemoveKeyLandmarkImage,
  onSubmit,
  onUpdate,
}: {
  form: DestinationFormState;
  isBusy: boolean;
  mode: DestinationSheetMode | null;
  isOpen: boolean;
  isSaving: boolean;
  isUploadingThumbnailImage: boolean;
  isUploadingBannerImage: boolean;
  uploadingKeyLandmarkImageIndex: number | null;
  isUploadingGalleryImages: boolean;
  onThumbnailImageUpload: (files: FileList | null) => void;
  onBannerImageUpload: (files: FileList | null) => void;
  onClose: () => void;
  onGalleryImagesUpload: (files: FileList | null) => void;
  onKeyLandmarkImageUpload: (
    landmarkIndex: number,
    files: FileList | null
  ) => void;
  onRemoveThumbnailImage: () => void;
  onRemoveBannerImage: () => void;
  onRemoveGalleryImage: (index: number) => void;
  onRemoveKeyLandmarkImage: (index: number) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof DestinationFormState>(
    field: K,
    value: DestinationFormState[K]
  ) => void;
}) {
  const isReadOnly = mode === "view";
  const panelTitle =
    mode === "edit"
      ? "Edit Destination"
      : mode === "view"
        ? "View Destination"
        : "Add Destination";
  const panelDescription =
    mode === "edit"
      ? "Update the destination profile and travel requirements."
      : mode === "view"
        ? "Review the destination profile and travel requirements."
        : "Add the destination profile and travel requirements.";
  const submitButtonLabel = isSaving
    ? "Saving..."
    : isUploadingThumbnailImage ||
        isUploadingBannerImage ||
        uploadingKeyLandmarkImageIndex !== null ||
        isUploadingGalleryImages
      ? "Uploading images..."
      : mode === "edit"
        ? "Update Destination"
      : "Save Destination";
  const inputClassName =
    "h-11 rounded-sm border border-border bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";
  const textareaClassName =
    "min-h-20 rounded-sm border border-border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 read-only:cursor-default read-only:bg-muted/35 disabled:cursor-default disabled:bg-muted/35 disabled:text-foreground/60";
  const regionOptions = getRegionOptions(form.destinationType);
  const regionSelectOptions =
    form.region && !regionOptions.includes(form.region)
      ? [form.region, ...regionOptions]
      : regionOptions;

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
            aria-label="Close add destination form"
          >
              <X className="size-4" />
          </button>
          </div>
        </div>

          <div className="grid min-h-0 flex-1 gap-5 px-7 py-6 sm:grid-cols-2">
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
                  const nextDestinationType = value as DestinationType;

                  onUpdate("destinationType", nextDestinationType);

                  if (
                    form.region &&
                    !getRegionOptions(nextDestinationType).includes(form.region)
                  ) {
                    onUpdate("region", "");
                  }
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

          <FormField label="Country" required>
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

          <FormField label="Region">
            <Select
              disabled={isReadOnly}
              value={form.region}
              onValueChange={(value) => onUpdate("region", String(value || ""))}
            >
              <SelectTrigger className={inputClassName}>
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent>
                {regionSelectOptions.map((region) => (
                  <SelectItem key={region} value={region}>
                    {region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <FormField label="Best Time To Visit">
            <input
              readOnly={isReadOnly}
              value={form.bestTimeToVisit}
              onChange={(event) =>
                onUpdate("bestTimeToVisit", event.target.value)
              }
                className={inputClassName}
              placeholder="Oct - Mar"
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
              <LandmarkImageRows
                form={form}
                inputClassName={inputClassName}
                isBusy={isBusy}
                isReadOnly={isReadOnly}
                uploadingKeyLandmarkImageIndex={
                  uploadingKeyLandmarkImageIndex
                }
                onImageUpload={onKeyLandmarkImageUpload}
                onRemoveImage={onRemoveKeyLandmarkImage}
                onUpdate={onUpdate}
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

            <FormField className="sm:col-span-2" label="Thumbnail Image">
              {!isReadOnly ? (
                <UploadField
                  accept="image/*"
                  disabled={isBusy}
                  isUploading={isUploadingThumbnailImage}
                  label="Upload thumbnail image"
                  onFilesSelected={onThumbnailImageUpload}
                />
              ) : null}
              <ImagePreviewGrid
                images={
                  form.thumbnailImage.trim() ? [form.thumbnailImage.trim()] : []
                }
                onRemove={!isReadOnly ? onRemoveThumbnailImage : undefined}
                variant="thumbnail"
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

function LandmarkImageRows({
  form,
  inputClassName,
  isBusy,
  isReadOnly,
  uploadingKeyLandmarkImageIndex,
  onImageUpload,
  onRemoveImage,
  onUpdate,
}: {
  form: DestinationFormState;
  inputClassName: string;
  isBusy: boolean;
  isReadOnly: boolean;
  uploadingKeyLandmarkImageIndex: number | null;
  onImageUpload: (landmarkIndex: number, files: FileList | null) => void;
  onRemoveImage: (index: number) => void;
  onUpdate: <K extends keyof DestinationFormState>(
    field: K,
    value: DestinationFormState[K]
  ) => void;
}) {
  const landmarkRows = getLandmarkRows(form);

  function updateLandmarkName(indexToUpdate: number, nextName: string) {
    const nextNames = landmarkRows.map((row) => row.name);

    nextNames[indexToUpdate] = nextName;
    onUpdate("keyLandmarks", serializeFormLineList(nextNames));
  }

  function addLandmarkRow() {
    onUpdate(
      "keyLandmarks",
      serializeFormLineList([...landmarkRows.map((row) => row.name), ""])
    );
    onUpdate(
      "keyLandmarkImages",
      serializeFormLineList([...landmarkRows.map((row) => row.image), ""])
    );
  }

  function removeLandmarkRow(indexToRemove: number) {
    const nextNames = landmarkRows.map((row) => row.name);
    const nextImages = landmarkRows.map((row) => row.image);

    nextNames.splice(indexToRemove, 1);
    nextImages.splice(indexToRemove, 1);

    onUpdate("keyLandmarks", serializeFormLineList(nextNames));
    onUpdate("keyLandmarkImages", serializeFormLineList(nextImages));
  }

  return (
    <div className="grid gap-3">
      {landmarkRows.map((row, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-sm border border-border bg-muted/25 p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-foreground/60">
              Landmark {index + 1}
            </span>
            {!isReadOnly ? (
              <button
                type="button"
                onClick={() => removeLandmarkRow(index)}
                disabled={isBusy}
                className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-border bg-white px-2 text-[11px] font-bold text-foreground/60 transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
                Remove
              </button>
            ) : null}
          </div>

          <input
            readOnly={isReadOnly}
            value={row.name}
            onChange={(event) => updateLandmarkName(index, event.target.value)}
            className={inputClassName}
            placeholder="Amber Fort"
          />

          {!isReadOnly ? (
            <UploadField
              accept="image/*"
              disabled={isBusy}
              isUploading={uploadingKeyLandmarkImageIndex === index}
              label={row.image.trim() ? "Replace landmark image" : "Upload landmark image"}
              onFilesSelected={(files) => onImageUpload(index, files)}
            />
          ) : null}

          <SingleLandmarkImagePreview
            image={row.image}
            index={index}
            onRemove={
              !isReadOnly && row.image.trim()
                ? () => onRemoveImage(index)
                : undefined
            }
          />
        </div>
      ))}

      {!isReadOnly ? (
        <button
          type="button"
          onClick={addLandmarkRow}
          disabled={isBusy}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-primary/30 bg-white px-3 text-sm font-bold text-primary transition-colors hover:border-primary hover:bg-primary/5 disabled:pointer-events-none disabled:opacity-50"
        >
          <Plus className="size-4" />
          Add landmark
        </button>
      ) : null}
    </div>
  );
}

function SingleLandmarkImagePreview({
  image,
  index,
  onRemove,
}: {
  image: string;
  index: number;
  onRemove?: () => void;
}) {
  const trimmedImage = image.trim();

  if (!trimmedImage) {
    return (
      <div className="grid h-24 place-items-center rounded-sm border border-dashed border-border bg-white text-xs font-medium text-foreground/45">
        Preview will appear here
      </div>
    );
  }

  return (
    <div className="relative h-24 overflow-hidden rounded-sm border border-border bg-muted">
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1.5 top-1.5 z-10 grid size-6 place-items-center rounded-sm border border-white/70 bg-white/95 text-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
          aria-label={`Remove landmark image ${index + 1}`}
        >
          <X className="size-3.5" />
        </button>
      ) : null}
      <div
        className="h-full w-full bg-cover bg-center"
        role="img"
        aria-label={`Destination landmark preview ${index + 1}`}
        style={{
          backgroundImage: `url("${getDestinationMediaUrl(trimmedImage)}")`,
        }}
      />
    </div>
  );
}

function ImagePreviewGrid({
  images,
  onRemove,
  variant = "gallery",
}: {
  images: string[];
  onRemove?: (index: number) => void;
  variant?: "banner" | "gallery" | "landmark" | "thumbnail";
}) {
  const isGrid = variant === "gallery" || variant === "landmark";
  const imageLabel =
    variant === "banner"
      ? "banner"
      : variant === "gallery"
        ? "gallery"
      : variant === "landmark"
        ? "landmark"
        : "thumbnail";
  const previewImages = isGrid ? images : images.slice(0, 1);

  if (images.length === 0) {
    return (
      <div
        className={cn(
          "grid place-items-center rounded-sm border border-dashed border-border bg-muted/35 text-xs font-medium text-foreground/45",
          isGrid ? "h-20" : "h-28"
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
        isGrid ? "grid-cols-3" : "grid-cols-1"
      )}
    >
      {previewImages.map((image, index) => (
        <div
          key={`${image}-${index}`}
          className={cn(
            "relative overflow-hidden rounded-sm border border-border bg-muted",
            variant === "banner" ? "h-32" : isGrid ? "h-20" : "h-28"
          )}
        >
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="absolute right-1.5 top-1.5 z-10 grid size-6 place-items-center rounded-sm border border-white/70 bg-white/95 text-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
              aria-label={
                isGrid
                  ? `Remove ${imageLabel} image ${index + 1}`
                  : `Remove ${imageLabel} image`
              }
            >
              <X className="size-3.5" />
            </button>
          ) : null}
          <div
            className="h-full w-full bg-cover bg-center"
            role="img"
            aria-label={
              isGrid
                ? `Destination ${imageLabel} preview ${index + 1}`
                : `Destination ${imageLabel} preview`
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
