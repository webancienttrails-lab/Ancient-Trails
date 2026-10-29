import { ApiError } from "./api";
import {
  getPublicExperience, listPublicExperiences, listPublicTours,
  type PublicExperience, type PublicTour,
} from "./home-travel";
import { matchesRouteValue } from "./routes";

export type ExperiencePageData = {
  tour: PublicTour | null;
  experiences: PublicExperience[];
};

export async function loadExperiencePage(reference: string): Promise<ExperiencePageData | null> {
  let selected: PublicExperience | null = null;
  try {
    selected = (await getPublicExperience(reference)).data.experience;
  } catch (error) {
    if (!(error instanceof ApiError) || error.statusCode !== 404) throw error;
  }
  const tours = (await listPublicTours()).data.tours;
  if (selected) {
    const tour = tours.find(item => item.tourId.toUpperCase() === selected!.tourId.toUpperCase()) || null;
    const related = selected.tourId ? (await listPublicExperiences(selected.tourId)).data.experiences : [];
    return { tour, experiences: [selected, ...related.filter(item => item.id !== selected!.id)] };
  }

  // Keep existing tour URLs and previously shared title URLs working.
  const tour = tours.find(item => matchesRouteValue(reference, item.tourId, item.tourName)) || null;
  const experiences = (await listPublicExperiences(tour?.tourId || "")).data.experiences;
  if (tour) return { tour, experiences };
  const legacy = experiences.find(item => matchesRouteValue(reference, item.experienceId, item.title || item.tourName));
  if (!legacy) return null;
  return {
    tour: tours.find(item => item.tourId.toUpperCase() === legacy.tourId.toUpperCase()) || null,
    experiences: [legacy, ...experiences.filter(item => item.tourId === legacy.tourId && item.id !== legacy.id)],
  };
}
