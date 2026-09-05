"use client";

/* eslint-disable @next/next/no-img-element */

import { type FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  LayoutList,
  MapPin,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";

import { AdminDashboardShell } from "@/components/admin-dashboard/admin-dashboard-shell";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  getDestinationMediaUrl,
  listAdminDestinations,
  uploadDestinationImages,
  type AdminDestination,
} from "@/lib/destinations";
import {
  getAdminMegaMenu,
  updateAdminMegaMenu,
  type MegaMenuContent,
  type MegaMenuPayload,
} from "@/lib/mega-menu";
import {
  getTourMediaUrl,
  listAdminTours,
  type AdminTour,
} from "@/lib/tours";
import { cn } from "@/lib/utils";

type FormState = MegaMenuPayload;
type SelectionKey =
  | "destinationIndia"
  | "destinationInternational"
  | "destinationTopCities"
  | "tourHeritage"
  | "tourShortTrails";
type RegionCollectionKey =
  | "destinationIndiaRegions"
  | "destinationInternationalRegions";

type MenuOption = {
  description: string;
  image: string;
  label: string;
  referenceId: string;
};

const emptyForm: FormState = {
  destinationIndia: [],
  destinationIndiaRegions: [],
  destinationInternational: [],
  destinationInternationalRegions: [],
  destinationTopCities: [],
  tourHeritage: [],
  tourShortTrails: [],
};

const TOUR_MENU_SECTION_LIMIT = 4;

