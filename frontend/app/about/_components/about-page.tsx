"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Eye,
  Flag,
  Globe2,
  Landmark,
  Leaf,
  MapPin,
  Mountain,
  Route,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import { Button, ButtonArrow } from "@/components/ui/button";
import {
  getAboutMediaUrl,
  getAboutPageContent,
  type AboutPageContent as AboutPageContentType,
  type AboutStatIcon,
  type AboutTeamMember,
} from "@/lib/about";
import {
  listPublicExperts,
  type PublicExpert,
} from "@/lib/home-travel";
import { cn } from "@/lib/utils";

const statIconMap: Record<AboutStatIcon, LucideIcon> = {
  BookOpen,
  CalendarDays,
  Globe2,
  MapPin,
  Users,
};

const valueItems = [
  {
    title: "Authentic Experiences",
    description:
      "Handpicked journeys that connect you with real culture and local stories.",
    icon: "/home assets/icons/Tour_trip.png",
  },
  {
    title: "Expertly Curated",
    description:
      "Designed by heritage experts and local specialists with deep knowledge.",
    icon: "/home assets/icons/Mentor.png",
  },
  {
    title: "Responsible Travel",
    description:
      "We promote sustainable tourism and support local communities we visit.",
    icon: "/home assets/icons/Learning.png",
  },
  {
    title: "Trusted by Thousands",
    description:
      "Loved by 25,000+ travellers for our quality and commitment.",
    icon: "/home assets/icons/Planning.png",
  },
  {
    title: "Personalised Support",
    description:
      "We're with you at every step for a smooth and worry-free experience.",
    icon: "/home assets/icons/Internet.png",
  },
  {
    title: "Wide Network, Local Roots",
    description:
      "Strong local partnerships across India for truly immersive journeys.",
    icon: "/home assets/icons/Tour_trip.png",
  },
];

const specialityItems = [
  { title: "Heritage & Culture Tours", icon: Route },
  { title: "Temple Trails", icon: Landmark },
  { title: "Archaeological Journeys", icon: MapPin },
  { title: "Spiritual Retreats", icon: Mountain },
  { title: "Art, Craft & Local Experiences", icon: Leaf },
  { title: "Festival & Event Tours", icon: Flag },
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

type TeamProfile = {
  key: string;
  member: AboutTeamMember | null;
  expert: PublicExpert | null;
};

function getExpertKey(expert: PublicExpert) {
  return expert.id || expert.expertId || normalizeProfileName(expert.fullName);
}

function getTeamProfiles(
  teamMembers: AboutTeamMember[],
  experts: PublicExpert[]
): TeamProfile[] {
  const usedExpertKeys = new Set<string>();

  const memberProfiles = teamMembers.map((member, index) => {
    const expert = getMatchingExpert(member, experts);

    if (expert) {
      usedExpertKeys.add(getExpertKey(expert));
    }

    return {
      key: member.id || `${member.name}-${index}`,
      member,
      expert,
    };
  });

  const memberNames = new Set(
    teamMembers.map((member) => normalizeProfileName(member.name))
  );
  const expertProfiles = experts
    .filter((expert) => {
      const expertKey = getExpertKey(expert);

      return (
        !usedExpertKeys.has(expertKey) &&
        !memberNames.has(normalizeProfileName(expert.fullName))
      );
    })
    .map((expert, index) => ({
      key: getExpertKey(expert) || `${expert.fullName}-${index}`,
      member: null,
      expert,
    }));

  return [...memberProfiles, ...expertProfiles];
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
      <ValuesSection />
      {founder || founderExpert ? (
        <FounderSection founder={founder} expert={founderExpert} />
      ) : null}
      {teamMembers.length > 0 || experts.length > 0 ? (
        <TeamSection experts={experts} teamMembers={teamMembers} />
      ) : null}
      <SpecializedSection />
    </main>
  );
}

