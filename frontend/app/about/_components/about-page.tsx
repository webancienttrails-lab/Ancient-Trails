"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Leaf,
  MapPin,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import { Button, ButtonArrow } from "@/components/ui/button";
import {
  getAboutMediaUrl,
  getAboutPageContent,
  type AboutPageContent as AboutPageContentType,
  type AboutTeamMember,
} from "@/lib/about";
import {
  listPublicExperts,
  type PublicExpert,
} from "@/lib/home-travel";
import { getExpertHref } from "@/lib/routes";

const statValueFormatter = new Intl.NumberFormat("en-IN");

const valueItems = [
  {
    title: "Authentic Experiences",
    description:
      "Handpicked journeys that connect you with real culture and local stories.",
    icon: SlidersHorizontal,
  },
  {
    title: "Expertly Curated",
    description:
      "Designed by heritage experts and local specialists with deep knowledge.",
    icon: BookOpen,
  },
  {
    title: "Responsible Travel",
    description:
      "We promote sustainable tourism and support local communities we visit.",
    icon: Leaf,
  },
  {
    title: "Trusted by Thousands",
    description:
      "Loved by 25,000+ travellers for our quality and commitment.",
    icon: Users,
  },
  {
    title: "Personalised Support",
    description:
      "We're with you at every step for a smooth and worry-free experience.",
    icon: CalendarDays,
  },
  {
    title: "Wide Network, Local Roots",
    description:
      "Strong local partnerships across India for truly immersive journeys.",
    icon: MapPin,
  },
];



function getSortedStats(content: AboutPageContentType | null) {
  return [...(content?.stats || [])].sort(
    (left, right) => left.sortOrder - right.sortOrder
  );
}

function getSortedTeam(content: AboutPageContentType | null) {
  return [...(content?.teamMembers || [])].sort(
    (left, right) => left.sortOrder - right.sortOrder
  );
}

function getFounder(teamMembers: AboutTeamMember[]) {
  return (
    teamMembers.find((member) => /founder/i.test(member.role)) ||
    teamMembers[0] ||
    null
  );
}

