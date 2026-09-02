"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Play,
  Quote,
  Star,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { Button, ButtonArrow } from "@/components/ui/button";
import {
  listPublicExperiences,
  type HomeExperienceCard,
  type PublicExperience,
} from "@/lib/home-travel";
import { slugifyRoute } from "@/lib/routes";
import { RevealOnView, TextReveal } from "./reveal-on-view";

const egyptCards: HomeExperienceCard[] = [
  {
    attractionPhotoGallery: [],
    destinationId: "EGYPT",
    destinationName: "Egypt",
    id: "fallback-egypt-1",
    experienceId: "FALLBACK-EGYPT-1",
    title: "Pyramids of Giza Sunrise Experience",
    image: "/home assets/Egypt.webp",
    type: "Video",
    featured: true,
    rating: 4,
    review:
      "Location and quality of hotel in Cairo could be better- felt stranded in Cairo since hotel was a little remote from city (new and old Cairo).",
    travelledMonth: "February",
    travellerName: "Meredith",
    travellerPhotoGallery: [],
    travellerVideos: [],
    travellerVideoTitles: [],
  },
  {
    attractionPhotoGallery: [],
    destinationId: "EGYPT",
    destinationName: "Egypt",
    id: "fallback-egypt-2",
    experienceId: "FALLBACK-EGYPT-2",
    title: "Exploring Luxor Temples",
    image: "/home assets/Egypt/Egypt_2.webp",
    type: "Album",
    rating: 5,
    review: "Exploring Luxor temples felt like walking through living history.",
    travelledMonth: "February",
    travellerName: "Traveller",
    travellerPhotoGallery: [],
    travellerVideos: [],
    travellerVideoTitles: [],
  },
  {
    attractionPhotoGallery: [],
    destinationId: "EGYPT",
    destinationName: "Egypt",
    id: "fallback-egypt-3",
    experienceId: "FALLBACK-EGYPT-3",
    title: "Nile Cruise Moments",
    image: "/home assets/Egypt/Egypt_3.webp",
    type: "Album",
    rating: 5,
    review: "The Nile cruise moments were calm, beautiful and unforgettable.",
    travelledMonth: "February",
    travellerName: "Traveller",
    travellerPhotoGallery: [],
    travellerVideos: [],
    travellerVideoTitles: [],
  },
  {
    attractionPhotoGallery: [],
    destinationId: "EGYPT",
    destinationName: "Egypt",
    id: "fallback-egypt-4",
    experienceId: "FALLBACK-EGYPT-4",
    title: "Egyptian Museum Highlights",
    image: "/home assets/Egypt/Egypt_4.webp",
    type: "Album",
    rating: 5,
    review: "Egyptian Museum highlights brought the whole journey together.",
    travelledMonth: "February",
    travellerName: "Traveller",
    travellerPhotoGallery: [],
    travellerVideos: [],
    travellerVideoTitles: [],
  },
  {
    attractionPhotoGallery: [],
    destinationId: "EGYPT",
    destinationName: "Egypt",
    id: "fallback-egypt-5",
    experienceId: "FALLBACK-EGYPT-5",
    title: "Khan El Khalili Market Vibes",
    image: "/home assets/Egypt/Egypt_5.webp",
    type: "Album",
    rating: 5,
    review: "Khan El Khalili market was full of colour, craft and energy.",
    travelledMonth: "February",
    travellerName: "Traveller",
    travellerPhotoGallery: [],
    travellerVideos: [],
    travellerVideoTitles: [],
  },
];

const egyptThumbnails = [
  "/home assets/Egypt/Egypt_1.webp",
  "/home assets/Egypt/Egypt_6.webp",
  "/home assets/Egypt/Egypt_3.webp",
  "/home assets/Egypt.webp",
];

type ExperienceMediaCard = {
  featured?: boolean;
  id: string;
  image: string;
  title: string;
  type: "Album" | "Video";
  video?: string;
};

type ExperienceCardProps = {
  card: ExperienceMediaCard;
  className?: string;
  onOpenGallery?: () => void;
  onOpenVideo?: () => void;
};

