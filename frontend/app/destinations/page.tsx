import type { Metadata } from "next";

import { DestinationsPage } from "./_components/destinations-page";

export const metadata: Metadata = {
  title: "Destinations",
  description:
    "Browse Ancient Trails destinations by country, state, heritage focus and UNESCO status.",
};

export default function DestinationsRoute() {
  return <DestinationsPage />;
}
