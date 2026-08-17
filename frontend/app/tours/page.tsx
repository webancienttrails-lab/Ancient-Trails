import type { Metadata } from "next";

import { ToursListingPage } from "./_components/tours-listing-page";

export const metadata: Metadata = {
  title: "Tours",
  description:
    "Browse Ancient Trails heritage tours by destination, duration, price and availability.",
};

type ToursRouteProps = {
  searchParams?: Promise<{
    search?: string;
  }>;
};

export default async function ToursRoute({ searchParams }: ToursRouteProps) {
  const params = await searchParams;
  const initialSearchQuery = params?.search || "";

  return (
    <ToursListingPage
      key={initialSearchQuery}
      initialSearchQuery={initialSearchQuery}
    />
  );
}
