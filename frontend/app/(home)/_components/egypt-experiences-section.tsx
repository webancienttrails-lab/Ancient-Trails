import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Play,
  Quote,
  Star,
} from "lucide-react";

import { Button, ButtonArrow } from "@/components/ui/button";
import { RevealOnView, TextReveal } from "./reveal-on-view";

const egyptCards = [
  {
    title: "Pyramids of Giza Sunrise Experience",
    image: "/home assets/Egypt.webp",
    type: "Video",
    featured: true,
  },
  {
    title: "Exploring Luxor Temples",
    image: "/home assets/Egypt/Egypt_2.webp",
    type: "Album",
  },
  {
    title: "Nile Cruise Moments",
    image: "/home assets/Egypt/Egypt_3.webp",
    type: "Album",
  },
  {
    title: "Egyptian Museum Highlights",
    image: "/home assets/Egypt/Egypt_4.webp",
    type: "Album",
  },
  {
    title: "Khan El Khalili Market Vibes",
    image: "/home assets/Egypt/Egypt_5.webp",
    type: "Album",
  },
];

const egyptThumbnails = [
  "/home assets/Egypt/Egypt_1.webp",
  "/home assets/Egypt/Egypt_6.webp",
  "/home assets/Egypt/Egypt_3.webp",
  "/home assets/Egypt.webp",
];

type ExperienceCardProps = {
  card: (typeof egyptCards)[number];
};

function ExperienceCard({ card }: ExperienceCardProps) {
  return (
    <article
      className={`group relative overflow-hidden rounded-[8px] ${
        card.featured
          ? "min-h-[320px] sm:min-h-[380px] lg:min-h-[452px]"
          : "min-h-[220px]"
      }`}
    >
      <Image
        src={card.image}
        alt={card.title}
        fill
        sizes={
          card.featured
            ? "(min-width: 1024px) 356px, 100vw"
            : "(min-width: 1024px) 240px, 50vw"
        }
        className="object-cover transition-transform duration-[720ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-secondary/85 via-secondary/20 to-transparent" />
      <span className="absolute left-4 top-4 inline-flex h-7 items-center gap-1.5 rounded-full bg-white px-3 text-[12px] font-semibold text-secondary">
        {card.type === "Video" ? (
          <Play className="size-3 fill-current" strokeWidth={0} />
        ) : (
          <ImageIcon className="size-3.5" strokeWidth={2} />
        )}
        {card.type}
      </span>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white">
        <h3 className="max-w-[220px] font-sans text-description font-semibold leading-0.5">
          {card.title}
        </h3>
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-white/70 text-white transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:bg-white group-hover:text-primary">
          <ButtonArrow className="h-3 w-4 brightness-0 invert group-hover:brightness-100 group-hover:invert-0" />
        </span>
      </div>
    </article>
  );
}

export function EgyptExperiencesSection() {
  return (
    <section className="relative overflow-hidden bg-background py-20">
      <div className="mx-auto grid w-full max-w-[1300px] gap-8 px-5 sm:px-0 lg:grid-cols-[848px_minmax(0,1fr)]">
        <div>
          <TextReveal>
            <p className="text-description font-medium uppercase text-primary">
              Stories | Moments | Memories
            </p>
          </TextReveal>
          <div className="mt-2">
            <TextReveal delay={120}>
              <div>
                <h2 className="font-heading text-[34px] font-bold leading-none text-secondary sm:text-[40px] lg:text-title">
                  Egypt - Beyond the Icon
                </h2>
                <p className="mt-3 text-description text-secondary/70">
                  Real stories, moments and memories from our travellers
                </p>
              </div>
            </TextReveal>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[356px_480px]">
            <RevealOnView motion="scale" replay>
              <ExperienceCard card={egyptCards[0]} />
            </RevealOnView>
            <div className="grid gap-3 sm:grid-cols-2">
              {egyptCards.slice(1).map((card, index) => (
                <RevealOnView
                  key={card.title}
                  delay={80 + index * 90}
                  motion="scale"
                  replay
                >
                  <ExperienceCard card={card} />
                </RevealOnView>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 items-center gap-3 sm:grid-cols-4 lg:grid-cols-[repeat(4,150px)_176px]">
            {egyptThumbnails.map((thumbnail) => (
              <div
                key={thumbnail}
                className="relative h-[92px] overflow-hidden rounded-[7px]"
              >
                <Image
                  src={thumbnail}
                  alt="Egypt traveller memory"
                  fill
                  sizes="(min-width: 1024px) 150px, (min-width: 640px) 25vw, 50vw"
                  className="object-cover"
                />
              </div>
            ))}
            <button
              type="button"
              className="col-span-2 flex h-[92px] items-center justify-center gap-4 rounded-[7px] bg-white px-0 text-description transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-primary cursor-pointer sm:col-span-4 lg:col-span-1"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full border-[2px] border-secondary">
                <ImageIcon className="size-4" strokeWidth={1.9} />
              </span>
              <span className="text-left font-sans text-[14px] font-medium leading-[1.12]">
                View all
                <br />
                photos
              </span>
              <ButtonArrow className="h-4 w-6" />
            </button>
          </div>
        </div>

        <aside className="flex h-full flex-col items-center justify-between text-center lg:w-full lg:max-w-[356px] lg:justify-self-end">
          <Button className="mb-8 h-11 w-full min-w-0 justify-between gap-3 px-5 text-[14px] font-normal sm:w-auto sm:gap-8 sm:px-6 sm:text-button lg:mb-14 lg:min-w-[270px]">
            View All Traveller Experiences
            <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
          </Button>

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
          <TextReveal delay={240}>
            <p className="mt-6 max-w-[285px] font-heading text-[18px] leading-[1.55] text-secondary">
              Location and quality of hotel in Cairo could be better- felt
              stranded in Cairo since hotel was a little remote from city (new
              and old Cairo).
            </p>
          </TextReveal>
          <span className="mt-5 h-px w-10 bg-primary/50" />

          <div className="mt-4 flex items-center justify-center gap-2 text-primary">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star
                key={index}
                className={`size-4 ${
                  index < 4 ? "fill-current" : "fill-primary/30"
                }`}
                strokeWidth={0}
              />
            ))}
            <span className="ml-4 text-description font-medium text-secondary">
              4.0
            </span>
          </div>
          <TextReveal delay={360}>
            <p className="mt-3 text-description text-primary">
              Meredith, travelled in February
            </p>
          </TextReveal>

          <div className="mt-4 flex w-full items-center justify-between">
            <button
              type="button"
              aria-label="Previous traveller story"
              className="grid size-9 place-items-center rounded-full border border-border bg-white text-secondary transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-primary hover:text-primary"
            >
              <ChevronLeft className="size-5" strokeWidth={2} />
            </button>
            <div className="flex items-center gap-3">
              {[0, 1, 2, 3].map((dot) => (
                <span
                  key={dot}
                  className={`size-2 rounded-full ${
                    dot === 0 ? "bg-primary" : "bg-border"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Next traveller story"
              className="grid size-9 place-items-center rounded-full border border-border bg-white text-secondary transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-primary hover:text-primary"
            >
              <ChevronRight className="size-5" strokeWidth={2} />
            </button>
          </div>

          <div className="relative mt-6 h-[165px] w-full overflow-hidden rounded-[8px]">
            <Image
              src="/home assets/Egypt/Egypt_3.webp"
              alt="Nile and pyramids traveller memory"
              fill
              sizes="(min-width: 1024px) 356px, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white/35 via-transparent to-white/15" />
          </div>
        </aside>
      </div>
    </section>
  );
}
