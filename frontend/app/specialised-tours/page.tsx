import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { SpecialisedTourPage } from "./_components/specialised-tour-page";

export const metadata: Metadata = pageMetadata({
  path: "/specialised-tours",
  title: "Specialised Tours",
  description: "Unique heritage journeys for photographers, dancers, artists, bikers, kids, foreigners and NRIs. Explore a tour designed around your passion.",
});

export default function SpecialisedToursPage() {
  return <SpecialisedTourPage />;
}