type TravellerReviewSlide = {
  id: string;
  rating: number;
  review: string;
  travelledMonth: string;
  travellerName: string;
};

const REVIEW_AUTOSLIDE_INTERVAL_MS = 5000;

function ExperienceCard({
  card,
  className = "",
  onOpenGallery,
  onOpenVideo,
}: ExperienceCardProps) {
  const wrapperClassName = `group relative block overflow-hidden rounded-[8px] border-0 p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
    card.featured ? "aspect-[356/452]" : "aspect-[240/220]"
  } ${className}`;
  const content = (
    <>
      {card.video ? (
        <video
          autoPlay
          className="size-full object-cover transition-transform duration-[720ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
          loop
          muted
          playsInline
          poster={card.image || undefined}
          preload="metadata"
          src={card.video}
        />
      ) : (
        <Image
          src={card.image}
          alt={card.title}
          fill
          sizes={
            card.featured
              ? "(min-width: 1280px) 356px, (min-width: 1024px) 42vw, 100vw"
              : "(min-width: 1280px) 240px, (min-width: 1024px) 26vw, (min-width: 640px) 50vw, 100vw"
          }
          className="object-cover transition-transform duration-[720ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-secondary/85 via-secondary/20 to-transparent" />
      <span className="pointer-events-none absolute left-4 top-4 inline-flex h-7 items-center gap-1.5 rounded-full bg-white px-3 text-[12px] font-semibold text-secondary">
        {card.type === "Video" ? (
          <Play className="size-3 fill-current" strokeWidth={0} />
        ) : (
          <ImageIcon className="size-3.5" strokeWidth={2} />
        )}
        {card.type}
      </span>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white">
        <h3 className="max-w-[220px] font-sans text-description font-semibold leading-0.5">
          {card.title}
        </h3>
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-white/70 text-white transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:bg-white group-hover:text-primary">
          <ButtonArrow className="h-3 w-4 brightness-0 invert group-hover:brightness-100 group-hover:invert-0" />
        </span>
      </div>
    </>
  );

  if (card.video && onOpenVideo) {
    return (
      <button
        type="button"
        onClick={onOpenVideo}
        className={`${wrapperClassName} text-left`}
      >
        {content}
      </button>
    );
  }

  if (onOpenGallery) {
    return (
      <button
        type="button"
        onClick={onOpenGallery}
        className={`${wrapperClassName} text-left`}
      >
        {content}
      </button>
    );
  }

  if (card.video) {
    return <article className={wrapperClassName}>{content}</article>;
  }

  return (
    <Link href="/experiences" className={wrapperClassName}>
      {content}
    </Link>
  );
}

function getUniqueValues(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  );
}

function formatReviewMonth(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
  }).format(date);
}

function getReviewRating(value: number) {
  return Math.min(5, Math.max(1, Number(value) || 5));
}

function createReviewSlidesFromExperiences(
  experiences: PublicExperience[]
): TravellerReviewSlide[] {
  return experiences
    .map((experience) => ({
      id: experience.id,
      rating: getReviewRating(experience.overallRating),
      review: experience.writtenReview.trim(),
      travelledMonth: formatReviewMonth(experience.createdAt),
      travellerName: experience.travellerName.trim() || "Traveller",
    }))
    .filter((slide) => slide.review);
}

function createFallbackReviewSlides(
  experiences: HomeExperienceCard[]
): TravellerReviewSlide[] {
  return experiences
    .map((experience) => ({
      id: experience.id,
      rating: getReviewRating(experience.rating),
      review: experience.review.trim(),
      travelledMonth: experience.travelledMonth || "recently",
      travellerName: experience.travellerName.trim() || "Traveller",
    }))
    .filter((slide) => slide.review);
}

function hasExperienceContent(experience: HomeExperienceCard) {
  return Boolean(
    experience.image.trim() ||
      experience.review.trim() ||
      experience.travellerPhotoGallery.some((image) => image.trim()) ||
      experience.travellerVideos.some((video) => video.trim()) ||
      experience.attractionPhotoGallery.some((photo) => photo.image.trim())
  );
}

