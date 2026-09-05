import type { Metadata } from "next";

import { ExpertsPage } from "./_components/experts-page";

export const metadata: Metadata = {
  title: "Experts",
  description:
    "Meet the Ancient Trails experts who lead heritage journeys, cultural storytelling and thoughtful travel experiences.",
};

export default function ExpertsRoute() {
  return <ExpertsPage />;
}
