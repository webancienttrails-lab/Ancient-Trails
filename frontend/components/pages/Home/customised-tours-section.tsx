import Image from "next/image";

import { RevealOnView } from "@/components/pages/Home/reveal-on-view";
import { Button, ButtonArrow } from "@/components/ui/button";

const customisedTours = [
  {
    title: "Kashmir",
    image: "/home assets/Haridwar.webp",
    tags: ["Spiritual", "Nature"],
    className: "lg:h-[285px]",
    sizes: "(min-width: 1024px) 235px, (min-width: 768px) 33vw, 100vw",
  },
  {
    title: "Rajasthan",
    image: "/home assets/destination/hawa-mahal.webp",
    tags: ["Heritage", "Architecture"],
    className: "lg:h-[330px]",
    sizes: "(min-width: 1024px) 260px, (min-width: 768px) 33vw, 100vw",
  },
  {
    title: "Shimla",
    image: "/home assets/destination/Amritsar.webp",
    tags: ["Winters", "Honeymoon"],
    className: "lg:h-[250px]",
    sizes: "(min-width: 1024px) 205px, (min-width: 768px) 33vw, 100vw",
  },
];

type CustomisedTourCardProps = {
  tour: (typeof customisedTours)[number];
};

function CustomisedTourCard({ tour }: CustomisedTourCardProps) {
  return (
    <article
      className={`relative min-h-[260px] overflow-hidden rounded-[10px] lg:min-h-0 ${tour.className}`}
    >
      <Image
        src={tour.image}
        alt={`${tour.title} customised tour`}
        fill
        sizes={tour.sizes}
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/35 via-transparent to-secondary/10" />
      <h3 className="absolute left-4 top-4 font-sans text-description font-bold uppercase leading-none text-white">
        {tour.title}
      </h3>
      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 lg:gap-2">
        {tour.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-white px-3 py-1 text-[9px] font-medium text-primary"
          >
            {tag} +
          </span>
        ))}
      </div>
    </article>
  );
}

export function CustomisedToursSection() {
  const [kashmirTour, rajasthanTour, shimlaTour] = customisedTours;

  return (
    <section className="overflow-hidden bg-[#fbf0e8] py-14 lg:py-16">
      <div className="relative mx-auto w-full max-w-[1300px] px-5 sm:px-8 lg:px-[72px]">
        <div className="relative z-10 grid gap-10 lg:grid-cols-[330px_250px_260px_220px] lg:items-start lg:gap-x-[44px]">
          <div className="lg:pt-1">
            <p className="text-description font-medium uppercase text-primary">
              Customised Tours
            </p>
            <h2 className="mt-2 max-w-[330px] font-heading text-title font-bold text-secondary">
              Find your perfect experience
            </h2>
            <p className="mt-6 max-w-[290px] text-description italic text-secondary/75">
              Have a route in mind, or just an interest you want to follow?
              Share your destination, dates and budget with us.
            </p>
            <p className="mt-6 text-description italic text-secondary/75">
              Let us plan for you!
            </p>
          </div>

          <div>
            <RevealOnView replay>
              <CustomisedTourCard tour={kashmirTour} />
            </RevealOnView>

            <div className="mt-7">
              <span className="mb-4 block h-px w-[72px] bg-primary" />
              <p className="max-w-[220px] text-description italic text-secondary/75">
                Pick your interests &amp; explore suitable destinations
              </p>
            </div>

            <Button className="mt-11 h-11 min-w-[200px] justify-between gap-4 px-6 font-normal">
              Customise your tour
              <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
            </Button>
          </div>

          <div className="lg:pt-[28px]">
            <div className="mb-8">
              <span className="mb-4 block h-px w-[76px] bg-primary" />
              <p className="max-w-[215px] text-description italic text-secondary/75">
                Share your ideas with us, so that we can plan your tour
              </p>
            </div>

            <RevealOnView delay={160} replay>
              <CustomisedTourCard tour={rajasthanTour} />
            </RevealOnView>
          </div>

          <div className="lg:pt-[21px]">
            <RevealOnView delay={280} replay>
              <CustomisedTourCard tour={shimlaTour} />
            </RevealOnView>

            <div className="mt-8">
              <span className="mb-4 block h-px w-[76px] bg-primary" />
              <p className="max-w-[190px] text-description italic text-secondary/75">
                Need an expert guide? We got you covered!
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
