import Image from "next/image";

import { Header } from "@/components/layout/header";
import { PlanTripLauncher } from "@/components/plan-trip-launcher";
import { Button, ButtonArrow } from "@/components/ui/button";
import { AboutSection } from "./about-section";
import { CustomisedToursSection } from "./customised-tours-section";
import { EgyptExperiencesSection } from "./egypt-experiences-section";
import { FaqSection } from "./faq-section";
import { RevealOnView, TextReveal } from "./reveal-on-view";
import { SpecialisedToursSection } from "./specialised-tours-section";
import { TopDestinationsSection } from "./top-destinations-section";
import { WhyChooseUsSection } from "./why-choose-us-section";

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
      <section className="relative h-[100svh] min-h-[560px] overflow-visible lg:h-[80vh] lg:min-h-0">
        <Image
          src="/home assets/Heritage Banner.webp"
          alt="Amber fort over a heritage landscape"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />

      
        <div className="relative z-[2147483647] mx-auto flex h-full w-full max-w-[1300px] flex-col px-5 py-[clamp(1rem,4vh,2.25rem)] sm:px-0">
          <Header />

          <div className="flex min-h-0 flex-1 items-center px-0 py-[clamp(0.5rem,3vh,4rem)] sm:px-6 lg:px-10">
            <div className="max-w-[430px] text-accent">
              <TextReveal trigger="load" delay={120}>
                <p className="mb-[clamp(0.5rem,1.5vh,0.75rem)] text-eyebrow font-medium uppercase tracking-normal text-primary">
                  Learn. Explore. Remember.
                </p>
              </TextReveal>

              <TextReveal trigger="load" delay={280}>
                <div className="flex items-end">
                  <h1 className="font-heading text-[36px] font-bold leading-none tracking-normal text-secondary sm:text-[44px] lg:text-title [@media(max-height:600px)]:text-[38px]">
                    <span className="block">Travel Deeper</span>
                    <span className="flex items-center gap-3">
                      Into Places
                      <span className="mt-5 hidden h-px w-[80px] shrink-0 bg-accent sm:block" />
                    </span>
                  </h1>
                </div>
              </TextReveal>

              <TextReveal trigger="load" delay={460}>
                <p className="mt-[clamp(0.75rem,3vh,1.75rem)] max-w-[380px] text-description text-accent">
                  Ancient-Trails curates heritage-based travel experiences across
                  India and the world with an expert blend of history, leisure and
                  culture.
                </p>
              </TextReveal>

              <PlanTripLauncher />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background py-10 sm:py-10">
        <div className="mx-auto w-full max-w-[1300px] px-5 sm:px-0">
          <div className="grid gap-7 lg:grid-cols-[1.38fr_1.85fr] lg:gap-10">
            <div className="space-y-5">
              <TextReveal>
                <div>
                  <p className="text-eyebrow font-medium uppercase text-primary">
                    Explore Upcoming Tours
                  </p>
                  <h2 className="mt-2 font-heading text-[34px] font-bold leading-none text-secondary sm:text-[40px] lg:text-title">
                    Trails Leaving Soon
                  </h2>
                </div>
              </TextReveal>

              <RevealOnView motion="scale" rootMargin="0px 0px 320px 0px">
                <TourCard
                  tour={upcomingTours.khajuraho}
                  className="aspect-[1.88/1]"
                  sizes="(min-width: 1024px) 410px, 100vw"
                />
              </RevealOnView>

              <div className="grid gap-5 sm:grid-cols-2">
                <RevealOnView delay={220} replay>
                  <TourCard
                    tour={upcomingTours.haridwar}
                    className="aspect-[1/1.04]"
                    sizes="(min-width: 1024px) 190px, (min-width: 640px) 50vw, 100vw"
                  />
                </RevealOnView>
                <RevealOnView delay={340} replay>
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
                <RevealOnView
                  delay={120}
                  motion="scale"
                  rootMargin="0px 0px 320px 0px"
                  className="h-[320px] sm:h-[410px] lg:h-full"
                >
                  <TourCard
                    tour={upcomingTours.indonesia}
                    className="h-full"
                    sizes="(min-width: 1024px) 330px, 100vw"
                  />
                </RevealOnView>

                <div className="grid gap-5">
                  <RevealOnView
                    delay={220}
                    motion="scale"
                    rootMargin="0px 0px 320px 0px"
                  >
                    <TourCard
                      tour={upcomingTours.combodia}
                      className="aspect-[1.4/1]"
                      sizes="(min-width: 1024px) 390px, 100vw"
                    />
                  </RevealOnView>
                  <RevealOnView delay={460} replay>
                    <TourCard
                      tour={upcomingTours.egypt}
                      className="aspect-[1.4/1]"
                      sizes="(min-width: 1024px) 390px, 100vw"
                    />
                  </RevealOnView>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[0.85fr_1fr] lg:items-center">
                <TextReveal delay={120}>
                  <p className="text-description text-accent">
                    Find upcoming tours &amp; explore destinations beyond borders
                  </p>
                </TextReveal>
                <div className="flex justify-start lg:justify-end">
                  <Button className="h-11 w-full min-w-0 justify-between gap-4 px-5 text-[15px] font-normal sm:w-auto sm:gap-8 sm:px-6 sm:text-button lg:min-w-[230px]">
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
