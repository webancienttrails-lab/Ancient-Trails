import Image from "next/image";

import { TextReveal } from "./reveal-on-view";

const whyChooseUsFeatures = [
  {
    title: "Mentor Led Trails",
    description:
      "Travel with people who understand history, archaeology and culture.",
    icon: "/home assets/icons/Mentor.png",
  },
  {
    title: "Tour Expert on Every Trip",
    description:
      "A well managed itinerary, so you stay fully present in the experience.",
    icon: "/home assets/icons/Tour_trip.png",
  },
  {
    title: "Learning with Leisure",
    description:
      "The pace is thoughtful. The travel stays comfortable and never rushed.",
    icon: "/home assets/icons/Learning.png",
  },
  {
    title: "Curated Across Interests",
    description:
      "Choose from heritage trips, short trails, international journeys and specialized tours.",
    icon: "/home assets/icons/Internet.png",
  },
  {
    title: "Safe and Smooth Planning",
    description:
      "Clear itineraries, easy bookings, guided support that help instill confidence in travellers.",
    icon: "/home assets/icons/Planning.png",
  },
];

export function WhyChooseUsSection() {
  return (
    <section className="relative overflow-hidden bg-background pb-16 pt-14 lg:pb-24 lg:pt-16">
      <div className="pointer-events-none absolute -right-3 top-[58px] hidden h-[255px] w-[175px] overflow-hidden lg:block">
        <Image
          src="/home assets/Heritage Banner.webp"
          alt=""
          fill
          sizes="175px"
          className="object-cover object-left opacity-[0.46] grayscale contrast-[1.35] brightness-[1.04] mix-blend-multiply"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#ffffff_0%,rgba(255,255,255,0)_16%,rgba(255,255,255,0)_78%,#ffffff_100%),linear-gradient(180deg,#ffffff_0%,rgba(255,255,255,0)_10%,rgba(255,255,255,0)_76%,#ffffff_100%)]" />
      </div>

      <div className="pointer-events-none absolute -bottom-8 -left-5 hidden h-[210px] w-[150px] overflow-hidden md:block">
        <Image
          src="/home assets/Heritage Banner.webp"
          alt=""
          fill
          sizes="150px"
          className="object-cover object-left opacity-[0.42] grayscale contrast-[1.35] brightness-[1.04] mix-blend-multiply"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0)_64%,#ffffff_100%),linear-gradient(180deg,#ffffff_0%,rgba(255,255,255,0)_14%,rgba(255,255,255,0)_72%,#ffffff_100%)]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1300px] px-5 sm:px-0">
        <div className="text-center">
          <span className="mx-auto block h-px w-[120px] bg-primary" />
          <TextReveal delay={80}>
            <p className="mt-5 text-description font-medium uppercase text-primary">
              Why Choose Us
            </p>
          </TextReveal>
          <TextReveal delay={200}>
            <h2 className="mt-1 font-heading text-[34px] font-bold leading-none text-secondary sm:text-[40px] lg:text-title">
              A Deeper Discovery
            </h2>
          </TextReveal>
        </div>

        <div className="mt-14 grid gap-y-10 sm:grid-cols-2 lg:mt-20 lg:grid-cols-5 lg:gap-y-0">
          {whyChooseUsFeatures.map((feature, index) => (
            <article
              key={feature.title}
              className="relative flex flex-col items-center px-5 text-center"
            >
              {index < whyChooseUsFeatures.length - 1 ? (
                <span className="pointer-events-none absolute right-0 top-0 hidden h-full w-px bg-border lg:block">
                  <span className="absolute -top-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-border" />
                </span>
              ) : null}

              <div className="relative size-[74px]">
                <Image
                  src={feature.icon}
                  alt=""
                  fill
                  sizes="74px"
                  className="object-contain"
                />
              </div>

              <TextReveal delay={120 + index * 70}>
                <h3 className="mt-5 min-h-[46px] max-w-[240px] font-sans text-[16px] font-normal leading-[1.35] text-secondary lg:max-w-[190px]">
                  {feature.title}
                </h3>
                <p className="mt-4 max-w-[240px] text-[13px] italic leading-[1.25] text-secondary/75 lg:max-w-[190px]">
                  {feature.description}
                </p>
              </TextReveal>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
