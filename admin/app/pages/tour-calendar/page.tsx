"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import { AdminDashboardShell } from "@/components/admin-dashboard/admin-dashboard-shell";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  getAdminTourCalendar,
  updateAdminTourCalendar,
  type TourCalendarFestival,
  type TourCalendarPayload,
} from "@/lib/tour-calendar";

type FestivalForm = Omit<TourCalendarFestival, "id">;

const emptyFestivalForm: FestivalForm = {
  title: "",
  date: "",
  description: "",
  sortOrder: 0,
};
const calendarSaveFormId = "tour-calendar-save-form";

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

function formatDateInput(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createFestivalPayload(festivals: TourCalendarFestival[]): TourCalendarPayload {
  return {
    festivals: festivals.map((festival, index) => ({
      title: festival.title.trim(),
      date: formatDateInput(festival.date),
      description: festival.description.trim(),
      sortOrder: index,
    })),
  };
}

function sortFestivals(festivals: TourCalendarFestival[]) {
  return [...festivals].sort((left, right) => {
    const dateDifference =
      new Date(left.date).getTime() - new Date(right.date).getTime();

    return dateDifference || left.title.localeCompare(right.title);
  });
}

export default function TourCalendarEditorPage() {
  const toast = useToast();
  const [festivals, setFestivals] = useState<TourCalendarFestival[]>([]);
  const [festivalForm, setFestivalForm] =
    useState<FestivalForm>(emptyFestivalForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadTourCalendar() {
      try {
        const response = await getAdminTourCalendar();

        if (!isMounted) {
          return;
        }

        setFestivals(
          response.data.tourCalendar.festivals.map((festival) => ({
            ...festival,
            date: formatDateInput(festival.date),
          }))
        );
      } catch (error) {
        toast.error("Unable to load tour calendar", getErrorMessage(error));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTourCalendar();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  const sortedFestivals = useMemo(() => sortFestivals(festivals), [festivals]);

  function updateFestivalForm(field: keyof FestivalForm, value: string) {
    setFestivalForm((current) => ({
      ...current,
      [field]: field === "sortOrder" ? Number(value) || 0 : value,
    }));
  }

  function addFestival(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!festivalForm.title.trim() || !festivalForm.date) {
      toast.error("Festival details required", "Add a festival name and date.");
      return;
    }

    setFestivals((current) =>
      sortFestivals([
        ...current,
        {
          id: `festival-${Date.now()}`,
          title: festivalForm.title.trim(),
          date: festivalForm.date,
          description: festivalForm.description.trim(),
          sortOrder: current.length,
        },
      ])
    );
    setFestivalForm(emptyFestivalForm);
  }

  function removeFestival(festivalId: string) {
    setFestivals((current) =>
      current.filter((festival) => festival.id !== festivalId)
    );
  }

  function updateFestival(
    festivalId: string,
    field: keyof FestivalForm,
    value: string
  ) {
    setFestivals((current) =>
      current.map((festival) =>
        festival.id === festivalId
          ? {
              ...festival,
              [field]: field === "sortOrder" ? Number(value) || 0 : value,
            }
          : festival
      )
    );
  }

  function handleSaveFestivals(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveFestivals();
  }

  async function saveFestivals() {
    if (isSaving || isLoading) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await updateAdminTourCalendar(
        createFestivalPayload(sortedFestivals)
      );

      setFestivals(
        response.data.tourCalendar.festivals.map((festival) => ({
          ...festival,
          date: formatDateInput(festival.date),
        }))
      );
      toast.success("Tour calendar saved", response.message);
    } catch (error) {
      toast.error("Unable to save tour calendar", getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminDashboardShell activeLabel="Pages">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
        <form
          id={calendarSaveFormId}
          onSubmit={handleSaveFestivals}
          className="contents"
        >
          <header className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link
              href="/pages"
              className="inline-flex items-center gap-2 text-xs font-bold text-primary transition-colors hover:text-accent"
            >
              <ArrowLeft className="size-4" />
              Back to Pages
            </Link>
            <h1 className="mt-3 font-sans text-2xl font-bold tracking-normal text-foreground">
              Tour Calendar
            </h1>
            <p className="mt-1 text-sm text-foreground/60">
              Add festival dates that appear on the public tour calendar.
            </p>
          </div>

          <Button
            type="submit"
            disabled={isSaving || isLoading}
            className="h-11 rounded-sm px-4 text-xs font-bold"
          >
            <Save className="size-4" data-icon="inline-start" />
            {isSaving ? "Saving..." : "Save Festivals"}
          </Button>
          </header>
        </form>

        <section className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
          <form
            onSubmit={addFestival}
            data-admin-ignore-save-reminder="true"
            className="rounded-sm border border-border bg-white p-4 shadow-sm shadow-stone-200/40"
          >
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-sm bg-primary/10 text-primary">
                <CalendarDays className="size-4" />
              </span>
              <h2 className="text-sm font-bold text-foreground">
                Add Festival
              </h2>
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-bold text-foreground/60">
                Festival Name *
              </span>
              <input
                required
                value={festivalForm.title}
                onChange={(event) =>
                  updateFestivalForm("title", event.target.value)
                }
                className="mt-1 h-11 w-full rounded-sm border border-border bg-white px-3 text-sm font-semibold outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                placeholder="Diwali"
                type="text"
              />
            </label>

            <label className="mt-3 block">
              <span className="text-xs font-bold text-foreground/60">
                Festival Date *
              </span>
              <input
                required
                value={festivalForm.date}
                onChange={(event) =>
                  updateFestivalForm("date", event.target.value)
                }
                className="mt-1 h-11 w-full rounded-sm border border-border bg-white px-3 text-sm font-semibold outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                type="date"
              />
            </label>

            <label className="mt-3 block">
              <span className="text-xs font-bold text-foreground/60">
                Description
              </span>
              <textarea
                value={festivalForm.description}
                onChange={(event) =>
                  updateFestivalForm("description", event.target.value)
                }
                className="mt-1 min-h-24 w-full rounded-sm border border-border bg-white px-3 py-2 text-sm font-semibold outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                placeholder="Short note for the calendar list"
              />
            </label>

            <Button
              type="submit"
              disabled={isLoading}
              className="mt-4 h-11 w-full rounded-sm text-xs font-bold"
            >
              <Plus className="size-4" data-icon="inline-start" />
              Add Festival
            </Button>
          </form>

          <section className="overflow-hidden rounded-sm border border-border bg-white shadow-sm shadow-stone-200/40">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-bold text-foreground">
                Festival Dates
              </h2>
              <p className="mt-1 text-xs text-foreground/55">
                These dates are highlighted in accent color on the public calendar.
              </p>
            </div>

            {isLoading ? (
              <p className="px-4 py-8 text-center text-sm font-semibold text-foreground/55">
                Loading festivals...
              </p>
            ) : sortedFestivals.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm font-semibold text-foreground/55">
                No festival dates added yet.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {sortedFestivals.map((festival) => (
                  <article
                    key={festival.id}
                    className="grid gap-3 px-4 py-3 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-center"
                  >
                    <input
                      value={festival.date}
                      onChange={(event) =>
                        updateFestival(festival.id, "date", event.target.value)
                      }
                      className="h-10 w-full rounded-sm border border-border bg-white px-3 text-sm font-bold text-accent outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                      aria-label={`Festival date for ${festival.title}`}
                      type="date"
                    />
                    <span className="min-w-0">
                      <input
                        value={festival.title}
                        onChange={(event) =>
                          updateFestival(festival.id, "title", event.target.value)
                        }
                        className="h-10 w-full rounded-sm border border-border bg-white px-3 text-sm font-bold text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                        aria-label={`Festival name for ${festival.title}`}
                        type="text"
                      />
                      <textarea
                        value={festival.description}
                        onChange={(event) =>
                          updateFestival(
                            festival.id,
                            "description",
                            event.target.value
                          )
                        }
                        className="mt-2 min-h-20 w-full rounded-sm border border-border bg-white px-3 py-2 text-xs font-medium leading-relaxed text-foreground/58 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                        aria-label={`Festival description for ${festival.title}`}
                        placeholder="Short note for the calendar list"
                      />
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFestival(festival.id)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-sm border border-border px-3 text-xs font-bold text-destructive transition-colors hover:border-destructive/30 hover:bg-destructive/5"
                    >
                      <Trash2 className="size-4" />
                      Remove
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
    </AdminDashboardShell>
  );
}