function normalizeProfileName(name: string) {
  return name
    .trim()
    .replace(/^(mr|mrs|ms|dr)\.\s+/i, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function getMatchingExpert(
  member: AboutTeamMember | null,
  experts: PublicExpert[]
) {
  if (!member) {
    return null;
  }

  const memberName = normalizeProfileName(member.name);

  return (
    experts.find((expert) => normalizeProfileName(expert.fullName) === memberName) ||
    null
  );
}

function getFounderExpert(
  founder: AboutTeamMember | null,
  experts: PublicExpert[]
) {
  const matchedExpert = getMatchingExpert(founder, experts);

  if (matchedExpert) {
    return matchedExpert;
  }

  return (
    experts.find((expert) =>
      [expert.fullName, expert.fullBiography, ...expert.expertiseTags]
        .join(" ")
        .toLowerCase()
        .includes("founder")
    ) ||
    experts[0] ||
    null
  );
}

function getExpertRole(expert: PublicExpert | null, fallbackRole = "") {
  return expert?.expertiseTags[0] || fallbackRole || "Heritage Expert";
}

function getExpertBio(expert: PublicExpert | null, fallbackBio = "") {
  return expert?.fullBiography || fallbackBio;
}

function getProfileImage(
  member: AboutTeamMember | null,
  expert: PublicExpert | null
) {
  return expert?.image || member?.image || "";
}

function getProfileName(
  member: AboutTeamMember | null,
  expert: PublicExpert | null
) {
  return expert?.fullName || member?.name || "";
}

function getDisplayFounderName(name: string) {
  const trimmedName = name.trim();

  if (!trimmedName || /^(mr|mrs|ms|dr)\./i.test(trimmedName)) {
    return trimmedName;
  }

  return `Mr. ${trimmedName}`;
}

function getImageStyle(source: string) {
  const imageUrl = getAboutMediaUrl(source);

  return imageUrl
    ? {
        backgroundImage: `url("${imageUrl}")`,
      }
    : undefined;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function AboutPageContent() {
  const [content, setContent] = useState<AboutPageContentType | null>(null);
  const [experts, setExperts] = useState<PublicExpert[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadAboutContent() {
      const [aboutResult, expertsResult] = await Promise.allSettled([
        getAboutPageContent(),
        listPublicExperts(),
      ]);

      if (!isMounted) {
        return;
      }

      setContent(
        aboutResult.status === "fulfilled" ? aboutResult.value.data.about : null
      );
      setExperts(
        expertsResult.status === "fulfilled"
          ? expertsResult.value.data.experts
          : []
      );
    }

    loadAboutContent();

    return () => {
      isMounted = false;
    };
  }, []);

  const stats = useMemo(() => getSortedStats(content), [content]);
  const teamMembers = useMemo(() => getSortedTeam(content), [content]);
  const founder = useMemo(() => getFounder(teamMembers), [teamMembers]);
  const founderExpert = useMemo(
    () => getFounderExpert(founder, experts),
    [experts, founder]
  );

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <HeroSection />
      {stats.length > 0 ? <StatsSection stats={stats} /> : null}
      <MissionVisionSection />
      {founder || founderExpert ? (
        <FounderSection founder={founder} expert={founderExpert} />
      ) : null}
      {teamMembers.length > 0 ? (
        <TeamCarouselSection members={teamMembers} />
      ) : null}
      <ValuesSection />
      {experts.length > 0 ? <ExpertPeopleSection experts={experts} /> : null}
    </main>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-[500px] overflow-visible bg-background max-sm:min-h-[610px] sm:min-h-[520px] lg:min-h-[430px]">
      <Image
        src="/home assets/Caves.webp"
        alt="Indian heritage corridor and monuments"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center max-sm:object-[58%_center] lg:object-right"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#ffffff_0%,rgba(255,255,255,0.98)_24%,rgba(255,255,255,0.72)_48%,rgba(255,255,255,0.18)_68%,rgba(255,255,255,0)_100%)] max-sm:bg-[linear-gradient(180deg,#ffffff_0%,rgba(255,255,255,0.96)_42%,rgba(255,255,255,0.76)_76%,rgba(255,255,255,0.22)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,#ffffff_92%)]" />
      {/* <div className="absolute inset-y-0 left-0 w-[62%] bg-[linear-gradient(90deg,#fbf7ef_0%,rgba(251,247,239,0.94)_58%,rgba(251,247,239,0)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,rgba(251,247,239,0)_0%,#fbf7ef_100%)]" /> */}

      <div className="home-wide-frame relative z-[2147483647] mx-auto flex min-h-[500px] w-full flex-col px-5 py-[clamp(1rem,4vh,2.25rem)] max-sm:min-h-[610px] max-sm:px-4 sm:min-h-[520px] sm:px-0 lg:min-h-[430px] [@media(min-width:1300px)]:px-12">
        <Header />

        <div className="flex flex-1 items-center px-0 pb-[92px] pt-6 max-sm:items-end max-sm:pb-[82px] max-sm:pt-10 lg:pb-[86px] lg:pt-4">
          <div className="max-w-[410px] text-accent max-sm:max-w-[340px]">
            <p className="mb-[clamp(0.5rem,1.5vh,0.75rem)] text-eyebrow font-medium uppercase tracking-normal text-primary">
              About Ancient Trails
            </p>
            <h1 className="font-heading text-title font-bold leading-none tracking-normal text-secondary">
              Our Story.
              <span className="block">
                Our Passion<span className="text-primary">.</span>
              </span>
            </h1>
            <span className="mt-5 block h-px w-14 bg-accent" />
            <p className="mt-[clamp(0.75rem,3vh,1.75rem)] max-w-[380px] text-description text-accent max-sm:max-w-[320px]">
              Ancient Trails was born out of a deep love for India&apos;s
              heritage and a desire to share its timeless stories with the
              world. We curate immersive journeys that go beyond sightseeing,
              connecting you with culture, people and histories that inspire.
            </p>
            <Button
              nativeButton={false}
              render={<Link href="/tours" />}
              className="mt-7 h-11 w-full min-w-0 justify-between gap-4 px-5 text-[15px] font-normal sm:w-auto sm:gap-6 sm:px-6 sm:text-button lg:min-w-[190px]"
            >
              Explore Journeys
              <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function parseStatValue(value: string) {
  const target = Number(value.replace(/[^\d]/g, ""));
  const suffix = value.trim().endsWith("+") ? "+" : "";

  return {
    suffix,
    target: Number.isFinite(target) ? target : 0,
  };
}

function formatStatValue(value: number, suffix: string) {
  return `${statValueFormatter.format(value)}${suffix}`;
}

function CountUpValue({
  className,
  value,
}: {
  className: string;
  value: string;
}) {
  const valueRef = useRef<HTMLElement | null>(null);
  const { suffix, target } = useMemo(() => parseStatValue(value), [value]);
  const [hasStarted, setHasStarted] = useState(false);
  const [displayValue, setDisplayValue] = useState(() =>
    formatStatValue(0, suffix)
  );

  useEffect(() => {
    const element = valueRef.current;

    if (!element) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frameId = window.requestAnimationFrame(() => {
        setDisplayValue(formatStatValue(target, suffix));
      });

      return () => window.cancelAnimationFrame(frameId);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setHasStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [suffix, target]);

  useEffect(() => {
    if (!hasStarted) {
      return;
    }

    const duration = 1200;
    const startTime = window.performance.now();
    let frameId = 0;

    const animateValue = (timestamp: number) => {
      const progress = Math.min(1, (timestamp - startTime) / duration);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(target * easedProgress);

      setDisplayValue(formatStatValue(nextValue, suffix));

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animateValue);
      }
    };

    frameId = window.requestAnimationFrame(animateValue);

    return () => window.cancelAnimationFrame(frameId);
  }, [hasStarted, suffix, target]);

  return (
    <strong ref={valueRef} className={className}>
      {displayValue}
    </strong>
  );
}

function StatsSection({
  stats,
}: {
  stats: AboutPageContentType["stats"];
}) {
  return (
    <section className="home-wide-frame relative z-20 mx-auto -mt-[48px] w-full px-5 max-sm:px-4 sm:px-0 [@media(min-width:1300px)]:px-12">
      <div className="flex flex-wrap justify-center gap-4 max-sm:gap-3 lg:flex-nowrap">
        {stats.map((stat, index) => {
          return (
            <article
              key={stat.id || `${stat.label}-${index}`}
              className="relative flex min-h-[124px] w-full flex-col items-center justify-center overflow-hidden rounded-[18px] border border-[#f3e7dc] bg-white px-5 pb-7 pt-6 text-center shadow-[0_14px_34px_rgba(50,36,22,0.11)] after:absolute after:inset-x-0 after:bottom-0 after:h-[8px] after:bg-primary max-sm:min-h-[104px] max-sm:w-[calc(50%-0.375rem)] max-sm:rounded-[12px] max-sm:px-3 max-sm:pb-5 max-sm:pt-4 sm:w-[calc(50%-0.5rem)] lg:w-[clamp(210px,18vw,280px)]"
            >
              <CountUpValue
                value={stat.value}
                className="block max-w-full font-sans text-[28px] font-bold leading-none tracking-normal text-secondary max-sm:text-[24px] sm:text-[32px] lg:text-[30px] xl:text-[36px]"
              />
              <span className="mt-4 block max-w-[180px] font-sans text-[13px] font-normal leading-tight text-secondary/72 max-sm:mt-3 max-sm:text-[11px] sm:text-[14px]">
                {stat.label}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MissionVisionSection() {
  return (
    <section className="relative bg-background px-5 pb-10 pt-10 max-sm:px-4 max-sm:pt-8 sm:px-0 lg:pb-12 lg:pt-12">
      <div className="home-wide-frame relative mx-auto w-full [@media(min-width:1300px)]:px-12">
        <div className="grid items-stretch gap-7 lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] lg:gap-12">
          <StoryPanel
            title="Our Mission"
            description="To inspire meaningful journeys that promote cultural understanding, preserve heritage and empower local communities."
          />
          <span className="relative hidden w-px bg-[#eadbcb] lg:block">
            <span className="absolute left-1/2 top-1/2 grid size-5 -translate-x-1/2 -translate-y-1/2 rotate-45 place-items-center border border-primary/40 bg-background">
              <span className="size-1.5 rounded-full bg-primary/85" />
            </span>
          </span>
          <StoryPanel
            title="Our Vision"
            description="To be India's most trusted heritage travel brand, connecting the past with the present for generations to come."
          />
        </div>
      </div>
    </section>
  );
}

function StoryPanel({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <article className="flex min-h-[210px] flex-col justify-center rounded-[12px] border border-[#f3ddcd] bg-white px-7 py-8 max-sm:min-h-0 max-sm:px-5 max-sm:py-6 sm:px-9 lg:min-h-[242px] lg:px-10 xl:px-11">
      <h2 className="font-heading text-title font-bold leading-none tracking-normal text-secondary">
        {title}
      </h2>
      <span className="mt-5 block h-px w-[60px] bg-primary" />
      <p className="mt-7 max-w-[640px] font-sans text-description font-normal tracking-normal text-secondary/70 max-sm:mt-5">
        {description}
      </p>
    </article>
  );
}

function ValuesSection() {
  return (
    <section className="relative overflow-hidden bg-background px-5 pb-16 pt-10 max-sm:px-4 max-sm:pb-12 max-sm:pt-8 sm:px-0 lg:pb-20 lg:pt-14">
      <div className="home-wide-frame relative mx-auto w-full [@media(min-width:1300px)]:px-12">
        <div className="text-center">
          <span className="mx-auto block h-px w-[150px] bg-primary max-sm:w-[110px]" />
          <p className="mt-7 font-sans text-eyebrow font-medium uppercase tracking-normal text-primary max-sm:mt-5">
            Why Travel With Us?
          </p>
          <h2 className="mt-2 font-heading text-title font-bold leading-none tracking-normal text-secondary">
            Why Choose Ancient Trails
          </h2>
        </div>

        <div className="mt-16 grid gap-y-12 max-sm:mt-10 max-sm:gap-y-10 sm:grid-cols-2 lg:mt-[92px] lg:grid-cols-6 lg:gap-y-0">
          {valueItems.map(({ description, icon: Icon, title }, index) => (
            <article
              key={title}
              className="relative flex flex-col items-center px-5 text-center max-sm:px-2"
            >
              {index < valueItems.length - 1 ? (
                <span className="pointer-events-none absolute right-0 top-0 hidden h-full w-px bg-[#e9ddd4] lg:block">
                  <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-[#e1d6ce]" />
                </span>
              ) : null}

              <span className="grid size-[78px] place-items-center rounded-full border border-[#f5ddca] bg-[#fff7f1] text-primary max-sm:size-[64px]">
                <Icon className="size-8 max-sm:size-7" strokeWidth={1.8} />
              </span>
              <h3 className="mt-7 min-h-[54px] max-w-[235px] font-sans text-description font-bold leading-[1.32] tracking-normal text-secondary max-sm:mt-5 max-sm:min-h-0">
                {title}
              </h3>
              <p className="mt-5 max-w-[240px] font-sans text-description font-normal italic tracking-normal text-secondary/72 max-sm:mt-3">
                {description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FounderSection({
  expert,
  founder,
}: {
  expert: PublicExpert | null;
  founder: AboutTeamMember | null;
}) {
  const name = getProfileName(founder, expert);
  const role = getExpertRole(expert, founder?.role);
  const bio = getExpertBio(expert, founder?.bio);
  const image = getProfileImage(founder, expert);
  const tags = expert?.expertiseTags.slice(0, 4) || [];
  const displayName = getDisplayFounderName(name);

  return (
    <section className="bg-background px-5 py-8 max-sm:px-4 max-sm:py-4 sm:px-0 lg:py-9">
      <div className="home-wide-frame mx-auto w-full [@media(min-width:1300px)]:px-12">
        <div className="grid overflow-hidden rounded-[14px] border border-[#f1ddce] bg-white p-4 shadow-[0_16px_42px_rgba(50,36,22,0.06)] max-sm:p-2 lg:grid-cols-[0.39fr_0.61fr] lg:gap-5">
          <div className="relative min-h-[320px] overflow-hidden rounded-[8px] bg-muted max-sm:min-h-[210px] sm:min-h-[420px] lg:min-h-[520px]">
            {image ? (
              <div
                role="img"
                aria-label={name}
                className="absolute inset-0 bg-cover bg-center"
                style={getImageStyle(image)}
              />
            ) : (
              <ProfilePlaceholder name={name} />
            )}
          </div>

          <div className="relative mt-5 min-h-[320px] overflow-hidden rounded-[8px] px-6 py-7 max-sm:mt-2 max-sm:min-h-0 max-sm:px-4 max-sm:py-4 lg:mt-0 lg:min-h-[520px] lg:px-10 lg:py-8 xl:px-12">
            <Image
              src="/home assets/About_trails.webp"
              alt=""
              fill
              sizes="(min-width: 1024px) 55vw, 100vw"
              aria-hidden="true"
              className="object-cover object-center opacity-45 max-sm:opacity-35"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.92)_48%,rgba(255,255,255,0.74)_100%)]" />
            <div className="relative z-10 max-w-[690px]">
              <p className="font-sans text-eyebrow font-medium uppercase tracking-normal text-primary">
                Meet Our Founder
              </p>
              <h2 className="mt-2 font-heading text-title font-bold leading-none tracking-normal text-secondary">
                {displayName}
              </h2>
              <p className="mt-2 font-sans text-description font-semibold leading-tight text-primary max-sm:mt-1">
                {role}
              </p>

              <p className="mt-5 max-w-[640px] font-sans text-description leading-[1.45] text-secondary max-sm:mt-3 max-sm:line-clamp-5 max-sm:leading-[1.38]">
                {bio}
              </p>
              <p className="mt-4 max-w-[640px] font-sans text-description leading-[1.45] text-secondary max-sm:mt-2 max-sm:line-clamp-2 max-sm:leading-[1.38]">
                Ancient Trails is his dream to share India&apos;s living heritage
                with the world in the most meaningful way possible.
              </p>

              {tags.length > 0 ? (
                <div className="mt-5 flex max-w-[690px] flex-wrap gap-3 max-sm:mt-3 max-sm:gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-primary/20 bg-white/86 px-4 py-1.5 font-sans text-[13px] font-semibold leading-none text-primary max-sm:px-3 max-sm:text-[12px]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <Button
                nativeButton={false}
                render={<Link href="/experts" />}
                variant="outline"
                className="mt-6 h-11 w-full min-w-0 justify-between gap-8 px-7 font-normal max-sm:mt-4 max-sm:h-10 max-sm:gap-4 max-sm:px-5 sm:w-auto lg:min-w-[290px]"
              >
                Read His Story
                <ButtonArrow className="group-hover/button:brightness-0 group-hover/button:invert" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function getCarouselItems<T>(items: T[], activeIndex: number, visibleCount: number) {
  return Array.from(
    { length: Math.min(visibleCount, items.length) },
    (_item, index) => items[(activeIndex + index) % items.length]
  ).filter((item): item is T => Boolean(item));
}

function TeamCarouselSection({
  members,
}: {
  members: AboutTeamMember[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleMembers = useMemo(
    () => getCarouselItems(members, activeIndex, 5),
    [activeIndex, members]
  );

  function showPreviousMember() {
    setActiveIndex((currentIndex) =>
      currentIndex === 0 ? members.length - 1 : currentIndex - 1
    );
  }

  function showNextMember() {
    setActiveIndex((currentIndex) => (currentIndex + 1) % members.length);
  }

  return (
    <section id="team" className="bg-background py-16 max-sm:py-12 lg:py-20">
      <div className="home-wide-frame mx-auto w-full px-5 max-sm:px-4 sm:px-0 [@media(min-width:1300px)]:px-12">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-sans text-eyebrow font-medium uppercase tracking-normal text-primary">
              Our Team
            </p>
            <h2 className="mt-3 max-w-[690px] font-heading text-title font-bold leading-none tracking-normal text-secondary">
              Everything your
              <span className="block text-primary">journey needs</span>
            </h2>
          </div>

          <div className="flex flex-col items-start gap-7 lg:items-end">
            {members.length > 1 ? (
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  aria-label="Previous team member"
                  onClick={showPreviousMember}
                  className="grid size-11 place-items-center rounded-full border border-primary bg-white text-primary transition-colors hover:bg-primary hover:text-white"
                >
                  <ArrowLeft className="size-5" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  aria-label="Next team member"
                  onClick={showNextMember}
                  className="grid size-11 place-items-center rounded-full border border-primary bg-primary text-white transition-colors hover:bg-white hover:text-primary"
                >
                  <ArrowRight className="size-5" strokeWidth={2} />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-14 overflow-hidden max-sm:mt-8">
        <div className="flex gap-6 overflow-x-auto px-5 pb-3 [scrollbar-width:none] max-sm:gap-4 max-sm:px-4 sm:px-8 lg:w-max lg:-translate-x-[calc(12vw-12px)] lg:gap-6 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
          {visibleMembers.map((member) => {
            return (
              <TeamCarouselCard
                key={member.id || member.name}
                member={member}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TeamCarouselCard({
  member,
}: {
  member: AboutTeamMember;
}) {
  const image = member.image;
  const role = member.role;
  const bio = member.bio;

  return (
    <article className="group relative h-[330px] w-[260px] shrink-0 overflow-hidden rounded-[8px] bg-transparent shadow-[0_14px_30px_rgba(50,36,22,0.10)] max-sm:h-[310px] max-sm:w-[78vw] max-sm:max-w-[280px] sm:w-[300px] lg:h-[360px] lg:w-[calc(24vw-24px)]">
      {image ? (
        <div
          role="img"
          aria-label={member.name}
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[720ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.035]"
          style={getImageStyle(image)}
        />
      ) : (
        <ProfilePlaceholder name={member.name} />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02)_22%,rgba(2,18,10,0.74)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 p-6 text-white transition-opacity duration-300 group-hover:opacity-0">
        <h3 className="font-sans text-[24px] font-bold leading-tight tracking-normal sm:text-[28px]">
          {member.name}
        </h3>
        <p className="mt-2 font-sans text-[14px] font-semibold uppercase tracking-normal text-white/82">
          {role}
        </p>
      </div>
      <div className="absolute inset-0 flex translate-y-3 flex-col justify-end bg-black/12 p-6 opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        <p className="font-sans text-eyebrow font-medium uppercase tracking-normal text-primary">
          {role}
        </p>
        <h3 className="mt-3 font-sans text-[24px] font-bold leading-tight tracking-normal text-white sm:text-[28px]">
          {member.name}
        </h3>
        <p className="mt-4 line-clamp-5 font-sans text-description leading-[1.5] text-white/82">
          {bio}
        </p>
      </div>
    </article>
  );
}

function ExpertPeopleSection({ experts }: { experts: PublicExpert[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleExperts = useMemo(
    () => getCarouselItems(experts, activeIndex, 3),
    [activeIndex, experts]
  );

  useEffect(() => {
    if (experts.length <= 3) {
      return;
    }

    const interval = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % experts.length);
    }, 4200);

    return () => window.clearInterval(interval);
  }, [experts.length]);

  function showPreviousExpert() {
    setActiveIndex((currentIndex) =>
      currentIndex === 0 ? experts.length - 1 : currentIndex - 1
    );
  }

  function showNextExpert() {
    setActiveIndex((currentIndex) => (currentIndex + 1) % experts.length);
  }

  return (
    <section id="experts" className="relative overflow-hidden bg-background px-5 py-12 text-secondary max-sm:px-4 sm:px-0 lg:py-14">
      <div className="home-wide-frame mx-auto grid w-full gap-8 [@media(min-width:1300px)]:px-12 lg:grid-cols-[310px_minmax(0,1fr)] lg:items-end xl:grid-cols-[350px_minmax(0,1fr)]">
        <div className="flex min-h-[330px] flex-col justify-between max-sm:min-h-0 max-sm:gap-6 lg:min-h-[380px]">
          <div>
            <p className="font-sans text-eyebrow font-medium uppercase tracking-normal text-primary">
              <span className="mr-3 inline-block size-1.5 rounded-full bg-primary align-middle" />
              Our Experts
            </p>
            <h2 className="mt-4 font-heading text-title font-bold leading-none tracking-normal text-secondary">
              The people who drive our success
            </h2>
            <p className="mt-5 max-w-[300px] font-sans text-description leading-[1.55] text-secondary/68">
              Historians, architects and storytellers with deep knowledge of
              heritage, culture and place.
            </p>
          </div>

          {experts.length > 1 ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Previous expert"
                onClick={showPreviousExpert}
                className="grid size-11 place-items-center rounded-full border border-primary bg-white text-primary transition-colors hover:bg-primary hover:text-white"
              >
                <ArrowLeft className="size-5" strokeWidth={2.2} />
              </button>
              <button
                type="button"
                aria-label="Next expert"
                onClick={showNextExpert}
                className="grid size-11 place-items-center rounded-full border border-primary bg-primary text-white transition-colors hover:bg-white hover:text-primary"
              >
                <ArrowRight className="size-5" strokeWidth={2.2} />
              </button>
            </div>
          ) : null}
        </div>

        <div className="-mx-5 flex gap-6 overflow-x-auto px-5 pb-2 [scrollbar-width:none] max-sm:-mx-4 max-sm:gap-4 max-sm:px-4 sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
          {visibleExperts.map((expert) => (
            <ExpertPeopleCard
              key={expert.id || expert.expertId || expert.fullName}
              expert={expert}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ExpertPeopleCard({ expert }: { expert: PublicExpert }) {
  const name = expert.fullName;
  const image = expert.image;
  const bio = getExpertBio(expert);
  const role = getExpertRole(expert);

  return (
    <Link
      href={getExpertHref(expert)}
      className="group relative h-[340px] w-[270px] shrink-0 overflow-hidden rounded-[8px] bg-transparent shadow-[0_14px_34px_rgba(50,36,22,0.10)] transition-transform duration-300 hover:-translate-y-1 max-sm:h-[320px] max-sm:w-[78vw] max-sm:max-w-[290px] sm:w-[310px] lg:h-[380px] lg:w-auto"
    >
      {image ? (
        <div
          role="img"
          aria-label={name}
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[720ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.035]"
          style={getImageStyle(image)}
        />
      ) : (
        <ProfilePlaceholder name={name} />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02)_28%,rgba(5,10,3,0.68)_100%)]" />
      <span className="absolute right-5 top-5 grid size-11 place-items-center rounded-full border border-primary bg-primary text-white transition-colors group-hover:bg-white group-hover:text-primary">
        <ArrowUpRight className="size-5" strokeWidth={2.2} />
      </span>
      <div className="absolute inset-x-0 bottom-0 p-6 text-white">
        <p className="font-sans text-[13px] font-semibold uppercase leading-[1.25] tracking-normal text-white/86 sm:text-[14px]">
          {role}
        </p>
        <h3 className="mt-2 font-sans text-[21px] font-bold leading-tight tracking-normal sm:text-[24px]">
          {name}
        </h3>
        <p className="sr-only">{bio}</p>
      </div>
    </Link>
  );
}

export function AboutFooterStrip() {
  return (
    <section className="bg-[#211006] px-5 py-10 text-white sm:px-8 lg:px-0">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3">
        <p className="font-heading text-title font-bold text-primary">
          ancient trails
        </p>
        <p className="max-w-[420px] font-sans text-description leading-[1.6] text-white/70">
          Crafting meaningful journeys that connect you with the world, its
          people, and its stories.
        </p>
      </div>
    </section>
  );
}

function ProfilePlaceholder({ name }: { name: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(135deg,#f6e6d7,#dec8b6)] text-primary">
      <span className="grid size-16 place-items-center rounded-full bg-white/72 font-heading text-title font-bold shadow-[0_12px_28px_rgba(80,50,25,0.12)]">
        {getInitials(name)}
      </span>
    </div>
  );
}