function getFallbackExperiences() {
  return egyptCards.map((experience, index) => ({
    ...experience,
    featured: index === 0,
    travellerPhotoGallery: egyptThumbnails,
  }));
}

function createAlbumCard(
  experience: HomeExperienceCard,
  index: number,
  featured = false
): ExperienceMediaCard {
  return {
    featured,
    id: `${experience.id}-album-${index}`,
    image: experience.image,
    title: experience.title,
    type: "Album",
  };
}

function getFeaturedCard(experiences: HomeExperienceCard[]): ExperienceMediaCard {
  const videoExperience = experiences.find((experience) =>
    experience.travellerVideos.some((video) => video.trim())
  );

  if (videoExperience) {
    const videoIndex = videoExperience.travellerVideos.findIndex((video) =>
      video.trim()
    );
    const poster =
      videoExperience.travellerPhotoGallery[0] ||
      videoExperience.attractionPhotoGallery[0]?.image ||
      videoExperience.image;

    return {
      featured: true,
      id: `${videoExperience.id}-video-${videoIndex}`,
      image: poster,
      title:
        videoExperience.travellerVideoTitles[videoIndex]?.trim() ||
        videoExperience.title,
      type: "Video",
      video: videoExperience.travellerVideos[videoIndex],
    };
  }

  return createAlbumCard(experiences[0] || egyptCards[0], 0, true);
}

function getAttractionCards(experiences: HomeExperienceCard[]) {
  return experiences.flatMap((experience) =>
    experience.attractionPhotoGallery
      .filter((photo) => photo.image.trim())
      .map<ExperienceMediaCard>((photo, index) => ({
        id: `${experience.id}-attraction-${index}`,
        image: photo.image,
        title: photo.name.trim() || experience.title,
        type: "Album",
      }))
  );
}

function getGridCards(
  experiences: HomeExperienceCard[],
  hasLiveExperiences: boolean
) {
  const attractionCards = getAttractionCards(experiences);

  if (attractionCards.length > 0) {
    return attractionCards.slice(0, 4);
  }

  if (hasLiveExperiences) {
    return experiences
      .map((experience, index) => createAlbumCard(experience, index))
      .slice(0, 4);
  }

  return experiences
    .slice(1)
    .map((experience, index) => createAlbumCard(experience, index + 1))
    .slice(0, 4);
}

function getTravellerGalleryImages(experiences: HomeExperienceCard[]) {
  return getUniqueValues(
    experiences.flatMap((experience) => experience.travellerPhotoGallery)
  );
}

function getExperienceThumbnails(
  experiences: HomeExperienceCard[],
  hasLiveExperiences: boolean
) {
  const travellerImages = getTravellerGalleryImages(experiences);

  if (travellerImages.length > 0) {
    return travellerImages.slice(0, 4);
  }

  if (hasLiveExperiences) {
    return getUniqueValues(
      experiences.map((experience) => experience.image)
    ).slice(0, 4);
  }

  const thumbnails: string[] = [];

  [...experiences.map((experience) => experience.image), ...egyptThumbnails].forEach(
    (image) => {
      if (thumbnails.length < 4 && image.trim() && !thumbnails.includes(image)) {
        thumbnails.push(image);
      }
    }
  );

  return thumbnails;
}

function getSectionTitle(
  experiences: HomeExperienceCard[],
  hasLiveExperiences: boolean
) {
  if (!hasLiveExperiences) {
    return "Egypt - Beyond the Icon";
  }

  const destinations = getUniqueValues(
    experiences.map(
      (experience) =>
        experience.destinationName || experience.destinationId || ""
    )
  );

  if (destinations.length === 1) {
    return `${destinations[0]} - Beyond the Icon`;
  }

  return "Traveller Experiences";
}

function getExperienceDetailHref(experience: HomeExperienceCard | undefined) {
  const routeValue = experience
    ? slugifyRoute(experience.destinationName) ||
      slugifyRoute(experience.title) ||
      experience.destinationId ||
      experience.experienceId
    : "egypt";

  return `/experiences/${encodeURIComponent(routeValue)}`;
}

