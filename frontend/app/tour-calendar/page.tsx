import type { Metadata } from "next";

import { TourCalendarPage } from "./tour-calendar-page";

export const metadata: Metadata = {
  title: "Tour Calendar",
  description:
    "Browse Ancient Trails tour departures by month and plan upcoming heritage journeys.",
};

export default function TourCalendarRoute() {
  return <TourCalendarPage />;
}
