import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getTravelCatalogue } from "@/lib/server-travel";
import { listPublicMegaMenu } from "@/lib/home-travel";

import { DestinationsPage } from "./_components/destinations-page";

export const metadata: Metadata = pageMetadata({
  path: "/destinations",
  title: "Destinations",
  description:
    "Browse Ancient Trails destinations by country, state, heritage focus and UNESCO status.",
});

type DestinationsRouteProps = {
  searchParams?: Promise<{
    search?: string;
  }>;
};

export default async function DestinationsRoute({
  searchParams,
}: DestinationsRouteProps) {
  const [params, catalogue, megaMenu] = await Promise.all([
    searchParams, getTravelCatalogue(), listPublicMegaMenu().catch(() => null),
  ]);

  const initialSearchQuery = params?.search || "";

  return (
    <DestinationsPage
      initialData={{ ...catalogue, megaMenu: megaMenu?.data.megaMenu ?? null }}
      key={initialSearchQuery}
      initialSearchQuery={initialSearchQuery}
    />
  );
}
