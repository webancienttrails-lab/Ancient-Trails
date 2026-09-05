"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  BookOpen,
  Camera,
  Compass,
  GraduationCap,
  HeartHandshake,
  Landmark,
  Leaf,
  MapPin,
  Mountain,
  Palette,
  Route,
  Sparkles,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import { Button, ButtonArrow } from "@/components/ui/button";



type HighlightItem = {
  title: string;
  icon: LucideIcon;
};

type SpecialisedInterest = {
  title: string;
  description: string;
  image: string;
  icon: LucideIcon;
  heightClass: string;
  imagePosition?: string;
};

type TourFormat = {
  title: string;
  description: string;
  image: string;
  label: string;
};

type Testimonial = {
  quote: string;
  name: string;
  meta: string;
  image: string;
};

/* -------------------------------------------------------------------------- */
/*                                STATIC DATA                                 */
/* -------------------------------------------------------------------------- */

const highlights: HighlightItem[] = [
  {
    title: "Expertly Curated Itineraries",
    icon: BookOpen,
  },
  {
    title: "Small Groups, Greater Experiences",
    icon: Users,
  },
  {
    title: "Authentic & Immersive Travel",
    icon: Compass,
  },
  {
    title: "Guides with Local Knowledge",
    icon: MapPin,
  },
  {
    title: "Meaningful Cultural Encounters",
    icon: HeartHandshake,
  },
];

const specialisedInterests: SpecialisedInterest[] = [
  {
    title: "Children & School Groups",
    description:
      "Learning-led journeys designed around stories, monuments, activities and discovery.",
    image: "/home assets/destination/Hampi.webp",
    icon: GraduationCap,
    heightClass: "h-[390px]",
    imagePosition: "object-center",
  },
  {
    title: "Artists & Sketchers",
    description:
      "Slow, observational journeys through architecture, landscapes, crafts and local life.",
    image: "/home assets/destination/Udaipur.webp",
    icon: Palette,
    heightClass: "h-[305px]",
    imagePosition: "object-center",
  },
  {
    title: "Dance & Performance Groups",
    description:
      "Cultural journeys created around performance traditions, temples and regional arts.",
    image: "/home assets/Khajuraho.webp",
    icon: Sparkles,
    heightClass: "h-[355px]",
    imagePosition: "object-center",
  },
  {
    title: "Photography Tours",
    description:
      "Journeys planned around light, landscapes, architecture, people and visual storytelling.",
    image: "/home assets/destination/Varanasi.webp",
    icon: Camera,
    heightClass: "h-[430px]",
    imagePosition: "object-center",
  },
  {
    title: "Heritage & History Groups",
    description:
      "Expert-led explorations that bring monuments, dynasties and forgotten stories alive.",
    image: "/home assets/Caves.webp",
    icon: Landmark,
    heightClass: "h-[335px]",
    imagePosition: "object-center",
  },
  {
    title: "Food & Culinary Groups",
    description:
      "Explore regional cuisine through local kitchens, markets and food traditions.",
    image: "/home assets/Vietnam.webp",
    icon: UtensilsCrossed,
    heightClass: "h-[285px]",
    imagePosition: "object-center",
  },
  {
    title: "Spiritual Journeys",
    description:
      "Meaningful journeys through sacred landscapes, temples and living traditions.",
    image: "/home assets/Khajuraho.webp",
    icon: HeartHandshake,
    heightClass: "h-[390px]",
    imagePosition: "object-center",
  },
  {
    title: "Nature & Wildlife Enthusiasts",
    description:
      "Immersive experiences shaped around landscapes, forests and natural heritage.",
    image: "/home assets/destination/Vietnam.webp",
    icon: Leaf,
    heightClass: "h-[320px]",
    imagePosition: "object-center",
  },
  {
    title: "Architecture & Archaeology",
    description:
      "Deeper explorations of temples, ruins, settlements and architectural traditions.",
    image: "/home assets/Khajuraho.webp",
    icon: Landmark,
    heightClass: "h-[370px]",
    imagePosition: "object-center",
  },
  {
    title: "Adventure & Offbeat Groups",
    description:
      "Purposeful journeys beyond the obvious, combining discovery, nature and culture.",
    image: "/home assets/destination/North_d.webp",
    icon: Mountain,
    heightClass: "h-[300px]",
    imagePosition: "object-center",
  },
  {
    title: "Artisan & Craft Trails",
    description:
      "Meet makers, craftspeople and communities preserving India's creative traditions.",
    image: "/home assets/Egypt.webp",
    icon: Palette,
    heightClass: "h-[365px]",
    imagePosition: "object-center",
  },
  {
    title: "Curator-Led Private Groups",
    description:
      "Focused journeys shaped around a group's interests, pace and learning goals.",
    image: "/home assets/About_trails.webp",
    icon: Route,
    heightClass: "h-[325px]",
    imagePosition: "object-center",
  },
];

