"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock3, Heart } from "lucide-react";

import { Button, ButtonArrow } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TourShowcaseCardProps = {
  className?: string;
  ctaLabel?: string;
  durationLabel: string;
  favoriteLabel?: string;
  href: string;
  image: string;
  imageSizes: string;
  isFavorite?: boolean;
  nextDepartureLabel?: string;
  onFavoriteToggle?: () => void;
  priceLabel?: string;
  title: string;
};

export function TourShowcaseCard({
  className,
  ctaLabel = "Book Now",
  durationLabel,
  favoriteLabel,
  href,
  image,
  imageSizes,
  isFavorite = false,
  nextDepartureLabel = "Coming Soon",
  onFavoriteToggle,
  priceLabel = "Price on request",
  title,
}: TourShowcaseCardProps) {
  return (
    <article
      className={cn(
        "group overflow-hidden rounded-[14px] border border-[#ead8c5] bg-white shadow-[0_16px_34px_rgba(67,43,27,0.1)]",
        className
      )}
    >
      <div className="relative h-[220px] overflow-hidden bg-muted">
        <Image
          src={image}
          alt={title}
          fill
          sizes={imageSizes}
          className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,12,8,0.05)_0%,rgba(18,12,8,0.02)_48%,rgba(18,12,8,0.22)_100%)]" />
        <span className="absolute bottom-4 left-4 inline-flex h-9 items-center gap-2 rounded-full bg-secondary/72 px-3.5 font-sans text-[13px] font-bold text-white shadow-[0_10px_20px_rgba(35,23,15,0.18)] backdrop-blur">
          <Clock3 className="size-3.5" strokeWidth={2} />
          {durationLabel}
        </span>
        {favoriteLabel ? (
          <button
            type="button"
            aria-label={favoriteLabel}
            aria-pressed={isFavorite}
            onClick={onFavoriteToggle}
            className="absolute right-4 top-4 grid size-11 place-items-center rounded-full border border-white/35 bg-secondary/55 text-white shadow-[0_10px_24px_rgba(35,23,15,0.22)] backdrop-blur transition-colors hover:bg-primary"
          >
            <Heart
              className={cn("size-5", isFavorite && "fill-current")}
              strokeWidth={isFavorite ? 0 : 1.9}
            />
          </button>
        ) : null}
      </div>

      <div className="p-5">
        <h3 className="line-clamp-2 min-h-[46px] font-heading text-[19px] font-bold leading-tight text-secondary">
          {title}
        </h3>

        <div className="mt-3 border-y border-[#ead8c5] py-3">
          <div className="flex items-center justify-between gap-4 font-sans text-[12px]">
            <span className="inline-flex min-w-0 items-center gap-2 font-semibold text-secondary/58">
              <span className="size-2.5 rounded-full bg-primary/85" />
              Next departure
            </span>
            <strong className="shrink-0 text-[12px] font-bold text-primary">
              {nextDepartureLabel}
            </strong>
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between gap-4">
          <span className="min-w-0 font-sans">
            <span className="block text-[11px] font-bold text-secondary/56">
              Starting from
            </span>
            <strong className="mt-1 block truncate font-sans text-[22px] font-bold leading-none text-primary">
              {priceLabel}
            </strong>
          </span>
          <Button
            nativeButton={false}
            render={<Link href={href} aria-label={`${ctaLabel} ${title}`} />}
            className="h-9 shrink-0 gap-1.5 px-3.5 text-[12px] font-bold"
          >
            {ctaLabel}
            <ButtonArrow className="h-2.5 w-5 brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
          </Button>
        </div>
      </div>
    </article>
  );
}
