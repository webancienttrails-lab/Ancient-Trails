"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BedDouble,
  Bus,
  CalendarDays,
  Camera,
  Clock3,
  Heart,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TourShowcaseCardProps = {
  allDeparturesHref: string;
  badgeLabel?: string;
  className?: string;
  ctaLabel?: string;
  difficultyLabel?: string;
  expertImage?: string;
  durationLabel: string;
  expertName?: string;
  expertSpecialties?: string[];
  expertSpecialty?: string;
  favoriteLabel?: string;
  href: string;
  image: string;
  imageSizes: string;
  isFavorite?: boolean;
  nextDepartureLabel?: string;
  onFavoriteToggle?: () => void;
  priceLabel?: string;
  showBadge?: boolean;
  title: string;
};

export function TourShowcaseCard({
  allDeparturesHref,
  badgeLabel = "BESTSELLER",
  className,
  ctaLabel = "Book Now",
  durationLabel,
  expertImage = "",
  expertName = "Ancient Trails Expert",
  expertSpecialties = [],
  expertSpecialty = "",
  favoriteLabel,
  href,
  image,
  imageSizes,
  isFavorite = false,
  nextDepartureLabel = "Coming Soon",
  onFavoriteToggle,
  priceLabel = "On request",
  showBadge = true,
  title,
}: TourShowcaseCardProps) {
  const tourIncludes = [
    { icon: BedDouble, label: "Accommodation" },
    { icon: Camera, label: "Sightseeing" },
    { icon: UserRoundCheck, label: "Expert guide" },
    { icon: Bus, label: "Local transport" },
  ];

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-[20px] border border-[#e8dfd8] bg-white",
        className
      )}
    >
      <div className="relative aspect-[1.6/1] overflow-hidden bg-muted">
        <Link
          href={href}
          aria-label={`View ${title}`}
          className="absolute inset-0 block focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
        >
          <Image
            src={image}
            alt={title}
            fill
            sizes={imageSizes}
            className="object-cover transition-transform duration-700 group-hover:scale-[1.035]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,12,8,0.12)_0%,rgba(18,12,8,0.02)_48%,rgba(18,12,8,0.35)_100%)]" />

          {showBadge ? (
            <div className="absolute left-5 top-0 flex h-[46px] items-stretch">
              <span
                aria-hidden="true"
                className="grid w-[40px] place-items-center rounded-b-[14px] bg-primary/72 text-white shadow-[0_10px_22px_rgba(35,23,15,0.2)] backdrop-blur-[2px]"
              >
                <BestsellerBadgeIcon />
              </span>
              <span className="inline-flex max-w-[118px] items-center truncate px-3 font-sans text-[10px] font-extrabold uppercase leading-none text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
                {badgeLabel}
              </span>
            </div>
          ) : null}

          <span className="absolute bottom-4 left-4 inline-flex h-9 max-w-[calc(100%-2rem)] items-center gap-2 rounded-full bg-[#2b241f]/80 px-4 font-sans text-[13px] font-medium leading-none text-white shadow-[0_10px_22px_rgba(35,23,15,0.24)] backdrop-blur-[2px]">
            <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-white text-[#2b241f]">
              <Clock3 className="size-3" strokeWidth={2.3} />
            </span>
            <span className="truncate">{durationLabel}</span>
          </span>

          {/* <span className="absolute bottom-4 right-4 hidden h-9 max-w-[50%] items-center rounded-full bg-[#2b241f]/80 px-4 font-sans text-[13px] font-medium leading-none text-white shadow-[0_10px_22px_rgba(35,23,15,0.24)] backdrop-blur-[2px] sm:inline-flex">
            <span className="truncate">{difficultyLabel}</span>
          </span> */}
        </Link>

        {favoriteLabel ? (
          <button
            type="button"
            aria-label={favoriteLabel}
            aria-pressed={isFavorite}
            onClick={onFavoriteToggle}
            className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full bg-[#2b241f]/80 text-white shadow-[0_10px_24px_rgba(35,23,15,0.28)] backdrop-blur-[2px] transition-colors hover:bg-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/45"
          >
            <Heart
              className={cn("size-[18px]", isFavorite && "fill-current")}
              strokeWidth={isFavorite ? 0 : 1.9}
            />
          </button>
        ) : null}
      </div>

      <div className="px-4 pb-2 pt-4 sm:px-5">
        <h3 className="font-heading text-[20px] font-bold leading-[1.06] tracking-normal text-secondary sm:text-[20px]">
          <Link
            href={href}
            className="line-clamp-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
          >
            {title}
          </Link>
        </h3>

        <span className="mt-3 block h-px w-full bg-primary/65" />

        <div className="mt-2 grid gap-2 font-sans lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <time className="mt-1.5 block truncate text-[16px] font-medium leading-none text-primary">
              {nextDepartureLabel}
            </time>
          </div>
          <Link
            href={allDeparturesHref}
            className="inline-flex w-fit items-center gap-2 pt-0.5 text-[12px] font-medium leading-none text-secondary transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20 sm:text-[13px] lg:justify-self-end"
          >
            <span className="whitespace-nowrap">View Calendar</span>
            <CalendarDays className="size-5 shrink-0 text-primary" strokeWidth={1.8} />
          </Link>
        </div>

        <div className="mt-8 flex min-w-0 items-baseline justify-between gap-3 font-sans text-secondary">
          <span className="shrink-0 text-[13px] font-medium leading-none text-secondary sm:text-[13px]">
            Tour Expert
          </span>
          <TourExpertHoverPopup
            image={expertImage}
            name={expertName}
            specialties={expertSpecialties}
            specialty={expertSpecialty}
          />
        </div>
        <div className="mt-2 py-2 flex flex-nowrap items-center justify-between gap-2.5 border-t border-[#d6d1cb]">
          <span className="min-w-0 flex-1 font-sans">
            <span className="block text-[12px] font-medium leading-none text-secondary/72 sm:text-[13px]">
              Starting from
            </span>
            <strong className="mt-1 block truncate font-sans text-[22px] font-semibold leading-none text-secondary sm:text-[24px]">
              {priceLabel}
            </strong>
          </span>
          <Button
            nativeButton={false}
            render={<Link href={href} aria-label={`${ctaLabel} ${title}`} />}
            className="h-[34px] min-w-[134px] shrink-0 gap-4 px-4 text-[12px] font-normal sm:min-w-[144px] sm:text-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {ctaLabel}
          </Button>
        </div>

        <div className="mt-1 border-t border-[#d6d1cb]">
          <div className="flex items-center justify-between gap-3 pt-2">
            <span className="font-sans text-[12px] font-medium leading-none text-secondary/62">
              Tour Includes
            </span>
            <div className="flex shrink-0 items-center gap-2.5 text-primary sm:gap-3">
              {tourIncludes.map(({ icon, label }) => (
                <TourIncludeIcon key={label} icon={icon} label={label} />
              ))}
            </div>
          </div>
        </div>

        
      </div>
    </article>
  );
}

function BestsellerBadgeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="4"
    >
      <path
        d="m32 4.5 5.3 4 6.6-.9 2.8 6 6 2.8-.9 6.6 4 5.3-4 5.3.9 6.6-6 2.8-2.8 6-6.6-.9-5.3 4-5.3-4-6.6.9-2.8-6-6-2.8.9-6.6-4-5.3 4-5.3-.9-6.6 6-2.8 2.8-6 6.6.9 5.3-4Z"
      />
      <path d="m32 17.4 3.7 7.5 8.3 1.2-6 5.8 1.4 8.2-7.4-3.9-7.4 3.9 1.4-8.2-6-5.8 8.3-1.2L32 17.4Z" />
    </svg>
  );
}

export function TourExpertHoverPopup({
  image,
  name,
  specialties,
  specialty,
  triggerClassName,
}: {
  image: string;
  name: string;
  specialties: string[];
  specialty: string;
  triggerClassName?: string;
}) {
  const tags = specialties.map((item) => item.trim()).filter(Boolean);
  const fallbackSpecialty = specialty.trim();
  const displayedSpecialties =
    tags.length > 0
      ? tags
      : [fallbackSpecialty || "Heritage Tours"];
  const initials =
    name
      .split(" ")
      .map((part) => part.trim()[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "AT";
  const hasPopup = Boolean(image || tags.length > 0 || fallbackSpecialty);

  return (
    <span className="group/expert relative min-w-0">
      <strong
        tabIndex={hasPopup ? 0 : undefined}
        className={cn(
          "block min-w-0 truncate text-right text-[14px] font-semibold leading-none text-secondary outline-none transition-colors hover:text-primary focus-visible:text-primary sm:text-[15px]",
          triggerClassName
        )}
      >
        {name}
      </strong>

      {hasPopup ? (
        <span className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 flex w-[240px] items-start gap-3 rounded-[8px] border border-[#e8cbaa] bg-white p-3 text-left opacity-0 shadow-[0_14px_30px_rgba(35,23,15,0.16)] transition-opacity duration-200 group-hover/expert:opacity-100 group-focus-within/expert:opacity-100">
          <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[#fff1e5] font-sans text-[13px] font-bold text-primary">
            {image ? (
              <Image
                src={image}
                alt={name}
                fill
                sizes="48px"
                className="object-cover"
              />
            ) : (
              initials
            )}
          </span>
          <span className="min-w-0 font-sans">
            <span className="block truncate text-[14px] font-bold leading-tight text-secondary">
              {name}
            </span>
            <span className="mt-1 block text-[11px] font-semibold uppercase leading-none text-secondary/45">
              Expert in
            </span>
            <ul className="mt-1.5 space-y-1">
              {displayedSpecialties.map((item) => (
                <li
                  key={item}
                  className="flex min-w-0 items-start gap-1.5 text-[11px] font-normal leading-tight text-secondary"
                >
                  <span className="mt-[5px] size-1 shrink-0 rounded-full bg-secondary" />
                  <span className="min-w-0">{item}</span>
                </li>
              ))}
            </ul>
          </span>
        </span>
      ) : null}
    </span>
  );
}

function TourIncludeIcon({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <span
      aria-label={label}
      role="img"
      title={label}
      className="grid size-[14px] place-items-center text-secondary/72"
    >
      <Icon className="size-4" strokeWidth={2.4} />
    </span>
  );
}
