import type { Metadata } from "next";

import { TourCalendarPage } from "./tour-calendar-page";

export const metadata: Metadata = {
  title: "Tour Calendar",
  description:
    "Browse Ancient Trails tour departures by month and plan upcoming heritage journeys.",
};

type TourCalendarRouteProps = {
  searchParams?: Promise<{
    destination?: string;
    tour?: string;
  }>;
};

export default async function TourCalendarRoute({
  searchParams,
}: TourCalendarRouteProps) {
  const params = await searchParams;

  return (
    <TourCalendarPage
      key={`${params?.destination || ""}:${params?.tour || ""}`}
      initialDestinationQuery={params?.destination || ""}
      initialTourQuery={params?.tour || ""}
    />
  );
}
