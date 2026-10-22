import type { PublicExperience, PublicTour } from "./home-travel";

function uniqueMedia(values: string[]) {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

export function getExperienceGalleryImages(tour: PublicTour, experiences: PublicExperience[]) {
  const uploaded = uniqueMedia(experiences.flatMap(experience => [
    ...(experience.travellerPhotoGallery || []),
    ...(experience.attractionPhotoGallery || []).map(photo => photo.image),
  ]));
  return uploaded.length > 0 ? uploaded : uniqueMedia([
    tour.bannerImage || "", tour.thumbnailImage || "", ...(tour.galleryImages || []),
  ]);
}

export function getExperienceMoments(experiences: PublicExperience[], tourName: string) {
  const seen = new Set<string>();
  return experiences.flatMap(experience => (experience.travellerVideos || []).flatMap((source, index) => {
    const video = source.trim();
    if (!video || seen.has(video)) return [];
    seen.add(video);
    return [{
      video,
      image: experience.travellerPhotoGallery?.find(photo => photo.trim()) || experience.attractionPhotoGallery?.find(photo => photo.image.trim())?.image || "",
      title: experience.travellerVideoTitles?.[index]?.trim() || experience.title || tourName + " moment",
    }];
  }));
}
