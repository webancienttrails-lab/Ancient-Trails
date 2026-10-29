import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { loadExperiencePage } from "@/lib/experience-page";
import { getHomeMediaUrl } from "@/lib/home-travel";
import { getExperienceHref, getTourExperiencesHref, matchesRouteValue } from "@/lib/routes";
import { pageMetadata } from "@/lib/seo";

import { SingleExperiencePage } from "../_components/experiences-page";

type ExperienceDetailRouteProps = {
  params: Promise<{
    experienceId: string;
  }>;
};

export const dynamic = "force-dynamic";
const getExperiencePage = cache(loadExperiencePage);

export async function generateMetadata({
  params,
}: ExperienceDetailRouteProps): Promise<Metadata> {
  const { experienceId } = await params;
  const detail = await getExperiencePage(experienceId);
  if (!detail) notFound();

  const experience = detail.experiences[0];
  const title = experience?.title || detail.tour?.tourName || "Traveller Experience";
  const isTourPage = detail.tour && matchesRouteValue(experienceId, detail.tour.tourId, detail.tour.tourName);
  return pageMetadata({
    title,
    description: `${title}. ${experience?.writtenReview || "Read traveller stories, ratings, photos and moments from this Ancient Trails journey."}`,
    path: isTourPage ? getTourExperiencesHref(detail.tour!) : experience ? getExperienceHref(experience) : `/experiences/${encodeURIComponent(experienceId)}`,
    image: getHomeMediaUrl(experience?.travellerPhotoGallery[0] || experience?.attractionPhotoGallery[0]?.image || detail.tour?.bannerImage || ""),
    imageAlt: title,
  });
}

export default async function ExperienceDetailRoute({
  params,
}: ExperienceDetailRouteProps) {
  const { experienceId } = await params;

  const detail = await getExperiencePage(experienceId);
  if (!detail) notFound();
  return <SingleExperiencePage detail={detail} />;
}
