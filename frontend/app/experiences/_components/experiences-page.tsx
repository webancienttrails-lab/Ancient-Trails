import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  ChevronDown,
  Globe2,
  ImageIcon,
  Landmark,
  Mountain,
  Play,
  Quote,
  Route,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import { cn } from "@/lib/utils";

type StoryCard = {
  author: string;
  image: string;
  location: string;
  quote: string;
  rating?: string;
  tour: string;
  video?: boolean;
};

const categoryItems: Array<{
  label: string;
  icon: LucideIcon;
  active?: boolean;
}> = [
  { label: "All Experiences", icon: ImageIcon, active: true },
  { label: "Heritage Tours", icon: Landmark },
  { label: "Cultural Tours", icon: BadgeCheck },
  { label: "Nature & Trails", icon: Mountain },
  { label: "Customised Tours", icon: Route },
  { label: "International Tours", icon: Globe2 },
];

const travellerStories: StoryCard[] = [
  {
    author: "Vikram Deshpande",
    image: "/home assets/destination/Hampi.webp",
    location: "Bengaluru, India",
    quote:
      "Walking through centuries old temples in Hampi was like stepping into an open-air museum.",
    tour: "Hampi & Badami Tour",
    video: true,
  },
  {
    author: "Ananya Iyer",
    image: "/home assets/destination/Udaipur.webp",
    location: "Mumbai, India",
    quote:
      "Every monument had a story and our expert made history come alive. An experience beyond sightseeing.",
    tour: "South India Temple Trail",
    video: true,
  },
  {
    author: "Rahul Mehta",
    image: "/home assets/destination/hawa-mahal.webp",
    location: "Pune, India",
    quote:
      "From majestic forts to royal traditions, Rajasthan left us mesmerized.",
    rating: "4.9",
    tour: "Rajasthan Heritage Trail",
    video: true,
  },
  {
    author: "Rohit & Sneha",
    image: "/home assets/Vietnam.webp",
    location: "Pune, India",
    quote:
      "The backwaters, the people, the peace - Kerala is pure magic.",
    tour: "Vietnam Cultural Tour",
    video: true,
  },
  {
    author: "Karan Malhotra",
    image: "/home assets/destination/North_d.webp",
    location: "Dehradun, India",
    quote:
      "The trails were scenic, the experience was raw and real. Just what I needed.",
    tour: "Ladakh Winter Trails",
    video: true,
  },
];

const voiceCards = [
  {
    author: "Meera Nair",
    location: "Kochi, India",
    quote:
      "Beautifully curated itinerary, knowledgeable guides and immersive cultural experiences. Ancient Trails truly brings heritage to life!",
  },
  {
    author: "James Anderson",
    location: "London, UK",
    quote:
      "From start to finish, the journey was seamless. The guides, the stories, the hospitality, everything was exceptional!",
  },
];

const galleryImages = [
  {
    alt: "Temple doorway framing a heritage monument",
    className: "md:row-span-2 md:h-full",
    image: "/home assets/destination/Hampi.webp",
  },
  {
    alt: "Cultural performers on a heritage tour",
    className: "h-[174px]",
    image: "/home assets/Special_Tour/Assam.png",
  },
  {
    alt: "Ancient stone chariot and temple courtyard",
    className: "h-[174px]",
    image: "/home assets/destination/Hoysalas.webp",
  },
  {
    alt: "Traveller photographing heritage architecture",
    className: "md:row-span-2 md:h-full",
    image: "/home assets/Special_Tour/Photograph.png",
  },
  {
    alt: "Travellers walking through misty hills",
    className: "h-[174px]",
    image: "/home assets/destination/North_d.webp",
  },
  {
    alt: "Boat journey through calm green waters",
    className: "h-[174px]",
    image: "/home assets/Vietnam.webp",
  },
  {
    alt: "Sunlit temple complex",
    className: "h-[108px] md:col-span-2",
    image: "/home assets/Khajuraho.webp",
  },
];

const stats: Array<{
  icon: LucideIcon;
  label: string;
  value: string;
}> = [
  { icon: Users, label: "Happy Travellers", value: "25,000+" },
  { icon: Briefcase, label: "Curated Tours", value: "150+" },
  { icon: BadgeCheck, label: "Years of Experience", value: "12+" },
  { icon: Globe2, label: "Countries Explored", value: "20+" },
  { icon: Star, label: "Traveller Rating", value: "4.9/5" },
];

