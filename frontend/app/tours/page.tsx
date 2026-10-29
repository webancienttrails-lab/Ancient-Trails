import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getTravelCatalogue } from "@/lib/server-travel";

import { ToursListingPage } from "./_components/tours-listing-page";

export const metadata: Metadata = pageMetadata({
  path: "/tours",
  title: "Tours",
  description:
    "Browse Ancient Trails heritage tours by destination, duration, price and availability.",
});

type ToursRouteProps = {
  searchParams?: Promise<{
    adults?: string;
    children?: string;
    destination?: string;
    month?: string;
    search?: string;
  }>;
};

function parseGuestCount(value: string | undefined, fallback: number, minimum: number) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(12, Math.max(minimum, Math.floor(parsedValue)));
}

export default async function ToursRoute({ searchParams }: ToursRouteProps) {
  const [params, initialData] = await Promise.all([searchParams, getTravelCatalogue()]);
  const initialDestinationValue = params?.destination || "";
  const initialSearchQuery = params?.search || "";
  const initialMonthValue = params?.month || "";
  const initialAdultCount = parseGuestCount(params?.adults, 2, 1);
  const initialChildCount = parseGuestCount(params?.children, 0, 0);

  return (
    <ToursListingPage
      initialData={initialData}
      key={`${initialDestinationValue}-${initialSearchQuery}-${initialMonthValue}-${initialAdultCount}-${initialChildCount}`}
      initialAdultCount={initialAdultCount}
      initialChildCount={initialChildCount}
      initialDestinationValue={initialDestinationValue}
      initialMonthValue={initialMonthValue}
      initialSearchQuery={initialSearchQuery}
    />
  );
}