const processItems = [
  {
    number: "01",
    title: "Understand Your Group",
    description:
      "We understand who is travelling, their interests, purpose, age group and preferred pace.",
    icon: Users,
  },
  {
    number: "02",
    title: "Curate the Experience",
    description:
      "Our team designs the route, places, experts and experiences around your central theme.",
    icon: BookOpen,
  },
  {
    number: "03",
    title: "Add Expert-Led Depth",
    description:
      "Historians, artists, storytellers and local specialists add context to the journey.",
    icon: Compass,
  },
  {
    number: "04",
    title: "Travel Your Way",
    description:
      "Timing, pace, accommodation and experiences can be adjusted to suit your group.",
    icon: Route,
  },
];

const tourFormats: TourFormat[] = [
  {
    title: "School Heritage Tours",
    description:
      "Educational travel designed for schools, students and learning institutions.",
    image: "/home assets/destination/Hampi.webp",
    label: "Children",
  },
  {
    title: "Artist Residencies & Sketch Walks",
    description:
      "Time, space and inspiration for artists to observe, sketch and create.",
    image: "/home assets/destination/Udaipur.webp",
    label: "Artists",
  },
  {
    title: "Dance Heritage Immersions",
    description:
      "Explore India's performing traditions within their cultural and historical setting.",
    image: "/home assets/Khajuraho.webp",
    label: "Dance",
  },
  {
    title: "Photography Expeditions",
    description:
      "Explore people, architecture and landscapes through a photographer's lens.",
    image: "/home assets/destination/Varanasi.webp",
    label: "Photography",
  },
  {
    title: "Cultural Interest Groups",
    description:
      "Special journeys for clubs, institutions and communities sharing common interests.",
    image: "/home assets/Caves.webp",
    label: "Culture",
  },
  {
    title: "Private Curator-Led Journeys",
    description:
      "Focused travel experiences created around one subject, theme or area of study.",
    image: "/home assets/About_trails.webp",
    label: "Private Groups",
  },
];

const testimonials: Testimonial[] = [
  {
    quote:
      "The heritage journey was engaging, thoughtful and beautifully planned. The students experienced history far beyond the classroom.",
    name: "Priya Sharma",
    meta: "School Group",
    image: "/home assets/destination/Hampi.webp",
  },
  {
    quote:
      "Travelling as an artist gave me the time to observe, sketch and understand places at a completely different pace.",
    name: "Arjun Menon",
    meta: "Artist & Illustrator",
    image: "/home assets/destination/Udaipur.webp",
  },
  {
    quote:
      "The photography experience helped us look beyond monuments and understand the people, details and stories behind each place.",
    name: "Riya Mehta",
    meta: "Photography Group",
    image: "/home assets/destination/Varanasi.webp",
  },
];

/* -------------------------------------------------------------------------- */
/*                                   PAGE                                     */
/* -------------------------------------------------------------------------- */

export function SpecialisedTourPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <HeroSection />
      <HighlightsSection />
      <SpecialisedInterestsSection />
      <HowItWorksSection />
      <TourFormatsSection />
      <TestimonialsSection />
      <PlanSpecialisedTourSection />
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   HERO                                     */
/* -------------------------------------------------------------------------- */