const instagramImages = [
  "/home assets/destination/Hampi.webp",
  "/home assets/Egypt.webp",
  "/home assets/destination/Udaipur.webp",
  "/home assets/destination/North_d.webp",
  "/home assets/destination/Varanasi.webp",
  "/home assets/Indonesia.webp",
  "/home assets/Special_Tour/Sketching.png",
];

function HeaderBand() {
  return (
    <section className="relative h-[200px] overflow-hidden bg-secondary">
      <Image
        src="/home assets/Heritage Banner.webp"
        alt="Ancient Trails heritage landscape"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(35,18,9,0.12)_0%,rgba(35,18,9,0.34)_100%)]" />
      <div className="relative z-10 mx-auto w-full max-w-[1300px] px-5 sm:px-0">
        <Header />
      </div>
    </section>
  );
}

export function ExperiencesPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-secondary">
      <HeaderBand />
      <CategoryStrip />
      <TravellerStoriesSection />
      <VoicesSection />
      <GallerySection />
      <StatsBand />
      <JourneyCta />
      <InstagramSection />
    </main>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-[500px] overflow-hidden bg-[#fff8f0]">
      <Image
        src="/home assets/Heritage Banner.webp"
        alt="Sunset over ancient Indian temple architecture"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,248,240,0.98)_0%,rgba(255,248,240,0.9)_29%,rgba(255,248,240,0.38)_58%,rgba(255,248,240,0)_100%)]" />
      <div className="absolute inset-y-0 left-0 w-[38%] bg-[url('/home%20assets/About_trails.webp')] bg-contain bg-left-bottom bg-no-repeat opacity-[0.13] mix-blend-multiply" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,rgba(255,248,240,0)_0%,#fff8f0_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-[500px] w-full max-w-[1300px] flex-col px-5 py-[clamp(1rem,4vh,2.25rem)] sm:px-0">
        <HeaderBand />

        <div className="flex flex-1 items-center px-0 pb-20 pt-8 sm:px-8">
          <div className="max-w-[520px]">
            <div className="flex items-center gap-2 font-sans text-[13px] font-semibold text-primary">
              <Link href="/" className="transition-colors hover:text-accent">
                Home
              </Link>
              <span aria-hidden="true">&gt;</span>
              <span>Experiences</span>
            </div>
            <h1 className="mt-4 font-heading text-[42px] font-bold leading-[1.02] tracking-normal text-secondary sm:text-[58px] lg:text-[68px]">
              Experiences
              <span className="block">
                that stay with <span className="text-primary">you.</span>
              </span>
            </h1>
            <span className="mt-6 block h-px w-16 bg-primary" />
            <p className="mt-6 max-w-[430px] font-sans text-[14px] leading-[1.75] text-secondary/78 sm:text-[15px]">
              Real stories from real travellers. Moments of wonder, connection
              and discovery across India&apos;s timeless heritage.
            </p>
            <Link
              href="/#contact"
              className="mt-7 inline-flex h-11 items-center gap-4 rounded-[8px] bg-primary px-6 font-sans text-[13px] font-bold text-white shadow-[0_14px_32px_rgba(212,114,32,0.28)] transition-colors hover:bg-accent"
            >
              Share Your Experience
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function CategoryStrip() {
  return (
    <section className="relative z-20 mx-auto -mt-12 w-full max-w-[1110px] px-5 sm:px-8 lg:px-0">
      <div className="grid overflow-hidden rounded-[8px] border border-white/80 bg-white/95 shadow-[0_18px_55px_rgba(67,43,27,0.13)] backdrop-blur sm:grid-cols-2 lg:grid-cols-6">
        {categoryItems.map(({ active = false, icon: Icon, label }, index) => (
          <button
            key={label}
            type="button"
            className={cn(
              "group flex min-h-[98px] flex-col items-center justify-center gap-2 border-t border-[#ead8c5] px-3 text-center font-sans text-[12px] font-semibold transition-colors first:border-t-0 sm:[&:nth-child(-n+2)]:border-t-0 lg:border-l lg:border-t-0 lg:first:border-l-0",
              active
                ? "bg-[#fff1e5] text-primary"
                : "bg-white text-secondary hover:bg-[#fff7ef] hover:text-primary",
              index === 0 && "lg:border-l-0"
            )}
          >
            <Icon className="size-8 text-primary" strokeWidth={1.55} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function TravellerStoriesSection() {
  return (
    <section className="mx-auto w-full max-w-[1300px] px-5 pb-10 pt-12 sm:px-8 lg:px-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          eyebrow="Traveller Stories"
          title="Stories from our travellers"
        />
        <button
          type="button"
          className="inline-flex h-10 w-fit items-center gap-4 rounded-[7px] border border-[#ead8c5] bg-white px-5 font-sans text-[12px] font-semibold text-secondary shadow-[0_8px_18px_rgba(67,43,27,0.05)] transition-colors hover:border-primary hover:text-primary"
        >
          Most Recent
          <ChevronDown className="size-4 text-primary" />
        </button>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {travellerStories.map((story, index) => (
          <ExperienceStoryCard
            key={story.author}
            featuredDark={index === 2}
            story={story}
          />
        ))}
      </div>

      <div className="mt-6 flex justify-center">
        <Link
          href="/blog"
          className="inline-flex h-10 min-w-[190px] items-center justify-center gap-4 rounded-[8px] border border-primary bg-white px-5 font-sans text-[13px] font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
        >
          View More Stories
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}

function ExperienceStoryCard({
  featuredDark = false,
  story,
}: {
  featuredDark?: boolean;
  story: StoryCard;
}) {
  if (featuredDark) {
    return (
      <article className="group relative min-h-[406px] overflow-hidden rounded-[8px] bg-secondary text-white shadow-[0_16px_38px_rgba(67,43,27,0.12)]">
        <Image
          src={story.image}
          alt={story.tour}
          fill
          sizes="(min-width: 1024px) 240px, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,13,10,0.12)_0%,rgba(17,13,10,0.94)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="flex items-center gap-2 font-sans text-[10px] font-bold uppercase tracking-normal text-primary">
            <span className="size-1.5 rounded-full bg-primary" />
            Video Story
          </p>
          <h3 className="mt-3 font-heading text-[21px] font-bold leading-tight">
            {story.tour}
          </h3>
          <p className="mt-2 line-clamp-3 font-sans text-[13px] leading-[1.6] text-white/84">
            {story.quote}
          </p>
          <StoryAuthor story={story} dark />
          <div className="mt-3 flex items-center justify-end gap-1">
            {Array.from({ length: 5 }).map((_item, index) => (
              <Star
                key={index}
                className="size-3.5 fill-primary text-primary"
                strokeWidth={0}
              />
            ))}
            <span className="ml-2 font-sans text-[12px] text-white/78">
              {story.rating}
            </span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="overflow-hidden rounded-[8px] border border-[#ead8c5] bg-white shadow-[0_14px_35px_rgba(67,43,27,0.07)]">
      <div className="relative h-[178px] overflow-hidden bg-muted">
        <Image
          src={story.image}
          alt={story.tour}
          fill
          sizes="(min-width: 1024px) 240px, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 hover:scale-105"
        />
        {story.video ? <PlayButton /> : null}
      </div>
      <div className="p-5">
        <Quote className="size-5 fill-primary text-primary" strokeWidth={0} />
        <p className="mt-3 min-h-[96px] font-sans text-[13px] leading-[1.65] text-secondary/84">
          {story.quote}
        </p>
        <StoryAuthor story={story} />
        <Link
          href="/#upcoming-tours"
          className="mt-4 block truncate font-sans text-[12px] font-semibold text-primary transition-colors hover:text-accent"
        >
          {story.tour}
        </Link>
      </div>
    </article>
  );
}

function StoryAuthor({ dark = false, story }: { dark?: boolean; story: StoryCard }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full font-sans text-[10px] font-bold",
          dark ? "bg-white text-primary" : "bg-secondary text-white"
        )}
      >
        {story.author
          .split(" ")
          .map((part) => part[0])
          .join("")
          .slice(0, 2)}
      </span>
      <span className="min-w-0 font-sans">
        <span
          className={cn(
            "block truncate text-[11px] font-bold",
            dark ? "text-white" : "text-secondary"
          )}
        >
          {story.author}
        </span>
        <span
          className={cn(
            "block truncate text-[10px]",
            dark ? "text-white/68" : "text-secondary/55"
          )}
        >
          {story.location}
        </span>
      </span>
    </div>
  );
}

function VoicesSection() {
  return (
    <section className="mx-auto w-full max-w-[1300px] px-5 py-8 sm:px-8 lg:px-0">
      <div className="grid gap-5 rounded-[8px] border border-[#ead8c5] bg-white/76 p-5 shadow-[0_16px_42px_rgba(67,43,27,0.07)] md:grid-cols-[0.8fr_1.15fr_0.85fr_0.85fr]">
        <div className="relative overflow-hidden rounded-[8px] p-1">
          <Image
            src="/home assets/About_trails.webp"
            alt=""
            fill
            sizes="260px"
            aria-hidden="true"
            className="pointer-events-none translate-y-20 object-cover object-left-bottom opacity-[0.13] mix-blend-multiply"
          />
          <div className="relative">
            <SectionHeading
              eyebrow="Travellers Speak"
              title="Voices that inspire others"
              compact
            />
            <p className="mt-4 max-w-[230px] font-sans text-[12px] leading-[1.75] text-secondary/78">
              Hear from our travellers who found meaning, joy and unforgettable
              memories on their journeys.
            </p>
          </div>
        </div>

        <article className="relative min-h-[272px] overflow-hidden rounded-[8px] bg-muted">
          <Image
            src="/home assets/Special_Tour/Photograph.png"
            alt="Travellers sharing stories on a heritage trail"
            fill
            sizes="(min-width: 1024px) 420px, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,13,10,0)_0%,rgba(17,13,10,0.54)_100%)]" />
          <button
            type="button"
            aria-label="Play real traveller stories"
            className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/85 bg-white/18 text-white backdrop-blur transition-colors hover:bg-primary"
          >
            <Play className="ml-1 size-7 fill-current" strokeWidth={0} />
          </button>
          <p className="absolute bottom-5 left-5 flex items-center gap-2 font-sans text-[12px] font-semibold text-white">
            <span className="size-2 rounded-full bg-primary" />
            Watch real stories
          </p>
        </article>

        {voiceCards.map((voice) => (
          <VoiceCard key={voice.author} voice={voice} />
        ))}

        <div className="flex items-center justify-center gap-2 md:col-span-4">
          {[0, 1, 2, 3].map((dot) => (
            <span
              key={dot}
              className={cn(
                "size-2 rounded-full",
                dot === 0 ? "bg-primary" : "bg-[#ead8c5]"
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function VoiceCard({
  voice,
}: {
  voice: (typeof voiceCards)[number];
}) {
  return (
    <article className="rounded-[8px] border border-[#ead8c5] bg-white p-5 shadow-[0_12px_30px_rgba(67,43,27,0.06)]">
      <Quote className="size-8 fill-primary text-primary" strokeWidth={0} />
      <p className="mt-4 min-h-[120px] font-sans text-[13px] leading-[1.65] text-secondary/84">
        {voice.quote}
      </p>
      <StoryAuthor
        story={{
          author: voice.author,
          image: "",
          location: voice.location,
          quote: voice.quote,
          tour: "",
        }}
      />
      <div className="mt-4 flex items-center gap-1">
        {Array.from({ length: 5 }).map((_item, index) => (
          <Star
            key={index}
            className="size-3.5 fill-primary text-primary"
            strokeWidth={0}
          />
        ))}
        <span className="ml-2 font-sans text-[12px] font-semibold text-secondary/70">
          5.0
        </span>
      </div>
    </article>
  );
}

function GallerySection() {
  return (
    <section className="mx-auto w-full max-w-[1300px] px-5 py-8 sm:px-8 lg:px-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          eyebrow="Experiences In Pictures"
          title="Captured on the trail"
          subtitle="Snapshots of moments, places and people."
        />
        <Link
          href="/blog"
          className="inline-flex h-10 w-fit items-center gap-4 rounded-[8px] border border-primary bg-white px-5 font-sans text-[12px] font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
        >
          View Full Gallery
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="mt-6 grid auto-rows-[174px] gap-3 md:grid-cols-4">
        {galleryImages.map((item) => (
          <article
            key={item.alt}
            className={cn(
              "relative h-[230px] overflow-hidden rounded-[8px] bg-muted md:h-auto",
              item.className
            )}
          >
            <Image
              src={item.image}
              alt={item.alt}
              fill
              sizes="(min-width: 1024px) 320px, (min-width: 768px) 25vw, 100vw"
              className="object-cover transition-transform duration-700 hover:scale-105"
            />
          </article>
        ))}
      </div>
    </section>
  );
}

function StatsBand() {
  return (
    <section className="mx-auto w-full max-w-[1300px] px-5 py-3 sm:px-8 lg:px-0">
      <div className="grid overflow-hidden rounded-[8px] bg-secondary text-white shadow-[0_18px_44px_rgba(35,23,15,0.18)] sm:grid-cols-2 lg:grid-cols-5">
        {stats.map(({ icon: Icon, label, value }, index) => (
          <article
            key={label}
            className={cn(
              "flex min-h-[96px] items-center justify-center gap-4 px-5 py-5",
              index > 0 && "border-t border-primary/28 sm:border-l sm:border-t-0"
            )}
          >
            <Icon className="size-9 text-primary" strokeWidth={1.5} />
            <span>
              <strong className="block font-heading text-[27px] leading-none text-white">
                {value}
              </strong>
              <span className="mt-1 block font-sans text-[11px] leading-tight text-white/72">
                {label}
              </span>
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

function JourneyCta() {
  return (
    <section className="mx-auto w-full max-w-[1300px] px-5 py-8 sm:px-8 lg:px-0">
      <div className="relative grid min-h-[176px] overflow-hidden rounded-[8px] border border-[#ead8c5] bg-white/80 p-6 shadow-[0_14px_36px_rgba(67,43,27,0.06)] sm:grid-cols-[1fr_1.2fr_1fr] sm:items-center lg:p-8">
        <Image
          src="/home assets/About_trails.webp"
          alt=""
          fill
          sizes="420px"
          aria-hidden="true"
          className="pointer-events-none -translate-x-[33%] object-contain object-left-bottom opacity-[0.16] mix-blend-multiply"
        />
        <div className="hidden sm:block" />
        <div className="relative text-center">
          <p className="font-heading text-[20px] leading-tight text-secondary">
            Every journey has a story.
          </p>
          <h2 className="mt-2 font-heading text-[34px] font-bold leading-none text-secondary sm:text-[42px]">
            What will yours be?
          </h2>
          <p className="mt-4 font-sans text-[13px] text-secondary/78">
            Let our experts craft a meaningful experience for you.
          </p>
        </div>
        <div className="relative mt-6 flex justify-center sm:mt-0 sm:justify-end">
          <Link
            href="/#contact"
            className="inline-flex h-11 items-center gap-4 rounded-[8px] bg-primary px-6 font-sans text-[13px] font-bold text-white shadow-[0_12px_28px_rgba(212,114,32,0.24)] transition-colors hover:bg-accent"
          >
            Plan Your Journey
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function InstagramSection() {
  return (
    <section className="mx-auto w-full max-w-[1300px] px-5 pb-9 pt-3 sm:px-8 lg:px-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          eyebrow="Follow Our Journeys"
          title="On Instagram"
          compact
        />
        <div className="flex items-center gap-4 font-sans text-[12px] font-semibold text-secondary/76">
          <span>@ancienttrailsindia</span>
          <Link
            href="https://www.instagram.com/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-3 rounded-[8px] border border-primary bg-white px-4 text-primary transition-colors hover:bg-primary hover:text-white"
          >
            Follow Us
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
        {instagramImages.map((image, index) => (
          <article
            key={`${image}-${index}`}
            className="relative aspect-[1.12/1] overflow-hidden rounded-[8px] bg-muted"
          >
            <Image
              src={image}
              alt="Ancient Trails Instagram memory"
              fill
              sizes="(min-width: 1024px) 170px, (min-width: 640px) 25vw, 50vw"
              className="object-cover transition-transform duration-700 hover:scale-105"
            />
          </article>
        ))}
      </div>
    </section>
  );
}

function SectionHeading({
  compact = false,
  eyebrow,
  subtitle,
  title,
}: {
  compact?: boolean;
  eyebrow: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <div>
      <p className="font-sans text-[11px] font-bold uppercase tracking-normal text-primary">
        {eyebrow}
      </p>
      <h2
        className={cn(
          "mt-2 font-heading font-bold leading-tight text-secondary",
          compact ? "text-[28px]" : "text-[34px] sm:text-[38px]"
        )}
      >
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-1 font-sans text-[12px] text-secondary/70">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function PlayButton() {
  return (
    <button
      type="button"
      aria-label="Play traveller story"
      className="absolute bottom-5 left-5 grid size-8 place-items-center rounded-full bg-white text-secondary shadow-[0_10px_20px_rgba(35,23,15,0.2)] transition-colors hover:bg-primary hover:text-white"
    >
      <Play className="ml-0.5 size-4 fill-current" strokeWidth={0} />
    </button>
  );
}
