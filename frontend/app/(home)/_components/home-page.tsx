import Image from "next/image";

import { Header } from "@/components/layout/header";
import { PlanTripLauncher } from "@/components/plan-trip-launcher";
import type {
  HomeCustomisedTourCard,
  HomeDestinationCard,
  HomeExperienceCard,
} from "@/lib/home-travel";
import { AboutSection } from "./about-section";
import { CustomisedToursSection } from "./customised-tours-section";
import { EgyptExperiencesSection } from "./egypt-experiences-section";
import { FaqSection } from "./faq-section";
import { TextReveal } from "./reveal-on-view";
import { SpecialisedToursSection } from "./specialised-tours-section";
import { TopDestinationsSection } from "./top-destinations-section";
import { UpcomingToursSection } from "./upcoming-tours-section";
import { WhyChooseUsSection } from "./why-choose-us-section";

export function HomePage({
  customisedTourDestinations,
  homeExperiences,
  topDestinations,
  tourCategories,
}: {
  customisedTourDestinations?: HomeCustomisedTourCard[];
  homeExperiences?: HomeExperienceCard[];
  topDestinations?: HomeDestinationCard[];
  tourCategories?: string[];
}) {
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
                  <h1 className="font-heading text-title font-bold leading-none tracking-normal text-secondary">
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

      <UpcomingToursSection />

      <AboutSection />

      <TopDestinationsSection
        destinations={topDestinations}
        tourCategories={tourCategories}
      />

      <EgyptExperiencesSection experiences={homeExperiences} />

      <WhyChooseUsSection />

      <CustomisedToursSection destinations={customisedTourDestinations} />

      <SpecialisedToursSection />

      <FaqSection />
    </main>
  );
}
