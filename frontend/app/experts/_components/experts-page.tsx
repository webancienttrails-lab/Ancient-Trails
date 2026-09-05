"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Languages,
  type LucideIcon,
} from "lucide-react";

import { Header } from "@/components/layout/header";
import { Button, ButtonArrow } from "@/components/ui/button";
import {
  getHomeMediaUrl,
  listPublicExperts,
  type PublicExpert,
} from "@/lib/home-travel";
import { getExpertAnchorId, getToursHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

const fallbackExperts: PublicExpert[] = [
  {
    id: "fallback-expert-1",
    expertId: "GIRINATH-BHARADE",
    fullName: "Mr. Girinath Bharade",
    image: "/home assets/Khajuraho.webp",
    fullBiography:
      "Founder and Indologist, researcher and storyteller with special reverence for South India.",
    expertiseTags: ["Founder & Indologist", "Temple Architecture"],
    qualifications: ["Temple Architecture"],
    languages: ["English", "Hindi"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

function getExpertRole(expert: PublicExpert) {
  return expert.expertiseTags[0] || expert.qualifications[0] || "Heritage Expert";
}

function getExpertBio(expert: PublicExpert) {
  return (
    expert.fullBiography ||
    "A specialist storyteller with deep knowledge of heritage, culture and place."
  );
}

function getExpertImage(expert: PublicExpert, index: number) {
  return getHomeMediaUrl(
    expert.image ||
      fallbackExperts[index % fallbackExperts.length]?.image ||
      "/home assets/Khajuraho.webp"
  );
}

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "EX"
  );
}

function uniqueLabels(labels: string[]) {
  const seen = new Set<string>();

  return labels.filter((label) => {
    const normalizedLabel = label.trim();
    const key = normalizedLabel.toLowerCase();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}

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

function ExpertPlaceholder({ name }: { name: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(135deg,#f6e6d7,#dec8b6)] text-primary">
      <span className="grid size-16 place-items-center rounded-full bg-white/72 font-heading text-[24px] font-bold shadow-[0_12px_28px_rgba(80,50,25,0.12)]">
        {getInitials(name)}
      </span>
    </div>
  );
}

function ExpertImagePanel({
  expert,
  index,
}: {
  expert: PublicExpert;
  index: number;
}) {
  const image = getExpertImage(expert, index);

  return (
    <div className="relative min-h-[270px] overflow-hidden rounded-[8px] bg-muted bg-cover bg-center shadow-[0_16px_36px_rgba(35,24,16,0.14)] sm:min-h-[320px] lg:min-h-[360px]">
      {image ? (
        <Image
          src={image}
          alt={expert.fullName}
          fill
          sizes="(min-width: 1024px) 475px, 100vw"
          className="object-cover object-center"
        />
      ) : (
        <ExpertPlaceholder name={expert.fullName} />
      )}
    </div>
  );
}

function ExpertTextPanel({ expert }: { expert: PublicExpert }) {
  const tags = uniqueLabels(expert.expertiseTags).slice(0, 6);
  const qualifications = uniqueLabels(expert.qualifications).slice(0, 4);
  const languages = uniqueLabels(expert.languages).slice(0, 5);

  return (
    <div className="relative min-h-[330px] overflow-hidden rounded-[8px] px-5 py-7 sm:px-8 lg:px-10">
      <Image
        src="/home assets/About_trails.webp"
        alt=""
        fill
        sizes="725px"
        aria-hidden="true"
        className="pointer-events-none object-cover object-right-bottom"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.88)_58%,rgba(255,255,255,0.78)_100%)]" />

      <div className="relative z-10 max-w-[630px]">
        <p className="font-sans text-eyebrow font-medium uppercase text-primary">
          {getExpertRole(expert)}
        </p>
        <h2 className="mt-2 font-heading text-title font-bold leading-none text-secondary">
          {expert.fullName}
        </h2>

        <p className="mt-5 max-w-[560px] font-sans text-description leading-[1.55] text-secondary">
          {getExpertBio(expert)}
        </p>

        {tags.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={`${expert.expertId}-${tag}`}
                className="rounded-full border border-primary/20 bg-white px-3 py-1 font-sans text-[11px] font-semibold text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <ExpertFact
            icon={BookOpen}
            label="Qualifications"
            value={qualifications.join(", ") || "Heritage research"}
          />
          <ExpertFact
            icon={Languages}
            label="Languages"
            value={languages.join(", ") || "English"}
          />
        </div>

        <Button
          nativeButton={false}
          render={<Link href={getToursHref({ search: expert.fullName })} />}
          className="mt-6 h-11 w-full min-w-0 justify-between gap-4 px-5 text-[15px] font-normal sm:w-auto sm:gap-6 sm:px-6 sm:text-button lg:min-w-[210px]"
        >
          Explore Their Tours
          <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
        </Button>
      </div>
    </div>
  );
}

function ExpertFact({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[8px] border border-primary/15 bg-white/72 p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" strokeWidth={1.9} />
      </span>
      <span className="min-w-0">
        <span className="block font-sans text-[11px] font-semibold uppercase leading-none text-primary">
          {label}
        </span>
        <span className="mt-1.5 block font-sans text-[13px] font-medium leading-snug text-secondary/76">
          {value}
        </span>
      </span>
    </div>
  );
}

function ExpertCard({
  expert,
  index,
}: {
  expert: PublicExpert;
  index: number;
}) {
  const imageFirst = index % 2 === 0;

  return (
    <article
      id={getExpertAnchorId(expert)}
      className="scroll-mt-8 rounded-[12px] border border-primary/15 bg-white p-4 shadow-[0_18px_52px_rgba(80,50,25,0.08)]"
    >
      <div
        className={cn(
          "grid gap-4 lg:grid-cols-[0.78fr_1.22fr]",
          !imageFirst && "lg:grid-cols-[1.22fr_0.78fr]"
        )}
      >
        {imageFirst ? (
          <>
            <ExpertImagePanel expert={expert} index={index} />
            <ExpertTextPanel expert={expert} />
          </>
        ) : (
          <>
            <ExpertTextPanel expert={expert} />
            <ExpertImagePanel expert={expert} index={index} />
          </>
        )}
      </div>
    </article>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[8px] border border-primary/15 bg-white px-5 py-8 text-center shadow-[0_14px_34px_rgba(80,50,25,0.07)]">
      <p className="font-sans text-description font-semibold text-secondary">
        {message}
      </p>
    </div>
  );
}

export function ExpertsPage() {
  const [experts, setExperts] = useState<PublicExpert[]>(fallbackExperts);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadExperts() {
      setIsLoading(true);
      setLoadError("");

      try {
        const response = await listPublicExperts();

        if (isMounted && response.data.experts.length > 0) {
          setExperts(response.data.experts);
        }
      } catch {
        if (isMounted) {
          setLoadError("Showing sample experts while live expert data loads.");
          setExperts(fallbackExperts);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadExperts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));

    if (!hash) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [experts]);

  const expertCountLabel = useMemo(
    () => `${experts.length} ${experts.length === 1 ? "expert" : "experts"}`,
    [experts.length]
  );

  return (
    <main className="min-h-screen bg-background text-secondary">
      <HeaderBand />

      <section className="mx-auto w-full max-w-[1300px] px-5 pb-14 pt-9 sm:px-8 lg:px-0">
        <div className="flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-sans text-eyebrow font-medium uppercase tracking-normal text-primary">
              Our Experts
            </p>
            <h1 className="mt-3 font-heading text-title font-bold leading-none tracking-normal text-secondary">
              Meet the Minds Behind the Journeys
            </h1>
          </div>

          <Link
            href="/about#team"
            className="inline-flex h-11 w-full items-center justify-between rounded-full border border-primary bg-white px-5 font-sans text-[15px] font-medium text-primary transition-colors hover:bg-primary hover:text-white sm:w-auto sm:min-w-[180px]"
          >
            About Us
            <ArrowRight className="size-4" strokeWidth={1.9} />
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="font-sans text-[14px] font-semibold text-secondary/68">
            {isLoading ? "Loading experts..." : expertCountLabel}
          </p>
          {loadError ? (
            <p className="font-sans text-[13px] font-medium text-primary">
              {loadError}
            </p>
          ) : null}
        </div>

        <div className="mt-7 grid gap-6">
          {experts.length > 0 ? (
            experts.map((expert, index) => (
              <ExpertCard
                key={expert.id || expert.expertId || expert.fullName}
                expert={expert}
                index={index}
              />
            ))
          ) : (
            <EmptyState message="No experts are available right now." />
          )}
        </div>
      </section>
    </main>
  );
}
