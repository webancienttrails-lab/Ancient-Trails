import Image from "next/image";

import { Header } from "@/components/layout/header";
import { PlanTripLauncher } from "@/components/plan-trip-launcher";
import { AboutSection } from "@/components/pages/Home/about-section";
import { CustomisedToursSection } from "@/components/pages/Home/customised-tours-section";
import { EgyptExperiencesSection } from "@/components/pages/Home/egypt-experiences-section";
import { FaqSection } from "@/components/pages/Home/faq-section";
import { RevealOnView } from "@/components/pages/Home/reveal-on-view";
import { SpecialisedToursSection } from "@/components/pages/Home/specialised-tours-section";
import { TopDestinationsSection } from "@/components/pages/Home/top-destinations-section";
import { WhyChooseUsSection } from "@/components/pages/Home/why-choose-us-section";
import { Button, ButtonArrow } from "@/components/ui/button";

const upcomingTours = {
  khajuraho: {
    title: "Khajuraho",
    duration: "6 Days/ 5 Nights",
    date: "16 Jul 2026",
    image: "/home assets/Khajuraho.webp",
  },
  indonesia: {
    title: "Incredible Indonesia",
    duration: "9 Days/ 8 Nights",
    date: "8 Jul 2026",
    image: "/home assets/Indonesia.webp",
  },
  combodia: {
    title: "Combodia",
    duration: "7 Days/ 6 Nights",
    date: "23 Aug 2026",
    image: "/home assets/Combodia.webp",
  },
  haridwar: {
    title: "Leisurely Hampi",
    duration: "6 Days/ 5 Nights",
    date: "23 Aug 2026",
    image: "/home assets/Haridwar.webp",
  },
  vietnam: {
    title: "Vibrant Vietnam",
    duration: "9 Days/ 8 Nights",
    date: "4 Dec 2026",
    image: "/home assets/Vietnam.webp",
  },
  egypt: {
    title: "Mystical Egypt",
    duration: "9 Days/ 8 Nights",
    date: "14 Nov 2026",
    image: "/home assets/Egypt.webp",
  },
};

type TourCardProps = {
  tour: {
    title: string;
    duration: string;
    date: string;
    image: string;
  };
  className: string;
  sizes: string;
};

function TourCard({ tour, className, sizes }: TourCardProps) {
  return (
    <article className={`relative overflow-hidden rounded-[6px] ${className}`}>
      <Image
        src={tour.image}
        alt={`${tour.title} tour`}
        fill
        sizes={sizes}
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-secondary/80 via-secondary/10 to-transparent" />
      <time className="absolute right-4 top-4 text-description font-medium text-white">
        {tour.date}
      </time>
      <div className="absolute inset-x-0 bottom-0 p-4 text-white">
        <h3 className="font-sans text-button font-semibold">
          {tour.title}
        </h3>
        <p className="mt-1 text-description">{tour.duration}</p>
      </div>
    </article>
  );
}

export function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative h-[80vh] overflow-hidden">
        <Image
          src="/home assets/Heritage Banner.webp"
          alt="Amber fort over a heritage landscape"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />

      
        <div className="relative z-10 mx-auto flex h-full w-full max-w-[1320px] flex-col px-5 py-9 sm:px-8 lg:px-12">
          <Header />

          <div className="flex flex-1 items-center px-10 py-16 sm:py-20">
            <div className="max-w-[430px] text-accent">
              <p className="mb-3 text-eyebrow font-medium uppercase tracking-normal text-primary">
                Learn. Explore. Remember.
              </p>

              <div className="flex items-end">
                <h1 className="font-heading text-title font-bold tracking-normal text-secondary">
                  <span className="block">Travel Deeper</span>
                  <span className="flex items-center gap-3">
                    Into Places
                    <span className="mt-5 hidden h-px w-[80px] shrink-0 bg-accent sm:block" />
                  </span>
                </h1>
              </div>

              <p className="mt-7 max-w-[380px] text-description text-accent">
                Ancient-Trails curates heritage-based travel experiences across
                India and the world with an expert blend of history, leisure and
                culture.
              </p>

              <PlanTripLauncher />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background py-10 sm:py-10">
        <div className="mx-auto w-full max-w-[1300px] px-5 sm:px-8">
          <div className="grid gap-7 lg:grid-cols-[1.38fr_1.85fr] lg:gap-10">
            <div className="space-y-5">
              <div>
                <p className="text-eyebrow font-medium uppercase text-primary">
                  Explore Upcoming Tours
                </p>
                <h2 className="mt-2 font-heading text-title font-bold text-secondary">
                  Trails Leaving Soon
                </h2>
              </div>

              <TourCard
                tour={upcomingTours.khajuraho}
                className="aspect-[1.88/1]"
                sizes="(min-width: 1024px) 410px, 100vw"
              />

              <div className="grid gap-5 sm:grid-cols-2">
                <RevealOnView delay={80}>
                  <TourCard
                    tour={upcomingTours.haridwar}
                    className="aspect-[1/1.04]"
                    sizes="(min-width: 1024px) 190px, (min-width: 640px) 50vw, 100vw"
                  />
                </RevealOnView>
                <RevealOnView delay={180}>
                  <TourCard
                    tour={upcomingTours.vietnam}
                    className="aspect-[1/1.04]"
                    sizes="(min-width: 1024px) 190px, (min-width: 640px) 50vw, 100vw"
                  />
                </RevealOnView>
              </div>
            </div>

            <div className="space-y-8 lg:pt-6">
              <div className="grid gap-5 lg:grid-cols-[0.85fr_1fr] lg:items-stretch">
                <TourCard
                  tour={upcomingTours.indonesia}
                  className="h-[410px] lg:h-auto"
                  sizes="(min-width: 1024px) 330px, 100vw"
                />

                <div className="grid gap-5">
                  <TourCard
                    tour={upcomingTours.combodia}
                    className="aspect-[1.4/1]"
                    sizes="(min-width: 1024px) 390px, 100vw"
                  />
                  <RevealOnView delay={260}>
                    <TourCard
                      tour={upcomingTours.egypt}
                      className="aspect-[1.4/1]"
                      sizes="(min-width: 1024px) 390px, 100vw"
                    />
                  </RevealOnView>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[0.85fr_1fr] lg:items-center">
                <p className="text-description text-accent">
                  Find upcoming tours &amp; explore destinations beyond borders
                </p>
                <div className="flex justify-start lg:justify-end">
                  <Button className="h-11 min-w-[230px] justify-between gap-8 px-6 font-normal">
                    View Tour Calendar
                    <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AboutSection />

      <TopDestinationsSection />

      <EgyptExperiencesSection />

      <WhyChooseUsSection />

      <CustomisedToursSection />

      <SpecialisedToursSection />

      <FaqSection />
    </main>
  );
}
