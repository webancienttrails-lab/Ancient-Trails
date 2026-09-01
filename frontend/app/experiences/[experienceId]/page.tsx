import type { Metadata } from "next";

import { SingleExperiencePage } from "../_components/experiences-page";

type ExperienceDetailRouteProps = {
  params: Promise<{
    experienceId: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: ExperienceDetailRouteProps): Promise<Metadata> {
  const { experienceId } = await params;
  const readableId = decodeURIComponent(experienceId).replace(/[-_]+/g, " ");

  return {
    title: readableId || "Traveller Experience",
    description:
      "Read traveller stories, ratings, photos and moments from Ancient Trails journeys.",
  };
}

export default async function ExperienceDetailRoute({
  params,
}: ExperienceDetailRouteProps) {
  const { experienceId } = await params;

  return <SingleExperiencePage experienceId={experienceId} />;
}
