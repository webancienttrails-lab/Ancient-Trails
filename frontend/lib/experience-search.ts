import type { PublicDestination, PublicExperience, PublicTour } from "./home-travel";

export function getTourExperienceSearchText(
  tour: PublicTour,
  experiences: PublicExperience[],
  destinations: PublicDestination[]
) {
  const ids = [tour.destinationId, ...(tour.destinationIds || [])].map(id => id.trim().toLowerCase());
  const linked = destinations.filter(destination => ids.includes(destination.destinationId.trim().toLowerCase()));
  return [
    tour.tourId, tour.tourName, tour.tourType, tour.tourFormat, tour.category, tour.description,
    ...(tour.inclusions || []),
    ...linked.flatMap(destination => [destination.destinationName, destination.state, destination.city, destination.countryRegion, destination.region]),
    ...experiences.flatMap(experience => [experience.travellerName, experience.title, experience.writtenReview]),
  ].filter(Boolean).join(" ").toLowerCase();
}