function HeroSection() {
  return (
    <section className="relative h-[100svh] min-h-[650px] overflow-visible bg-background lg:h-[80vh] lg:min-h-[690px]">
      <Image
        src="/home assets/Caves.webp"
        alt="Ancient Indian temple landscape"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.93)_27%,rgba(255,255,255,0.64)_46%,rgba(255,255,255,0.12)_70%,rgba(255,255,255,0)_100%)]" />

      <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.98)_100%)]" />

      <div className="relative z-20 mx-auto flex h-full w-full max-w-[1300px] flex-col px-5 py-[clamp(1rem,4vh,2.25rem)] sm:px-0">
        <Header />

        <div className="flex min-h-0 flex-1 items-center px-0 pb-[100px] pt-[clamp(1rem,4vh,4rem)] sm:px-6 lg:px-10">
          <div className="max-w-[540px]">
            <p className="mb-3 font-sans text-eyebrow font-medium uppercase tracking-normal text-primary">
              Journeys With A Purpose
            </p>

            <h1 className="font-heading text-title font-bold leading-[0.92] tracking-normal text-secondary sm:text-[64px] lg:text-[76px]">
              Specialised
              <span className="block text-primary">Tours</span>
            </h1>

            <span className="mt-6 block h-px w-16 bg-primary" />

            <p className="mt-6 max-w-[470px] font-sans text-description leading-[1.6] text-secondary/80">
              Unique themes. Curated experiences. A deeper India.
            </p>

            <p className="mt-3 max-w-[500px] font-sans text-description leading-[1.6] text-secondary/76">
              Whether you are a student, artist, dancer, photographer or simply
              a curious traveller, Ancient Trails can design a meaningful
              journey around what inspires you.
            </p>

            <Button
              nativeButton={false}
              render={<Link href="/tours" />}
              className="mt-7 h-11 w-full min-w-0 justify-between gap-5 px-5 text-[15px] font-normal sm:w-auto sm:px-6 lg:min-w-[210px]"
            >
              Find Your Journey
              <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
            </Button>
          </div>

          <div className="pointer-events-none absolute bottom-[125px] right-8 hidden lg:block xl:right-16">
            <div className="text-right">
              <p className="-rotate-6 font-heading text-[42px] italic leading-[0.9] text-white drop-shadow-md">
                Travel
                <span className="block">Deeper</span>
              </p>

              <p className="mt-3 font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-white">
                Discover Differently
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                               HIGHLIGHTS                                   */
/* -------------------------------------------------------------------------- */

