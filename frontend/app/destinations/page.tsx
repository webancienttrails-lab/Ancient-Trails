import type { Metadata } from "next";

import { DestinationsPage } from "./_components/destinations-page";

export const metadata: Metadata = {
  title: "Destinations",
  description:
    "Browse Ancient Trails destinations by country, state, heritage focus and UNESCO status.",
};

type DestinationsRouteProps = {
  searchParams?: Promise<{
    search?: string;
  }>;
};

export default async function DestinationsRoute({
  searchParams,
}: DestinationsRouteProps) {
  const params = await searchParams;

  const initialSearchQuery = params?.search || "";

  return (
    <DestinationsPage
      key={initialSearchQuery}
      initialSearchQuery={initialSearchQuery}
    />
  );
}