const indianRegionOptions = [
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

function createReference(referenceId: string, sortOrder: number) {
  return {
    referenceId,
    sortOrder,
  };
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function createRegion(sortOrder: number, title = "New Region") {
  return {
    description: "",
    href: "",
    image: "",
    sortOrder,
    title,
  };
}

function getRegionDestinationNames(
  destinations: AdminDestination[],
  regionTitle: string,
  destinationType: AdminDestination["destinationType"]
) {
  const regionKey = normalizeKey(regionTitle);

  if (!regionKey) {
    return [];
  }

  const names = destinations
    .filter(
      (destination) =>
        destination.destinationType === destinationType &&
        normalizeKey(destination.region || "") === regionKey
    )
    .map((destination) => destination.destinationName.trim())
    .filter(Boolean);

  return Array.from(new Set(names));
}

function getRegionDescription(
  destinations: AdminDestination[],
  regionTitle: string,
  destinationType: AdminDestination["destinationType"]
) {
  return getRegionDestinationNames(
    destinations,
    regionTitle,
    destinationType
  ).reduce((description, destinationName) => {
    const nextDescription = description
      ? `${description}, ${destinationName}`
      : destinationName;

    return nextDescription.length <= 180 ? nextDescription : description;
  }, "");
}

function getIndianRegionDescription(
  destinations: AdminDestination[],
  regionTitle: string
) {
  return getRegionDescription(destinations, regionTitle, "Domestic");
}

function getInternationalRegionDescription(
  destinations: AdminDestination[],
  regionTitle: string
) {
  return getRegionDescription(destinations, regionTitle, "International");
}

function createFormState(content: MegaMenuContent): FormState {
  const tourHeritage = content.tourMenu.heritageTours.slice(
    0,
    TOUR_MENU_SECTION_LIMIT
  );
  const tourShortTrails = content.tourMenu.shortTrails.slice(
    0,
    TOUR_MENU_SECTION_LIMIT
  );

  return {
    destinationIndia: [],
    destinationIndiaRegions: (content.destinationIndiaRegions || []).map((item, index) => ({
      description: item.description,
      href: item.href,
      image: item.image,
      sortOrder: index,
      title: item.title,
    })),
    destinationInternational: [],
    destinationInternationalRegions: (content.destinationInternationalRegions || []).map(
      (item, index) => ({
        description: item.description,
        href: item.href,
        image: item.image,
        sortOrder: index,
        title: item.title,
      })
    ),
    destinationTopCities: content.destinationMenu.topCities.map((item, index) =>
      createReference(item.referenceId, index)
    ),
    tourHeritage: tourHeritage.map((item, index) =>
      createReference(item.referenceId, index)
    ),
    tourShortTrails: tourShortTrails.map((item, index) =>
      createReference(item.referenceId, index)
    ),
  };
}

function createPayload(
  form: FormState,
  destinations: AdminDestination[]
): MegaMenuPayload {
  return {
    destinationIndia: form.destinationIndia.map((item, index) => ({
      ...item,
      sortOrder: index,
    })),
    destinationIndiaRegions: form.destinationIndiaRegions.map((item, index) => ({
      ...item,
      description: getIndianRegionDescription(destinations, item.title),
      href: "",
      sortOrder: index,
    })),
    destinationInternational: form.destinationInternational.map((item, index) => ({
      ...item,
      sortOrder: index,
    })),
    destinationInternationalRegions: form.destinationInternationalRegions.map(
      (item, index) => ({
        ...item,
        description: getInternationalRegionDescription(destinations, item.title),
        href: "",
        sortOrder: index,
      })
    ),
    destinationTopCities: form.destinationTopCities.map((item, index) => ({
      ...item,
      sortOrder: index,
    })),
    tourHeritage: form.tourHeritage.map((item, index) => ({
      ...item,
      sortOrder: index,
    })),
    tourShortTrails: form.tourShortTrails.map((item, index) => ({
      ...item,
      sortOrder: index,
    })),
  };
}

function getTourOptionImage(tour: AdminTour) {
  return getTourMediaUrl(
    tour.thumbnailImage || tour.bannerImage || tour.galleryImages[0] || ""
  );
}

function getDestinationOptionImage(destination: AdminDestination) {
  return getDestinationMediaUrl(
    destination.thumbnailImage ||
      destination.bannerImage ||
      destination.galleryImages[0] ||
      ""
  );
}

export default function PagesMegaMenuPage() {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [tours, setTours] = useState<AdminTour[]>([]);
  const [destinations, setDestinations] = useState<AdminDestination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingRegionImage, setUploadingRegionImage] = useState<{
    index: number;
    key: RegionCollectionKey;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadMegaMenuEditor() {
      try {
        const [megaMenuResponse, toursResponse, destinationsResponse] =
          await Promise.all([
            getAdminMegaMenu(),
            listAdminTours(),
            listAdminDestinations(),
          ]);

        if (!isMounted) {
          return;
        }

        setForm(createFormState(megaMenuResponse.data.megaMenu));
        setTours(toursResponse.data.tours);
        setDestinations(destinationsResponse.data.destinations);
      } catch (error) {
        toast.error("Unable to load mega menu", getErrorMessage(error));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadMegaMenuEditor();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  const tourOptions = useMemo<MenuOption[]>(
    () =>
      tours.map((tour) => ({
        description: [tour.category, tour.durationDn].filter(Boolean).join(" · "),
        image: getTourOptionImage(tour),
        label: tour.tourName,
        referenceId: tour.tourId,
      })),
    [tours]
  );
  const destinationOptions = useMemo<MenuOption[]>(
    () =>
      destinations.map((destination) => ({
        description: [
          destination.city,
          destination.state,
          destination.countryRegion,
        ]
          .filter(Boolean)
          .join(", "),
        image: getDestinationOptionImage(destination),
        label: destination.destinationName,
        referenceId: destination.destinationId,
      })),
    [destinations]
  );

  const metrics = useMemo(
    () => [
      {
        detail: "Tour links in the Tours dropdown",
        icon: LayoutList,
        label: "Tour Menu",
        value: `${
          form.tourHeritage.length + form.tourShortTrails.length
        }/${TOUR_MENU_SECTION_LIMIT * 2}`,
      },
      {
        detail: "Destination links in the Destinations dropdown",
        icon: MapPin,
        label: "Destination Menu",
        value: `${
          form.destinationIndiaRegions.length +
          form.destinationInternationalRegions.length +
          form.destinationTopCities.length
        }/18`,
      },
    ],
    [
      form.destinationIndiaRegions.length,
      form.destinationInternationalRegions.length,
      form.destinationTopCities.length,
      form.tourHeritage.length,
      form.tourShortTrails.length,
    ]
  );

  function addSelection(key: SelectionKey, options: MenuOption[], limit: number) {
    const selectedIds = new Set(form[key].map((item) => item.referenceId));
    const nextOption = options.find(
      (option) => !selectedIds.has(option.referenceId)
    );

    if (form[key].length >= limit) {
      toast.error("Limit reached", `This mega menu section can show up to ${limit} items.`);
      return;
    }

    if (!nextOption) {
      toast.error("No item available", "Please add more records before selecting them.");
      return;
    }

    setForm((currentForm) => ({
      ...currentForm,
      [key]: [
        ...currentForm[key],
        createReference(nextOption.referenceId, currentForm[key].length),
      ],
    }));
  }

  function addTourSelection(key: "tourHeritage" | "tourShortTrails") {
    addSelection(key, tourOptions, TOUR_MENU_SECTION_LIMIT);
  }

  function updateSelection(key: SelectionKey, index: number, referenceId: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: currentForm[key].map((item, itemIndex) =>
        itemIndex === index ? { ...item, referenceId } : item
      ),
    }));
  }

  function removeSelection(key: SelectionKey, index: number) {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: currentForm[key].filter((_item, itemIndex) => itemIndex !== index),
    }));
  }

  const isBusy = isSaving || Boolean(uploadingRegionImage);
  function addRegion(key: RegionCollectionKey, limit: number) {
    if (form[key].length >= limit) {
      toast.error("Limit reached", `This mega menu section can show up to ${limit} regions.`);
      return;
    }

    const regionOptions =
      key === "destinationIndiaRegions"
        ? indianRegionOptions
        : internationalRegionOptions;
    const selectedRegionTitles = new Set(
      form[key].map((region) => normalizeKey(region.title))
    );
    const nextRegionTitle =
      regionOptions.find(
        (regionTitle) => !selectedRegionTitles.has(normalizeKey(regionTitle))
      ) || regionOptions[0];

    setForm((currentForm) => ({
      ...currentForm,
      [key]: [
        ...currentForm[key],
        createRegion(
          currentForm[key].length,
          nextRegionTitle
        ),
      ],
    }));
  }

  function updateRegion(
    key: RegionCollectionKey,
    index: number,
    field: RegionTextField,
    value: string
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: currentForm[key].map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function removeRegion(key: RegionCollectionKey, index: number) {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: currentForm[key].filter((_item, itemIndex) => itemIndex !== index),
    }));
  }

  async function uploadRegionImage(
    key: RegionCollectionKey,
    index: number,
    files: FileList | null
  ) {
    const [regionImage] = Array.from(files || []);

    if (!regionImage) {
      return;
    }

    setUploadingRegionImage({ key, index });

    try {
      const response = await uploadDestinationImages({
        thumbnailImage: regionImage,
      });

      updateRegion(key, index, "image", response.data.thumbnailImage);
      toast.success("Region image uploaded", response.message);
    } catch (error) {
      toast.error("Region image upload failed", getErrorMessage(error));
    } finally {
      setUploadingRegionImage(null);
    }
  }

  function removeRegionImage(key: RegionCollectionKey, index: number) {
    updateRegion(key, index, "image", "");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (uploadingRegionImage) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await updateAdminMegaMenu(
        createPayload(form, destinations)
      );

      setForm(createFormState(response.data.megaMenu));
      toast.success("Mega menu saved", response.message);
    } catch (error) {
      toast.error("Mega menu not saved", getErrorMessage(error));
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
        <Link
          href="/pages"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-foreground/65 transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          Back to Pages
        </Link>
        <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-sm text-foreground/60">
            Choose the tour and destination records shown in the public header mega menus.
          </p>
          <Button
            type="submit"
            disabled={isLoading || isBusy}
            className="h-11 rounded-sm px-4 text-xs font-bold lg:hidden"
          >
            <Save className="size-4" data-icon="inline-start" />
            {isSaving ? "Saving..." : "Save Mega Menu"}
          </Button>
        </section>

        <section data-admin-metric-grid className="grid gap-3 sm:grid-cols-2">
          {metrics.map((metric) => (
            <OverviewMetric key={metric.label} metric={metric} />
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <EditorPanel title="Tours Mega Menu">
            <SelectionPanel
              isLoading={isLoading}
              limit={TOUR_MENU_SECTION_LIMIT}
              onAdd={() => addTourSelection("tourHeritage")}
              onRemove={(index) => removeSelection("tourHeritage", index)}
              onUpdate={(index, referenceId) =>
                updateSelection("tourHeritage", index, referenceId)
              }
              options={tourOptions}
              selections={form.tourHeritage}
              title="Heritage Tours"
            />
            <SelectionPanel
              isLoading={isLoading}
              limit={TOUR_MENU_SECTION_LIMIT}
              onAdd={() => addTourSelection("tourShortTrails")}
              onRemove={(index) => removeSelection("tourShortTrails", index)}
              onUpdate={(index, referenceId) =>
                updateSelection("tourShortTrails", index, referenceId)
              }
              options={tourOptions}
              selections={form.tourShortTrails}
              title="Short Trails"
            />
          </EditorPanel>

          <EditorPanel title="Destinations Mega Menu">
            <RegionPanel
              isLoading={isLoading}
              limit={5}
              onAdd={() => addRegion("destinationIndiaRegions", 5)}
              onRemove={(index) => removeRegion("destinationIndiaRegions", index)}
              onUpdate={(index, field, value) =>
                updateRegion("destinationIndiaRegions", index, field, value)
              }
              destinations={destinations}
              isImageUploading={(index) =>
                uploadingRegionImage?.key === "destinationIndiaRegions" &&
                uploadingRegionImage.index === index
              }
              isIndia
              onImageRemove={(index) =>
                removeRegionImage("destinationIndiaRegions", index)
              }
              onImageUpload={(index, files) =>
                uploadRegionImage("destinationIndiaRegions", index, files)
              }
              regions={form.destinationIndiaRegions}
              title="India"
            />
            <RegionPanel
              isLoading={isLoading}
              limit={5}
              onAdd={() =>
                addRegion("destinationInternationalRegions", 5)
              }
              onRemove={(index) =>
                removeRegion("destinationInternationalRegions", index)
              }
              onUpdate={(index, field, value) =>
                updateRegion(
                  "destinationInternationalRegions",
                  index,
                  field,
                  value
                )
              }
              isImageUploading={(index) =>
                uploadingRegionImage?.key ===
                  "destinationInternationalRegions" &&
                uploadingRegionImage.index === index
              }
              onImageRemove={(index) =>
                removeRegionImage("destinationInternationalRegions", index)
              }
              onImageUpload={(index, files) =>
                uploadRegionImage("destinationInternationalRegions", index, files)
              }
              destinations={destinations}
              regions={form.destinationInternationalRegions}
              title="International"
            />
            <SelectionPanel
              isLoading={isLoading}
              limit={8}
              onAdd={() =>
                addSelection("destinationTopCities", destinationOptions, 8)
              }
              onRemove={(index) => removeSelection("destinationTopCities", index)}
              onUpdate={(index, referenceId) =>
                updateSelection("destinationTopCities", index, referenceId)
              }
              options={destinationOptions}
              selections={form.destinationTopCities}
              title="Top Cities"
            />
          </EditorPanel>
        </section>
      </form>
    </AdminDashboardShell>
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

function EditorPanel({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-sans text-base font-bold text-foreground">{title}</h2>
      </div>
      <div className="grid gap-5 p-4">{children}</div>
    </section>
  );
}

function SelectionPanel({
  addDisabled = false,
  isLoading,
  limit,
  onAdd,
  onRemove,
  onUpdate,
  options,
  selections,
  title,
}: {
  addDisabled?: boolean;
  isLoading: boolean;
  limit: number;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, referenceId: string) => void;
  options: MenuOption[];
  selections: Array<{ referenceId: string; sortOrder: number }>;
  title: string;
}) {
  const selectedIds = new Set(selections.map((selection) => selection.referenceId));

  return (
    <section className="rounded-sm border border-border bg-[#fffaf7]">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-3">
        <div>
          <h3 className="font-sans text-sm font-bold text-foreground">{title}</h3>
          <p className="mt-1 text-[11px] font-semibold text-foreground/50">
            {selections.length} of {limit} selected
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onAdd}
          disabled={isLoading || addDisabled || selections.length >= limit}
          className="h-9 rounded-sm px-3 text-xs font-bold"
        >
          <Plus className="size-4" data-icon="inline-start" />
          Add
        </Button>
      </div>

      <div className="grid gap-3 p-3">
        {isLoading ? (
          <EmptyState label="Loading menu records..." />
        ) : selections.length > 0 ? (
          selections.map((selection, index) => {
            const selectedOption = options.find(
              (option) => option.referenceId === selection.referenceId
            );

            return (
              <article
                key={`${selection.referenceId}-${index}`}
                className="grid gap-3 rounded-sm border border-border bg-white p-3 sm:grid-cols-[76px_minmax(0,1fr)_44px]"
              >
                <div className="relative h-[58px] overflow-hidden rounded-sm border border-border bg-muted">
                  {selectedOption?.image ? (
                    <img
                      src={selectedOption.image}
                      alt={selectedOption.label}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="grid size-full place-items-center text-foreground/30">
                      <LayoutList className="size-6" />
                    </span>
                  )}
                </div>

                <label className="grid min-w-0 gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-normal text-foreground/55">
                    Menu item {index + 1}
                  </span>
                  <select
                    required
                    value={selection.referenceId}
                    onChange={(event) => onUpdate(index, event.target.value)}
                    className={inputClassName}
                  >
                    {options.map((option) => (
                      <option
                        key={option.referenceId}
                        value={option.referenceId}
                        disabled={
                          selectedIds.has(option.referenceId) &&
                          option.referenceId !== selection.referenceId
                        }
                      >
                        {option.label} ({option.referenceId})
                      </option>
                    ))}
                  </select>
                  <span className="truncate text-[11px] font-semibold text-foreground/50">
                    {selectedOption?.description || selection.referenceId}
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="grid size-11 place-items-center rounded-sm border border-border bg-white text-foreground/55 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove ${title} menu item ${index + 1}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </article>
            );
          })
        ) : (
          <EmptyState label={`No ${title.toLowerCase()} selected.`} />
        )}
      </div>
    </section>
  );
}

type RegionFormItem = FormState["destinationIndiaRegions"][number];
type RegionTextField = "description" | "href" | "image" | "title";

function RegionPanel({
  destinations = [],
  isImageUploading,
  isIndia = false,
  isLoading,
  limit,
  onAdd,
  onImageRemove,
  onImageUpload,
  onRemove,
  onUpdate,
  regions,
  title,
}: {
  destinations?: AdminDestination[];
  isImageUploading?: (index: number) => boolean;
  isIndia?: boolean;
  isLoading: boolean;
  limit: number;
  onAdd: () => void;
  onImageRemove?: (index: number) => void;
  onImageUpload?: (index: number, files: FileList | null) => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: RegionTextField, value: string) => void;
  regions: RegionFormItem[];
  title: string;
}) {
  const regionOptions = isIndia ? indianRegionOptions : internationalRegionOptions;
  const regionDestinationType: AdminDestination["destinationType"] = isIndia
    ? "Domestic"
    : "International";
  const selectedRegionTitles = new Set(
    regions.map((region) => normalizeKey(region.title)).filter(Boolean)
  );

  return (
    <section className="rounded-sm border border-border bg-[#fffaf7]">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-3">
        <div>
          <h3 className="font-sans text-sm font-bold text-foreground">{title}</h3>
          <p className="mt-1 text-[11px] font-semibold text-foreground/50">
            {regions.length} of {limit} selected
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onAdd}
          disabled={isLoading || regions.length >= limit}
          className="h-9 rounded-sm px-3 text-xs font-bold"
        >
          <Plus className="size-4" data-icon="inline-start" />
          Add
        </Button>
      </div>

      <div className="grid gap-3 p-3">
        {isLoading ? (
          <EmptyState label="Loading menu regions..." />
        ) : regions.length > 0 ? (
          regions.map((region, index) => {
            const currentTitleKey = normalizeKey(region.title);
            const regionSelectOptions =
              region.title &&
              !regionOptions.some(
                (regionOption) =>
                  normalizeKey(regionOption) === currentTitleKey
              )
                ? [region.title, ...regionOptions]
                : regionOptions;
            const generatedDescription = getRegionDescription(
              destinations,
              region.title,
              regionDestinationType
            );
            const imageIsUploading = Boolean(isImageUploading?.(index));

            return (
              <article
                key={`${region.title}-${index}`}
                className="grid gap-3 rounded-sm border border-border bg-white p-3 lg:grid-cols-[104px_minmax(0,1fr)_44px]"
              >
                <div className="relative h-[90px] overflow-hidden rounded-sm border border-border bg-muted">
                  {region.image ? (
                    <>
                      {onImageRemove ? (
                        <button
                          type="button"
                          onClick={() => onImageRemove(index)}
                          className="absolute right-1.5 top-1.5 z-10 grid size-6 place-items-center rounded-sm border border-white/70 bg-white/95 text-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
                          aria-label={`Remove ${title} region ${index + 1} image`}
                        >
                          <X className="size-3.5" />
                        </button>
                      ) : null}
                      <img
                        src={getDestinationMediaUrl(region.image)}
                        alt={region.title}
                        className="size-full object-cover"
                      />
                    </>
                  ) : (
                    <span className="grid size-full place-items-center text-foreground/30">
                      <MapPin className="size-7" />
                    </span>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Region Name">
                    <select
                      required
                      value={region.title}
                      onChange={(event) =>
                        onUpdate(index, "title", event.target.value)
                      }
                      className={inputClassName}
                    >
                      <option value="" disabled>
                        Select region
                      </option>
                      {regionSelectOptions.map((regionOption) => {
                        const optionKey = normalizeKey(regionOption);

                        return (
                          <option
                            key={regionOption}
                            value={regionOption}
                            disabled={
                              selectedRegionTitles.has(optionKey) &&
                              optionKey !== currentTitleKey
                            }
                          >
                            {regionOption}
                          </option>
                        );
                      })}
                    </select>
                  </FormField>
                  <FormField label="Image">
                    <RegionImageUploadField
                      disabled={!onImageUpload || imageIsUploading}
                      isUploading={imageIsUploading}
                      onFilesSelected={(files) => onImageUpload?.(index, files)}
                    />
                  </FormField>
                  <FormField label="Description">
                    <input
                      readOnly
                      value={generatedDescription}
                      onChange={(event) =>
                        onUpdate(index, "description", event.target.value)
                      }
                      className={inputClassName}
                      placeholder="No destinations attached to this region"
                    />
                  </FormField>
                </div>

                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="grid size-11 place-items-center rounded-sm border border-border bg-white text-foreground/55 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove ${title} region ${index + 1}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </article>
            );
          })
        ) : (
          <EmptyState label={`No ${title.toLowerCase()} selected.`} />
        )}
      </div>
    </section>
  );
}

function RegionImageUploadField({
  disabled,
  isUploading,
  onFilesSelected,
}: {
  disabled?: boolean;
  isUploading: boolean;
  onFilesSelected: (files: FileList | null) => void;
}) {
  return (
    <label
      className={cn(
        "flex h-10 cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed border-primary/30 bg-primary/5 px-3 text-xs font-bold text-primary transition-colors hover:border-primary hover:bg-primary/10",
        disabled && "pointer-events-none cursor-not-allowed opacity-60"
      )}
    >
      <Upload className="size-4 shrink-0" />
      <span>{isUploading ? "Uploading..." : "Upload image"}</span>
      <input
        accept="image/*"
        className="sr-only"
        disabled={disabled}
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
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-normal text-foreground/55">
        {label}
      </span>
      {children}
    </label>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-sm border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-xs font-semibold text-foreground/55">
      {label}
    </div>
  );
}

const inputClassName =
  "h-10 w-full rounded-sm border border-border bg-white px-3 text-xs font-semibold text-foreground outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15";
