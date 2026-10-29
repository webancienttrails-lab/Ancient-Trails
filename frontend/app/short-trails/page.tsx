import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getTravelCatalogue } from "@/lib/server-travel";

import { ToursListingPage } from "../tours/_components/tours-listing-page";

export const metadata: Metadata = pageMetadata({
  path: "/short-trails",
  title: "Short Trails",
  description:
    "Explore Ancient Trails short tours through heritage, culture and local stories.",
});

export default async function ShortTrailsPage() {
  return <ToursListingPage initialData={await getTravelCatalogue()} initialTourFormat="Short Trails" />;
}
