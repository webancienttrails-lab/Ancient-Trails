import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

import { ExpertsPage } from "./_components/experts-page";

export const metadata: Metadata = pageMetadata({
  path: "/experts",
  title: "Experts",
  description:
    "Meet the Ancient Trails experts who lead heritage journeys, cultural storytelling and thoughtful travel experiences.",
});

export default function ExpertsRoute() {
  return <ExpertsPage />;
}