function TravellerReviewCarousel({
  slides,
}: {
  slides: TravellerReviewSlide[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const boundedIndex = slides[activeIndex] ? activeIndex : 0;
  const activeSlide = slides[boundedIndex] || slides[0];
  const filledStars = activeSlide
    ? Math.max(1, Math.min(5, Math.floor(activeSlide.rating)))
    : 0;

  useEffect(() => {
    if (slides.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((currentIndex) => {
        const safeIndex = currentIndex <= slides.length - 1 ? currentIndex : 0;

        return (safeIndex + 1) % slides.length;
      });
    }, REVIEW_AUTOSLIDE_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [slides.length]);

  function showPreviousReview() {
    setActiveIndex(boundedIndex === 0 ? slides.length - 1 : boundedIndex - 1);
  }

  function showNextReview() {
    setActiveIndex(boundedIndex === slides.length - 1 ? 0 : boundedIndex + 1);
  }

  if (!activeSlide) {
    return null;
  }

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center text-center">
      <div className="flex w-full items-center justify-center gap-7 text-primary">
        <span className="h-px w-14 bg-primary/60" />
        <Quote className="size-9 fill-current" strokeWidth={0} />
        <span className="h-px w-14 bg-primary/60" />
      </div>
      <TextReveal delay={120}>
        <p className="mt-3 text-[12px] font-semibold uppercase tracking-normal text-primary">
          Voices from our travellers
        </p>
      </TextReveal>

      <div className="mt-6 min-h-[134px] w-full overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${boundedIndex * 100}%)` }}
        >
          {slides.map((slide) => (
            <article
              key={slide.id}
              className="w-full shrink-0 px-1"
              aria-hidden={slide.id !== activeSlide.id}
            >
              <p className="mx-auto max-w-[285px] font-heading text-[18px] leading-[1.55] text-secondary">
                {slide.review}
              </p>
            </article>
          ))}
        </div>
      </div>

      <span className="mt-5 h-px w-10 bg-primary/50" />

      <div className="mt-4 flex items-center justify-center gap-2 text-primary">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={index}
            className={`size-4 ${
              index < filledStars ? "fill-current" : "fill-primary/30"
            }`}
            strokeWidth={0}
          />
        ))}
        <span className="ml-4 text-description font-medium text-secondary">
          {activeSlide.rating.toFixed(1)}
        </span>
      </div>

      <p className="mt-3 text-description text-primary">
        {activeSlide.travellerName}
       
      </p>

      {slides.length > 1 ? (
        <div className="mt-7 flex w-full items-center justify-between gap-4">
          <button
            type="button"
            aria-label="Previous traveller review"
            onClick={showPreviousReview}
            className="grid size-10 place-items-center rounded-full border border-border bg-white text-secondary transition-colors hover:border-primary hover:text-primary"
          >
            <ChevronLeft className="size-4" strokeWidth={2.3} />
          </button>

          <div className="flex items-center justify-center gap-3">
            {slides.map((slide, index) => (
              <button
                key={`${slide.id}-dot`}
                type="button"
                aria-label={`Show traveller review ${index + 1}`}
                aria-current={index === boundedIndex ? "true" : undefined}
                onClick={() => setActiveIndex(index)}
                className={`size-2 rounded-full transition-all duration-300 ${
                  index === boundedIndex
                    ? "scale-110 bg-primary"
                    : "bg-secondary/20 hover:bg-primary/55"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            aria-label="Next traveller review"
            onClick={showNextReview}
            className="grid size-10 place-items-center rounded-full border border-border bg-white text-secondary transition-colors hover:border-primary hover:text-primary"
          >
            <ChevronRight className="size-4" strokeWidth={2.3} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function GalleryLightbox({
  activeIndex,
  images,
  onClose,
  onIndexChange,
  title,
}: {
  activeIndex: number;
  images: string[];
  onClose: () => void;
  onIndexChange: (index: number) => void;
  title: string;
}) {
  const boundedIndex = Math.min(Math.max(activeIndex, 0), images.length - 1);
  const activeImage = images[boundedIndex] || "";

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }

      if (event.key === "ArrowLeft" && images.length > 1) {
        onIndexChange(boundedIndex === 0 ? images.length - 1 : boundedIndex - 1);
      }

      if (event.key === "ArrowRight" && images.length > 1) {
        onIndexChange(boundedIndex === images.length - 1 ? 0 : boundedIndex + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [boundedIndex, images.length, onClose, onIndexChange]);

  function showPreviousImage() {
    onIndexChange(boundedIndex === 0 ? images.length - 1 : boundedIndex - 1);
  }

  function showNextImage() {
    onIndexChange(boundedIndex === images.length - 1 ? 0 : boundedIndex + 1);
  }

  if (!activeImage) {
    return null;
  }

  return createPortal(
    <section
      aria-label={`${title} traveller photo gallery`}
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 bg-black/82 text-white"
      style={{ zIndex: 2147483647 }}
    >
      <button
        type="button"
        aria-label="Close traveller photo gallery backdrop"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex h-[70px] items-center justify-between px-5 md:px-8">
          <p className="font-sans text-[18px] font-semibold tracking-wide text-white/92">
            {boundedIndex + 1} / {images.length}
          </p>
          <button
            type="button"
            aria-label="Close traveller photo gallery"
            onClick={onClose}
            className="transition-colors hover:text-primary"
          >
            <X className="size-7" strokeWidth={2} />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center px-5 pb-16 md:px-24">
          {images.length > 1 ? (
            <button
              type="button"
              aria-label="Previous traveller photo"
              onClick={showPreviousImage}
              className="absolute left-5 top-1/2 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/18 text-white transition-colors hover:bg-primary md:left-10"
            >
              <ChevronLeft className="size-8" strokeWidth={2.4} />
            </button>
          ) : null}

          <div className="relative h-[calc(100vh-9rem)] w-full max-w-[1120px]">
            <Image
              src={activeImage}
              alt={`${title} traveller photo ${boundedIndex + 1}`}
              fill
              priority
              unoptimized
              sizes="(min-width: 1280px) 1120px, calc(100vw - 3rem)"
              className="object-contain object-center drop-shadow-[0_18px_42px_rgba(0,0,0,0.26)]"
            />
          </div>

          {images.length > 1 ? (
            <button
              type="button"
              aria-label="Next traveller photo"
              onClick={showNextImage}
              className="absolute right-5 top-1/2 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/18 text-white transition-colors hover:bg-primary md:right-10"
            >
              <ChevronRight className="size-8" strokeWidth={2.4} />
            </button>
          ) : null}
        </div>

        <p className="absolute bottom-6 left-1/2 z-20 w-[min(90vw,520px)] -translate-x-1/2 truncate text-center font-sans text-[18px] font-bold text-white/92">
          {title} {boundedIndex + 1}
        </p>
      </div>
    </section>,
    document.body
  );
}

function VideoLightbox({
  poster,
  source,
  title,
  onClose,
}: {
  poster: string;
  source: string;
  title: string;
  onClose: () => void;
}) {
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <section
      aria-label={`${title} video`}
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 bg-black/82 text-white"
      style={{ zIndex: 2147483647 }}
    >
      <button
        type="button"
        aria-label="Close video backdrop"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex h-[70px] items-center justify-between gap-5 px-5 md:px-8">
          <p className="min-w-0 truncate font-sans text-[18px] font-semibold tracking-wide text-white/92">
            {title}
          </p>
          <div className="flex shrink-0 items-center gap-4">
            <button
              type="button"
              aria-label={isMuted ? "Turn video sound on" : "Turn video sound off"}
              onClick={() => setIsMuted((currentValue) => !currentValue)}
              className="transition-colors hover:text-primary"
            >
              {isMuted ? (
                <VolumeX className="size-6" strokeWidth={2} />
              ) : (
                <Volume2 className="size-6" strokeWidth={2} />
              )}
            </button>
            <button
              type="button"
              aria-label="Close video"
              onClick={onClose}
              className="transition-colors hover:text-primary"
            >
              <X className="size-7" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center px-5 pb-10 md:px-14">
          <video
            autoPlay
            className="max-h-[calc(100vh-8rem)] w-full max-w-[1120px] rounded-[8px] bg-black object-contain shadow-[0_18px_42px_rgba(0,0,0,0.34)]"
            controls
            muted={isMuted}
            playsInline
            poster={poster || undefined}
            preload="metadata"
            src={source}
          />
        </div>
      </div>
    </section>,
    document.body
  );
}

export function EgyptExperiencesSection({
  experiences = [],
}: {
  experiences?: HomeExperienceCard[];
}) {
  const liveExperiences = useMemo(
    () => experiences.filter(hasExperienceContent),
    [experiences]
  );
  const hasLiveExperiences = liveExperiences.length > 0;
  const displayExperiences = useMemo(
    () => (hasLiveExperiences ? liveExperiences : getFallbackExperiences()),
    [hasLiveExperiences, liveExperiences]
  );
  const featuredCard = getFeaturedCard(displayExperiences);
  const gridCards = getGridCards(displayExperiences, hasLiveExperiences);
  const lightboxImages = getTravellerGalleryImages(displayExperiences);
  const thumbnails = getExperienceThumbnails(
    displayExperiences,
    hasLiveExperiences
  );
  const galleryImages = lightboxImages.length > 0 ? lightboxImages : thumbnails;
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeVideo, setActiveVideo] = useState<ExperienceMediaCard | null>(
    null
  );
  const [destinationReviewState, setDestinationReviewState] = useState<{
    key: string;
    slides: TravellerReviewSlide[];
  }>({ key: "", slides: [] });
  const reviewDestinationIds = useMemo(
    () => getUniqueValues(displayExperiences.map((experience) => experience.destinationId)),
    [displayExperiences]
  );
  const reviewDestinationKey = reviewDestinationIds.join("|");
  const fallbackReviewSlides = useMemo(
    () => createFallbackReviewSlides(displayExperiences),
    [displayExperiences]
  );
  const reviewSlides =
    hasLiveExperiences &&
    destinationReviewState.key === reviewDestinationKey &&
    destinationReviewState.slides.length > 0
      ? destinationReviewState.slides
      : fallbackReviewSlides;
  const sectionTitle = getSectionTitle(displayExperiences, hasLiveExperiences);
  const experiencesHref = getExperienceDetailHref(displayExperiences[0]);
  const openGallery =
    galleryImages.length > 0
      ? (index = 0) => setLightboxIndex(index % galleryImages.length)
      : undefined;
  const getGalleryStartIndex = (image: string) => {
    const clickedImageIndex = galleryImages.indexOf(image.trim());

    return clickedImageIndex >= 0 ? clickedImageIndex : 0;
  };

  useEffect(() => {
    if (!hasLiveExperiences || reviewDestinationIds.length === 0) {
      return;
    }

    let isMounted = true;

    async function loadDestinationReviews() {
      try {
        const responses = await Promise.all(
          reviewDestinationIds.map((destinationId) =>
            listPublicExperiences(destinationId)
          )
        );
        const reviewsById = new Map<string, TravellerReviewSlide>();

        responses
          .flatMap((response) => response.data.experiences)
          .forEach((experience) => {
            createReviewSlidesFromExperiences([experience]).forEach((slide) => {
              reviewsById.set(slide.id, slide);
            });
          });

        if (isMounted) {
          setDestinationReviewState({
            key: reviewDestinationKey,
            slides: Array.from(reviewsById.values()),
          });
        }
      } catch {
        if (isMounted) {
          setDestinationReviewState({
            key: reviewDestinationKey,
            slides: [],
          });
        }
      }
    }

    loadDestinationReviews();

    return () => {
      isMounted = false;
    };
  }, [hasLiveExperiences, reviewDestinationIds, reviewDestinationKey]);

  return (
    <section className="relative overflow-hidden bg-background py-10 lg:py-14">
      <div className="mx-auto grid w-full max-w-[1300px] gap-8 px-5 sm:px-0 lg:grid-cols-[minmax(0,1fr)_minmax(300px,356px)] lg:gap-8 [@media(min-width:1320px)]:grid-cols-[848px_356px] [@media(min-width:1320px)]:gap-[96px]">
        <div>
          <TextReveal>
            <p className="text-description font-medium uppercase text-primary">
              Stories | Moments | Memories
            </p>
          </TextReveal>
          <div className="mt-2">
            <TextReveal delay={120}>
              <div>
                <h2 className="font-heading text-title font-bold leading-none text-secondary">
                  {sectionTitle}
                </h2>
                <p className="mt-3 text-description text-secondary/70">
                  Real stories, moments and memories from our travellers
                </p>
              </div>
            </TextReveal>
          </div>

          <div className="mt-5 grid items-stretch gap-3 lg:grid-cols-[minmax(280px,356px)_minmax(0,480px)]">
            <RevealOnView className="h-full" motion="scale" replay>
              <ExperienceCard
                card={featuredCard}
                className="h-full"
                onOpenGallery={() =>
                  openGallery?.(getGalleryStartIndex(featuredCard.image))
                }
                onOpenVideo={() => setActiveVideo(featuredCard)}
              />
            </RevealOnView>
            <div className="grid gap-3 sm:grid-cols-2 lg:h-full lg:grid-rows-2">
              {gridCards.map((card) => (
                <ExperienceCard
                  key={card.id}
                  card={card}
                  className="lg:aspect-auto lg:h-full"
                  onOpenGallery={() =>
                    openGallery?.(getGalleryStartIndex(card.image))
                  }
                  onOpenVideo={() => setActiveVideo(card)}
                />
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 items-center gap-3 sm:grid-cols-4 lg:grid-cols-[repeat(4,minmax(0,1fr))_176px] [@media(min-width:1320px)]:grid-cols-[repeat(4,150px)_176px]">
            {thumbnails.map((thumbnail, index) => (
              <button
                type="button"
                key={`${thumbnail}-${index}`}
                onClick={() => openGallery?.(index)}
                className="relative h-[92px] overflow-hidden rounded-[7px] border-0 p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                aria-label={`Open traveller photo ${index + 1}`}
              >
                <Image
                  src={thumbnail}
                  alt="Traveller memory"
                  fill
                  sizes="(min-width: 1280px) 150px, (min-width: 1024px) 12vw, (min-width: 640px) 25vw, 50vw"
                  className="object-cover"
                />
              </button>
            ))}
            <button
              type="button"
              onClick={() => openGallery?.(0)}
              className="col-span-2 flex h-[92px] items-center justify-center gap-4 rounded-[7px] border-0 bg-white px-0 text-primary transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]  cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:col-span-4 lg:col-span-1"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full border-[2px] border-primary">
                <ImageIcon className="size-4" strokeWidth={1.9} />
              </span>
              <span className="text-left font-sans text-[14px] font-medium leading-[1.12]">
                VIEW ALL PHOTOS
              </span>
             
            </button>
          </div>
        </div>

        <aside className="flex h-full flex-col items-center justify-between text-center lg:w-full lg:max-w-[356px] lg:justify-self-end">
          <Button
            nativeButton={false}
            render={<Link href={experiencesHref} />}
            className="mb-8 h-11 w-full min-w-0 justify-between gap-3 px-5 text-[14px] font-normal sm:w-auto sm:gap-8 sm:px-6 sm:text-button lg:mb-14 lg:min-w-[270px]"
          >
            View All Traveller Experiences
            <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
          </Button>

          <TravellerReviewCarousel slides={reviewSlides} />
        </aside>
      </div>

      {lightboxIndex !== null && galleryImages.length > 0 ? (
        <GalleryLightbox
          activeIndex={lightboxIndex}
          images={galleryImages}
          title={sectionTitle}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      ) : null}

      {activeVideo?.video ? (
        <VideoLightbox
          poster={activeVideo.image}
          source={activeVideo.video}
          title={activeVideo.title}
          onClose={() => setActiveVideo(null)}
        />
      ) : null}
    </section>
  );
}
