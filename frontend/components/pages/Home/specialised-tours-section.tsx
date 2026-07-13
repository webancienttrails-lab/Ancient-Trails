import Image from "next/image";

import { Button, ButtonArrow } from "@/components/ui/button";

export function SpecialisedToursSection() {
  return (
    <section className="bg-background py-16">
      <div className="mx-auto grid w-full max-w-[1300px] items-center gap-10 px-5 sm:px-8 lg:grid-cols-[540px_1fr] lg:gap-16 lg:px-[72px]">
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

          <div className="relative min-h-[407px] overflow-hidden rounded-[8px]">
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
          <p className="text-description font-medium uppercase text-primary">
            For Focused Explorers
          </p>
          <h2 className="mt-2 font-heading text-title font-bold text-secondary">
            Specialised Tours
          </h2>

          <p className="mt-7 max-w-[680px] text-description italic text-secondary/80">
            Our specialised tours are created for people with specific
            interests, including dancers, photographers, artists, architects,
            archaeology enthusiasts, history lovers, foodies, students,
            researchers and cultural groups.
          </p>

          <p className="mt-7 max-w-[680px] text-description italic text-secondary/80">
            Each tour is shaped around the lens of that group, with expert
            inputs and an experience that goes deeper than a standard itinerary.
          </p>

          <Button className="mt-14 h-11 min-w-[250px] justify-between gap-8 px-6 font-normal">
            View all specialised tours
            <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
          </Button>
        </div>
      </div>
    </section>
  );
}