function HighlightsSection() {
  return (
    <section className="relative z-20 bg-background px-5 sm:px-0">
      <div className="mx-auto grid w-full max-w-[1300px] overflow-hidden bg-background sm:grid-cols-2 lg:grid-cols-5">
        {highlights.map(({ title, icon: Icon }, index) => (
          <article
            key={title}
            className={`relative flex min-h-[128px] flex-col items-center justify-center px-5 py-6 text-center ${
              index > 0
                ? "border-t border-border sm:border-l sm:border-t-0"
                : ""
            }`}
          >
            <Icon className="size-8 text-primary" strokeWidth={1.6} />

            <h2 className="mt-4 max-w-[165px] font-sans text-[14px] font-medium leading-[1.3] text-secondary">
              {title}
            </h2>
          </article>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                              MASONRY SECTION                               */
/* -------------------------------------------------------------------------- */

function SpecialisedInterestsSection() {
  return (
    <section
      id="specialised-tours"
      className="relative bg-background px-5 pb-16 pt-14 sm:px-8 lg:px-0 lg:pb-24 lg:pt-20"
    >
      <div className="mx-auto w-full max-w-[1220px]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-sans text-eyebrow font-medium uppercase text-primary">
              Designed Around Your Interests
            </p>

            <h2 className="mt-3 font-heading text-title font-bold leading-none text-secondary">
              Find a journey that{" "}
              <span className="text-primary">speaks to you</span>
            </h2>
          </div>

          <p className="max-w-[360px] font-sans text-description italic leading-[1.55] text-secondary/70">
            Children, artists, dancers, photographers, history lovers or
            curious explorers — every specialised tour begins with what
            inspires your group.
          </p>
        </div>

        <div className="mt-10 columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
          {specialisedInterests.map((item) => (
            <SpecialisedInterestCard key={item.title} item={item} />
          ))}
        </div>

        <div className="mt-0 flex flex-col items-center justify-between gap-5  sm:flex-row">
          <p className="max-w-[600px] font-sans text-description text-secondary/72">
            Don&apos;t see your interest here? Tell us what your group wants to
            explore and we can build the journey around it.
          </p>

          <Button
            nativeButton={false}
            render={<Link href="#plan-specialised-tour" />}
            variant="outline"
            className="h-11 w-full justify-between px-5 sm:w-auto sm:min-w-[190px]"
          >
            Plan Something Unique
            <ButtonArrow className="group-hover/button:brightness-0 group-hover/button:invert" />
          </Button>
        </div>
      </div>
    </section>
  );
}

function SpecialisedInterestCard({
  item,
}: {
  item: SpecialisedInterest;
}) {
  const Icon = item.icon;

  return (
    <article
      className={`group relative mb-4 break-inside-avoid overflow-hidden rounded-[10px] bg-secondary ${item.heightClass}`}
    >
      <Image
        src={item.image}
        alt={item.title}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        className={`object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.045] ${
          item.imagePosition || "object-center"
        }`}
      />

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,14,11,0.03)_15%,rgba(17,14,11,0.22)_47%,rgba(17,14,11,0.92)_100%)]" />

      <div className="absolute inset-x-0 bottom-0 z-10 p-5">
        <span className="grid size-10 place-items-center rounded-full border border-white/35 bg-black/20 text-white backdrop-blur-sm">
          <Icon className="size-5" strokeWidth={1.7} />
        </span>

        <h3 className="mt-4 max-w-[240px] font-heading text-[25px] font-bold leading-[1.02] text-white">
          {item.title}
        </h3>

        <p className="mt-3 max-w-[250px] font-sans text-[13px] leading-[1.45] text-white/80">
          {item.description}
        </p>

        <span className="mt-4 inline-flex rounded-full border border-white/40 bg-white/10 px-3 py-1.5 font-sans text-[11px] font-medium text-white backdrop-blur">
          Curated on request
        </span>
      </div>
    </article>
  );
}



function FeaturePoint({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="size-5 shrink-0 text-primary" strokeWidth={1.7} />

      <span className="font-sans text-[13px] font-medium text-secondary">
        {label}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              HOW IT WORKS                                  */
/* -------------------------------------------------------------------------- */

function HowItWorksSection() {
  return (
    <section className="bg-background px-5 py-16 sm:px-8 lg:px-0 lg:py-20">
      <div className="mx-auto w-full max-w-[1220px]">
        <div className="text-center">
          <p className="font-sans text-eyebrow font-medium uppercase text-primary">
            How Our Tours Come To Life
          </p>

          <h2 className="mt-3 font-heading text-title font-bold leading-none text-secondary">
            How Specialised Tours Work
          </h2>

          <p className="mx-auto mt-4 max-w-[560px] font-sans text-description leading-[1.55] text-secondary/70">
            You bring the interest. We turn it into a meaningful travel
            experience.
          </p>
        </div>

        <div className="relative mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <span className="absolute left-[12%] right-[12%] top-[37px] hidden border-t border-dashed border-primary/30 lg:block" />

          {processItems.map(
            ({ number, title, description, icon: Icon }) => (
              <article
                key={number}
                className="relative z-10 flex flex-col items-center text-center"
              >
                <div className="grid size-[74px] place-items-center rounded-full border border-primary/25 bg-background text-primary shadow-[0_10px_30px_rgba(80,50,25,0.06)]">
                  <Icon className="size-7" strokeWidth={1.6} />
                </div>

                <span className="mt-4 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/65">
                  Step {number}
                </span>

                <h3 className="mt-2 font-sans text-[16px] font-semibold text-secondary">
                  {title}
                </h3>

                <p className="mt-3 max-w-[230px] font-sans text-[13px] leading-[1.55] text-secondary/68">
                  {description}
                </p>
              </article>
            )
          )}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                               TOUR FORMATS                                 */
/* -------------------------------------------------------------------------- */

function TourFormatsSection() {
  return (
    <section className="bg-[#fff8f1] px-5 py-16 sm:px-8 lg:px-0 lg:py-20">
      <div className="mx-auto w-full max-w-[1220px]">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-sans text-eyebrow font-medium uppercase text-primary">
              Popular Specialised Formats
            </p>

            <h2 className="mt-3 font-heading text-title font-bold leading-none text-secondary">
              Tailored Formats.{" "}
              <span className="text-primary">Unique Experiences.</span>
            </h2>
          </div>

          <p className="max-w-[340px] font-sans text-description italic leading-[1.55] text-secondary/68">
            These are examples of journeys Ancient Trails can curate — not
            fixed packages or separate tour pages.
          </p>
        </div>

        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tourFormats.map((format) => (
            <TourFormatCard key={format.title} format={format} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TourFormatCard({
  format,
}: {
  format: TourFormat;
}) {
  return (
    <article className="group overflow-hidden rounded-[10px] border border-primary/15 bg-white shadow-[0_12px_34px_rgba(80,50,25,0.05)]">
      <div className="relative h-[205px] overflow-hidden">
        <Image
          src={format.image}
          alt={format.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.035]"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
          {format.label}
        </span>
      </div>

      <div className="p-5">
        <h3 className="font-heading text-[22px] font-bold leading-[1.05] text-secondary">
          {format.title}
        </h3>

        <p className="mt-3 min-h-[62px] font-sans text-[13px] leading-[1.55] text-secondary/68">
          {format.description}
        </p>

        <span className="mt-5 inline-flex rounded-full bg-primary/8 px-3 py-1.5 font-sans text-[11px] font-semibold text-primary">
          Available on request
        </span>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*                              TESTIMONIALS                                  */
/* -------------------------------------------------------------------------- */

function TestimonialsSection() {
  return (
    <section className="bg-background px-5 py-16 sm:px-8 lg:px-0 lg:py-20">
      <div className="mx-auto w-full max-w-[1220px]">
        <div>
          <p className="font-sans text-eyebrow font-medium uppercase text-primary">
            Traveller Stories
          </p>

          <h2 className="mt-3 font-heading text-title font-bold leading-none text-secondary">
            Journeys That <span className="text-primary">Inspire</span>
          </h2>
        </div>

        <div className="mt-9 grid gap-4 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <TestimonialCard
              key={`${testimonial.name}-${testimonial.meta}`}
              testimonial={testimonial}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialCard({
  testimonial,
}: {
  testimonial: Testimonial;
}) {
  return (
    <article className="flex min-h-[240px] flex-col rounded-[10px] border border-primary/15 bg-white p-6 shadow-[0_12px_30px_rgba(80,50,25,0.04)]">
      <span className="font-heading text-[52px] leading-[0.7] text-primary/20">
        “
      </span>

      <p className="mt-4 flex-1 font-heading text-[18px] italic leading-[1.55] text-secondary/78">
        {testimonial.quote}
      </p>

      <div className="mt-6 flex items-center gap-3 border-t border-border pt-5">
        <div className="relative size-11 overflow-hidden rounded-full bg-muted">
          <Image
            src={testimonial.image}
            alt={testimonial.name}
            fill
            sizes="44px"
            className="object-cover"
          />
        </div>

        <div>
          <p className="font-sans text-[13px] font-semibold text-secondary">
            {testimonial.name}
          </p>

          <p className="mt-0.5 font-sans text-[11px] text-secondary/55">
            {testimonial.meta}
          </p>
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   CTA                                      */
/* -------------------------------------------------------------------------- */

function PlanSpecialisedTourSection() {
  return (
    <section
      id="plan-specialised-tour"
      className="relative overflow-hidden bg-secondary px-5 py-14 sm:px-8 lg:px-0 lg:py-16"
    >
      <Image
        src="/home assets/Heritage Banner.webp"
        alt=""
        fill
        sizes="100vw"
        aria-hidden="true"
        className="object-cover opacity-30"
      />

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(18,22,22,0.97)_0%,rgba(18,22,22,0.90)_50%,rgba(18,22,22,0.70)_100%)]" />

      <div className="relative mx-auto flex w-full max-w-[1220px] flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-[650px]">
          <p className="font-sans text-eyebrow font-medium uppercase text-white/65">
            Ready For A Meaningful Journey?
          </p>

          <h2 className="mt-3 font-heading text-title font-bold leading-none text-white">
            Let&apos;s Plan Your{" "}
            <span className="text-primary">Specialised Tour</span>
          </h2>

          <p className="mt-4 max-w-[540px] font-sans text-description leading-[1.55] text-white/70">
            Tell us about your group, interests and purpose. Our travel experts
            will help shape the right experience for you.
          </p>

          <Button
            nativeButton={false}
            render={<Link href="/contact" />}
            className="mt-7 h-11 w-full justify-between px-5 sm:w-auto sm:min-w-[180px]"
          >
            Get in Touch
            <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-5 sm:gap-8">
          <CtaBenefit
            icon={Route}
            title="Customised"
            subtitle="Itineraries"
          />

          <CtaBenefit
            icon={Compass}
            title="Expert"
            subtitle="Guidance"
          />

          <CtaBenefit
            icon={BadgeCheck}
            title="Hassle-free"
            subtitle="Planning"
          />
        </div>
      </div>
    </section>
  );
}

function CtaBenefit({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex min-w-[90px] flex-col items-center text-center">
      <span className="grid size-12 place-items-center rounded-full border border-primary/50 text-primary">
        <Icon className="size-5" strokeWidth={1.6} />
      </span>

      <p className="mt-3 font-sans text-[12px] font-semibold leading-tight text-white">
        {title}
      </p>

      <p className="font-sans text-[11px] text-white/70">
        {subtitle}
      </p>
    </div>
  );
}