import Image from "next/image";
import Link from "next/link";

import { Button, ButtonArrow } from "@/components/ui/button";
import { getTourCalendarHref } from "@/lib/routes";
import { TextReveal } from "./reveal-on-view";

export function SpecialisedToursSection() {
  return (
    <section id="specialised-tours" className="bg-background py-14 lg:py-16">
      <div className="mx-auto grid w-full max-w-[1300px] items-center gap-10 px-5 sm:px-0 md:grid-cols-[minmax(300px,420px)_minmax(0,1fr)] md:gap-12 lg:grid-cols-[540px_minmax(0,1fr)] lg:gap-16">
        <div className="grid w-full max-w-[540px] gap-7 sm:grid-cols-[1fr_1fr] lg:grid-cols-[240px_265px]">
          <div className="grid gap-7">
            <div className="relative h-[190px] overflow-hidden rounded-[8px]">
              <Image
                src="/home assets/Special_Tour/Assam.png"
                alt="Assam cultural dancers"
                fill
                sizes="(min-width: 1024px) 240px, 50vw"
                className="object-cover"
              />
            </div>

            <div className="relative h-[190px] overflow-hidden rounded-[8px]">
              <Image
                src="/home assets/Special_Tour/Sketching.png"
                alt="Artist sketching during a specialised tour"
                fill
                sizes="(min-width: 1024px) 240px, 50vw"
                className="object-cover"
              />
            </div>
          </div>

          <div className="relative min-h-[320px] overflow-hidden rounded-[8px] sm:min-h-[407px]">
            <Image
              src="/home assets/Special_Tour/Photograph.png"
              alt="Photographer on a specialised tour"
              fill
              sizes="(min-width: 1024px) 265px, 50vw"
              className="object-cover"
            />
          </div>
        </div>

        <div className="w-full max-w-[850px]">
          <TextReveal>
            <p className="text-description font-medium uppercase text-primary">
              For Focused Explorers
            </p>
          </TextReveal>
          <TextReveal delay={120}>
            <h2 className="mt-2 font-heading text-[34px] font-bold leading-none text-secondary sm:text-[40px] lg:text-title">
              Specialised Tours
            </h2>
          </TextReveal>

          <TextReveal delay={240}>
            <p className="mt-7 max-w-[680px] text-description italic text-secondary/80">
              Our specialised tours are created for people with specific
              interests, including dancers, photographers, artists, architects,
              archaeology enthusiasts, history lovers, foodies, students,
              researchers and cultural groups.
            </p>
          </TextReveal>

          <TextReveal delay={360}>
            <p className="mt-7 max-w-[680px] text-description italic text-secondary/80">
              Each tour is shaped around the lens of that group, with expert
              inputs and an experience that goes deeper than a standard
              itinerary.
            </p>
          </TextReveal>

          <Button
            nativeButton={false}
            render={<Link href={getTourCalendarHref()} />}
            className="mt-10 h-11 w-full min-w-0 justify-between gap-4 px-5 text-[15px] font-normal sm:w-auto sm:gap-8 sm:px-6 sm:text-button lg:mt-14 lg:min-w-[250px]"
          >
            View all specialised tours
            <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
          </Button>
        </div>
      </div>
    </section>
  );
}
