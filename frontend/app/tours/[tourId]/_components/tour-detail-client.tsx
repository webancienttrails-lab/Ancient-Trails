"use client";

import { SingleTourPage } from "./single-tour-page";
import type { TourPageData } from "@/lib/travel-page-data";

export function TourDetailClient({ tourId, initialData }: { tourId: string; initialData: TourPageData }) {
  return <SingleTourPage tourId={tourId} initialData={initialData} />;
}