function HeroSection() {
  return (
    <section className="relative h-[100svh] min-h-[620px] overflow-visible bg-background lg:h-[80vh] lg:min-h-[690px]">
      <Image
        src="/home assets/Heritage Banner.webp"
        alt="Indian heritage fort at sunrise"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.87)_36%,rgba(255,255,255,0.18)_68%,rgba(255,255,255,0)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,#ffffff_100%)]" />

      <div className="relative z-[2147483647] mx-auto flex h-full w-full max-w-[1300px] flex-col px-5 py-[clamp(1rem,4vh,2.25rem)] sm:px-0">
        <Header />

        <div className="flex min-h-0 flex-1 items-center px-0 pb-[118px] pt-[clamp(0.5rem,3vh,4rem)] sm:px-6 lg:px-10">
          <div className="max-w-[430px] text-accent">
            <p className="mb-[clamp(0.5rem,1.5vh,0.75rem)] text-eyebrow font-medium uppercase tracking-normal text-primary">
              About Ancient Trails
            </p>
            <h1 className="font-heading text-[36px] font-bold leading-none tracking-normal text-secondary sm:text-[44px] lg:text-title">
              Our Story.
              <span className="block">
                Our Passion<span className="text-primary">.</span>
              </span>
            </h1>
            <span className="mt-[clamp(0.75rem,3vh,1.75rem)] block h-px w-14 bg-accent" />
            <p className="mt-[clamp(0.75rem,3vh,1.75rem)] max-w-[380px] text-description text-accent">
              Ancient Trails was born out of a deep love for India&apos;s
              heritage and a desire to share its timeless stories with the
              world. We curate immersive journeys that go beyond sightseeing,
              connecting you with culture, people and histories that inspire.
            </p>
            <Button
              nativeButton={false}
              render={<Link href="/#upcoming-tours" />}
              className="mt-7 h-11 w-full min-w-0 justify-between gap-4 px-5 text-[15px] font-normal sm:w-auto sm:gap-6 sm:px-6 sm:text-button lg:min-w-[220px]"
            >
              Explore Our Journeys
              <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsSection({
  stats,
}: {
  stats: AboutPageContentType["stats"];
}) {
  return (
    <section className="relative z-20 mx-auto -mt-[86px] w-full max-w-[1300px] px-5 sm:px-0">
      <div className="grid overflow-hidden rounded-[12px] border border-primary/15 bg-white shadow-[0_22px_58px_rgba(50,36,22,0.13)] backdrop-blur sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat, index) => {
          const Icon = statIconMap[stat.icon] || BookOpen;

          return (
            <article
              key={stat.id || `${stat.label}-${index}`}
              className={cn(
                "flex min-h-[128px] flex-col items-center justify-center px-4 py-7 text-center",
                index > 0 && "border-t border-border sm:border-l sm:border-t-0",
                index === 2 && "sm:border-t lg:border-t-0",
                index === 4 && "sm:col-span-2 lg:col-span-1"
              )}
            >
              <Icon className="size-8 text-primary" strokeWidth={1.7} />
              <strong className="mt-5 font-heading text-[30px] font-semibold leading-none text-secondary">
                {stat.value}
              </strong>
              <span className="mt-2 font-sans text-[12px] font-medium leading-tight text-secondary/76">
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
    <section className="relative bg-background px-5 pb-16 pt-12 sm:px-0 lg:pb-20">
      <div className="relative mx-auto w-full max-w-[1300px] overflow-hidden rounded-[12px] border border-primary/15 bg-white p-4 shadow-[0_16px_48px_rgba(80,50,25,0.07)]">
        <div className="relative min-h-[260px] overflow-hidden rounded-[8px]">
          <Image
            src="/home assets/About_trails.webp"
            alt=""
            fill
            sizes="1300px"
            aria-hidden="true"
            className="pointer-events-none object-cover object-right-bottom"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.94)_0%,rgba(255,255,255,0.84)_50%,rgba(255,255,255,0.92)_100%)]" />
          <div className="relative z-10 px-3 py-8 sm:px-4 lg:px-8">
          <p className="text-description font-medium uppercase text-primary">
            Our Purpose
          </p>
          <div className="mt-7 grid gap-9 lg:grid-cols-[1fr_1px_1fr] lg:gap-16">
            <StoryPanel
              icon={Flag}
              title="Our Mission"
              description="To inspire meaningful journeys that promote cultural understanding, preserve heritage and empower local communities."
            />
            <span className="relative hidden w-px bg-border lg:block">
              <span className="absolute left-1/2 top-1/2 grid size-4 -translate-x-1/2 -translate-y-1/2 rotate-45 place-items-center border border-primary/50 bg-white">
                <span className="size-1.5 rounded-full bg-primary" />
              </span>
            </span>
            <StoryPanel
              icon={Eye}
              title="Our Vision"
              description="To be India's most trusted heritage travel brand, connecting the past with the present for generations to come."
            />
          </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StoryPanel({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <article className="grid grid-cols-[82px_minmax(0,1fr)] items-center gap-6">
      <span className="grid size-[74px] place-items-center rounded-full bg-white text-primary shadow-[0_14px_34px_rgba(63,39,18,0.08)] ring-1 ring-primary/15">
        <Icon className="size-10" strokeWidth={1.5} />
      </span>
      <span className="min-w-0">
        <h2 className="font-heading text-[32px] font-bold leading-none tracking-normal text-secondary sm:text-[40px]">
          {title}
        </h2>
        <span className="mt-4 block h-px w-12 bg-primary" />
        <p className="mt-5 max-w-[360px] text-description text-secondary">
          {description}
        </p>
      </span>
    </article>
  );
}

function ValuesSection() {
  return (
    <section className="relative overflow-hidden bg-background px-5 pb-16 pt-2 sm:px-0 lg:pb-24">
      <div className="pointer-events-none absolute -right-3 top-[58px] hidden h-[255px] w-[175px] overflow-hidden lg:block">
        <Image
          src="/home assets/Heritage Banner.webp"
          alt=""
          fill
          sizes="175px"
          className="object-cover object-left opacity-[0.42] grayscale contrast-[1.35] brightness-[1.04] mix-blend-multiply"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#ffffff_0%,rgba(255,255,255,0)_16%,rgba(255,255,255,0)_78%,#ffffff_100%),linear-gradient(180deg,#ffffff_0%,rgba(255,255,255,0)_10%,rgba(255,255,255,0)_76%,#ffffff_100%)]" />
      </div>
      <div className="relative mx-auto w-full max-w-[1300px]">
        <div className="text-center">
          <span className="mx-auto block h-px w-[120px] bg-primary" />
          <p className="mt-5 text-description font-medium uppercase text-primary">
            Why Travel With Us?
          </p>
          <h2 className="mt-1 font-heading text-[34px] font-bold leading-none text-secondary sm:text-[40px] lg:text-title">
            Why Choose Ancient Trails
          </h2>
        </div>

        <div className="mt-14 grid gap-y-10 sm:grid-cols-2 lg:mt-20 lg:grid-cols-6 lg:gap-y-0">
          {valueItems.map(({ description, icon, title }, index) => (
            <article key={title} className="relative flex flex-col items-center px-5 text-center">
              {index < valueItems.length - 1 ? (
                <span className="pointer-events-none absolute right-0 top-0 hidden h-full w-px bg-border lg:block">
                  <span className="absolute -top-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-border" />
                </span>
              ) : null}
              <div className="relative size-[74px]">
                <Image src={icon} alt="" fill sizes="74px" className="object-contain" />
              </div>
              <h3 className="mt-5 min-h-[46px] max-w-[190px] font-sans text-[16px] font-normal leading-[1.35] text-secondary">
                {title}
              </h3>
              <p className="mt-4 max-w-[190px] text-[13px] italic leading-[1.25] text-secondary/75">
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

  return (
    <section className="bg-background px-5 pb-16 sm:px-0 lg:pb-20">
      <div className="relative mx-auto grid w-full max-w-[1300px] gap-4 overflow-hidden rounded-[12px] border border-primary/15 bg-white p-4 shadow-[0_18px_52px_rgba(80,50,25,0.08)] lg:grid-cols-[0.78fr_1.22fr]">
        <div className="relative min-h-[310px] overflow-hidden rounded-[8px] bg-muted bg-cover bg-center shadow-[0_16px_36px_rgba(35,24,16,0.14)] sm:min-h-[350px] lg:min-h-[360px]">
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
          <div className="absolute bottom-4 left-4 rounded-[6px] bg-secondary/90 px-4 py-3 font-sans text-white shadow-[0_12px_24px_rgba(35,24,16,0.18)]">
            <p className="text-[12px] font-bold leading-none">{role}</p>
            <p className="mt-1 text-[11px] font-medium leading-none text-white/72">
              Ancient Trails
            </p>
          </div>
        </div>

        <div className="relative min-h-[360px] overflow-hidden rounded-[8px] px-5 py-8 sm:px-8 lg:px-10">
          <Image
            src="/home assets/About_trails.webp"
            alt=""
            fill
            sizes="650px"
            aria-hidden="true"
            className="pointer-events-none object-cover object-right-bottom"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.95)_0%,rgba(255,255,255,0.86)_56%,rgba(255,255,255,0.75)_100%)]" />
          <div className="relative z-10 max-w-[570px]">
            <p className="text-description font-medium uppercase text-primary">
              Meet Our Founder
            </p>
            <h2 className="mt-2 font-heading text-[34px] font-bold leading-none text-secondary sm:text-[40px] lg:text-title">
              {getDisplayFounderName(name)}
            </h2>
            <p className="mt-3 font-sans text-[14px] font-semibold leading-tight text-primary">
              {role}
            </p>
            <p className="mt-6 max-w-[520px] text-description text-secondary">
              {bio}
            </p>
            <p className="mt-4 max-w-[520px] text-description text-secondary">
              Ancient Trails is his dream to share India&apos;s living heritage
              with the world in the most meaningful way possible.
            </p>
            {tags.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-primary/20 bg-white px-3 py-1 font-sans text-[11px] font-semibold text-primary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            <Button
              nativeButton={false}
              render={<Link href="/#about" />}
              variant="outline"
              className="mt-8 h-11 w-full min-w-0 justify-between gap-4 px-5 text-[15px] font-normal sm:w-auto sm:gap-6 sm:px-6 sm:text-button lg:min-w-[190px]"
            >
              Read His Story
              <ButtonArrow className="group-hover/button:brightness-0 group-hover/button:invert" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function TeamSection({
  experts,
  teamMembers,
}: {
  experts: PublicExpert[];
  teamMembers: AboutPageContentType["teamMembers"];
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const teamProfiles = getTeamProfiles(teamMembers, experts);

  function scrollTeam(direction: "left" | "right") {
    scrollerRef.current?.scrollBy({
      left: direction === "left" ? -280 : 280,
      behavior: "smooth",
    });
  }

  return (
    <section className="bg-[#fff8f2] px-5 pb-12 sm:px-8 lg:px-0">
      <div className="mx-auto w-full max-w-[1220px]">
        <div className="flex items-end justify-between gap-5">
          <div>
            <p className="font-sans text-[12px] font-bold uppercase leading-none tracking-normal text-primary">
              Our Team
            </p>
            <h2 className="mt-4 font-heading text-[31px] font-bold leading-[1.05] tracking-normal text-secondary sm:text-[40px]">
              The Minds Behind the Journeys
            </h2>
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <button
              type="button"
              onClick={() => scrollTeam("left")}
              aria-label="Scroll team left"
              className="grid size-10 place-items-center rounded-full border border-primary/12 bg-white text-secondary/65 shadow-[0_10px_24px_rgba(80,50,25,0.08)] transition-colors hover:bg-primary hover:text-white"
            >
              <ArrowLeft className="size-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => scrollTeam("right")}
              aria-label="Scroll team right"
              className="grid size-10 place-items-center rounded-full border border-primary/12 bg-white text-secondary/65 shadow-[0_10px_24px_rgba(80,50,25,0.08)] transition-colors hover:bg-primary hover:text-white"
            >
              <ArrowRight className="size-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div
          ref={scrollerRef}
          className="mt-8 flex snap-x gap-4 overflow-x-auto pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {teamProfiles.map(({ expert, key, member }) => (
            <TeamCard
              key={key}
              expert={expert}
              member={member}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function TeamCard({
  expert,
  member,
}: {
  expert: PublicExpert | null;
  member: AboutTeamMember | null;
}) {
  const name = getProfileName(member, expert);
  const image = getProfileImage(member, expert);
  const role = getExpertRole(expert, member?.role || "");
  const bio = getExpertBio(expert, member?.bio || "");
  const tags = expert?.expertiseTags.slice(0, 2) || [];

  return (
    <article className="w-[184px] shrink-0 snap-start overflow-hidden rounded-[8px] border border-[#ead8c5] bg-white shadow-[0_16px_36px_rgba(80,50,25,0.09)]">
      <div className="relative h-[170px] bg-[#eadfd6]">
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
      <div className="p-4">
        <h3 className="font-sans text-[13px] font-bold leading-tight text-secondary">
          {name}
        </h3>
        <p className="mt-2 font-sans text-[11px] font-semibold leading-[1.35] text-primary">
          {role}
        </p>
        <p className="mt-4 line-clamp-5 min-h-[100px] font-sans text-[12px] font-medium leading-[1.65] text-secondary/72">
          {bio}
        </p>
        {tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={`${name}-${tag}`}
                className="rounded-full bg-[#fff4ea] px-2 py-1 font-sans text-[10px] font-semibold leading-none text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ProfilePlaceholder({ name }: { name: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(135deg,#f6e6d7,#dec8b6)] text-primary">
      <span className="grid size-16 place-items-center rounded-full bg-white/72 font-heading text-[24px] font-bold shadow-[0_12px_28px_rgba(80,50,25,0.12)]">
        {getInitials(name)}
      </span>
    </div>
  );
}

function SpecializedSection() {
  return (
    <section className="bg-[#fff8f2] px-5 pb-14 sm:px-8 lg:px-0">
      <div className="mx-auto w-full max-w-[1220px] text-center">
        <p className="font-sans text-[12px] font-bold uppercase leading-none tracking-normal text-primary">
          We Are Specialized In
        </p>
        <h2 className="mt-5 font-heading text-[30px] font-bold leading-tight tracking-normal text-secondary sm:text-[38px]">
          Journeys that Celebrate India&apos;s Heritage
        </h2>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {specialityItems.map(({ icon: Icon, title }) => (
            <article
              key={title}
              className="flex min-h-[78px] items-center gap-4 rounded-[8px] border border-[#ead8c5] bg-white px-5 text-left shadow-[0_12px_28px_rgba(80,50,25,0.05)]"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-5" strokeWidth={1.7} />
              </span>
              <h3 className="font-sans text-[13px] font-bold leading-[1.35] text-secondary">
                {title}
              </h3>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
