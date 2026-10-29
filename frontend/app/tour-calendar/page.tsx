import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getTravelCatalogue } from "@/lib/server-travel";
import { getTourCalendarPageContent } from "@/lib/home-travel";

import { TourCalendarPage } from "./tour-calendar-page";

export const metadata: Metadata = pageMetadata({
  path: "/tour-calendar",
  title: "Tour Calendar",
  description:
    "Browse Ancient Trails tour departures by month and plan upcoming heritage journeys.",
});

type TourCalendarRouteProps = {
  searchParams?: Promise<{
    destination?: string;
    tour?: string;
  }>;
};

export default async function TourCalendarRoute({
  searchParams,
}: TourCalendarRouteProps) {
  const [params, catalogue, calendar] = await Promise.all([
    searchParams, getTravelCatalogue(), getTourCalendarPageContent().catch(() => null),
  ]);

  return (
    <TourCalendarPage
      initialData={{ ...catalogue, calendar: calendar?.data.tourCalendar ?? null }}
      key={`${params?.destination || ""}:${params?.tour || ""}`}
      initialDestinationQuery={params?.destination || ""}
      initialTourQuery={params?.tour || ""}
    />
  );
}
