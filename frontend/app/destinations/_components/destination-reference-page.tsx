"use client";

import Image from "next/image";
import Link from "next/link";
import { getExperiencesHref } from "@/lib/routes";
import { useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { CustomiseTourDialog } from "@/components/contact/customise-tour-dialog";
import { Button, ButtonArrow } from "@/components/ui/button";
import { getHomeMediaUrl, type PublicDestination } from "@/lib/home-travel";
import { isGoogleMapsUrl, getGoogleMapsEmbedUrl } from "@/lib/destination-map";
import styles from "./destination-reference-page.module.css";

const destinationContentFrame = "home-wide-frame mx-auto w-[calc(100%-2.5rem)]";

export function formatDestinationVisitMonths(value: string) {
  return value.trim()
    .replace(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember|t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/gi,
      month => month.charAt(0).toUpperCase() + month.slice(1, 3).toLowerCase())
    .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(?:[-\u2013\u2014]|to)\s*(?=Jan\b|Feb\b|Mar\b|Apr\b|May\b|Jun\b|Jul\b|Aug\b|Sep\b|Oct\b|Nov\b|Dec\b)/gi, "$1-");
}

export function getDestinationReferenceData(destination: PublicDestination) {
  const content = destination.pageContent || {};
  const location = [...new Set([destination.city, destination.state, destination.countryRegion].filter(Boolean))].join(", ");
  const attractions = destination.keyLandmarks.map((name, index) => ({
    name, image: destination.keyLandmarkImages?.[index] || "",
  }));
  return {
    content, location, attractions,
    mapQuery: content.mapQuery?.trim() || [destination.destinationName, location].filter(Boolean).join(", "),
  };
}

export function DestinationReferencePage({ destination, images, onImageOpen }: {
  destination: PublicDestination;
  images: string[];
  onImageOpen: (image: string, title: string) => void;
}) {
  const { content, attractions, mapQuery } = getDestinationReferenceData(destination);
  const fallback = getHomeMediaUrl(destination.bannerImage || destination.thumbnailImage || destination.galleryImages[0] || destination.keyLandmarkImages?.[0] || "") || "/home assets/Heritage Banner.webp";
  const heroImage = fallback;
  const mapImage = isGoogleMapsUrl(content.mapImage || "") ? "" : content.mapImage;
  const mapLink = content.mapLink || (isGoogleMapsUrl(content.mapImage || "") ? content.mapImage : "");
  const mapEmbedUrl = (content.mapEmbedUrl && getGoogleMapsEmbedUrl(content.mapEmbedUrl)) || getGoogleMapsEmbedUrl(mapLink || "") || `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=12&output=embed`;
  const region = destination.region?.trim() || destination.state || destination.countryRegion;
  const days = Math.max(1, Math.trunc(Number(destination.recommendedDurationDays) || 1));
  const duration = days > 1 ? `${days}D/${days - 1}N` : "1 Day";
  const quote = content.closingQuote || destination.fact;
  const visitMonths = formatDestinationVisitMonths(destination.bestTimeToVisit || destination.season || "");
  const knowledge = [...new Set((content.thingsToKnow ?? [destination.dressCode, destination.footwear, destination.permits, destination.idRequirement ? `Photo ID: ${destination.idRequirement}` : "", destination.restrictions]).map(point => point.trim()).filter(Boolean))];
  const pointers = (value?: string) => (value || "").split(/\r?\n/).map(point => point.trim()).filter(Boolean);
  const transport = [
    { label: "By Air", text: content.byAir },
    { label: "By Train", text: content.byRail },
    { label: "By Road", text: content.byRoad },
  ];

  return <div className={styles.page}>
    <section className={styles.hero} aria-labelledby="destination-reference-title">
      <Image className={styles.heroImage} src={heroImage} unoptimized={/^https?:\/\//i.test(destination.bannerImage || "")} alt={`${destination.destinationName} heritage landscape`} fill priority sizes="100vw" />
      <div className={styles.heroWash} />
      <div className={`${destinationContentFrame} ${styles.heroAlignedContent}`}>
        {region ? <div className={styles.heroRegion}><span>{region}</span><span className={styles.regionRule} aria-hidden="true" /></div> : null}
        <h1 id="destination-reference-title">{destination.destinationName}</h1>
        {visitMonths ? <div className={`${styles.heroDuration} ${styles.heroVisitRow}`} aria-label="Best time to visit"><span>Best Time to Visit:</span><strong>{visitMonths}</strong></div> : null}
        <div className={styles.heroDuration}><span>Recommended Days:</span><strong>{duration}</strong></div>
        <Button render={<a href="#destination-tours" />} className={styles.heroTourButton}>
          Explore {destination.destinationName} Tours<ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
        </Button>
      </div>
      {quote ? <aside className={styles.heroQuote} aria-label="Destination quote"><blockquote>{quote}</blockquote></aside> : null}
    </section>

    <div className={styles.overviewBand}>
    <section className={`${destinationContentFrame} ${styles.overview}`} aria-label={`Discover ${destination.destinationName}`}>
      <div className={styles.know}>
        <h2 className={styles.iconHeading}>Things to Know</h2>
        <ul className={styles.pointerList}>{knowledge.map(point => <li key={point}>{point}</li>)}</ul>
        <CustomiseTourDialog destinationName={destination.destinationName} variant="outline" />
      </div>
      <DestinationAttractions attractions={attractions} fallback={fallback} onImageOpen={onImageOpen} />
    </section>

    </div>



    <section className={styles.reachBand}>
      <div className={`${destinationContentFrame} ${styles.reachGrid}`}>
        <div className={styles.reach}>
          <h2 className={styles.iconHeading}>How to Reach</h2>
          <ul className={`${styles.pointerList} ${styles.transportPointers}`}>{transport.filter(item => item.text?.trim()).map(item => <li key={item.label}><strong>{item.label}:</strong> {pointers(item.text).join(" ")}</li>)}</ul>
        </div>
        <div className={styles.location} aria-label="Location map">
          <div className={styles.mapLayout}>
            <div className={styles.map}>
              {mapImage ? <a href={mapLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`} target="_blank" rel="noreferrer" aria-label={`Open ${destination.destinationName} map`}><Image src={getHomeMediaUrl(mapImage)} unoptimized={/^https?:\/\//i.test(mapImage)} alt={`Map of ${destination.destinationName}`} fill sizes="(min-width: 900px) 35vw, 100vw" /></a>
                : <iframe title={`${destination.destinationName} location map`} src={mapEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className={styles.experienceCta} aria-label={`Experiences in ${destination.destinationName}`}>
      <Image src={heroImage} alt="" fill sizes="100vw" className={styles.experienceBackground} unoptimized={/^https?:\/\//i.test(destination.bannerImage || "")} />
      <div className={styles.experienceOverlay} aria-hidden="true" />
      <div className={`${destinationContentFrame} ${styles.experienceCtaInner}`}>
        <div><p className={styles.experienceEyebrow}>Live the Legacy</p><h2>Experiences in {destination.destinationName}</h2></div>
        <Button render={<Link prefetch={false} href={getExperiencesHref(destination)} />} className="h-12 gap-4 px-6">
          Explore Experiences<ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />
        </Button>
      </div>
    </section>

  </div>;
}

export function DestinationAttractionCard({ attraction, image, onImageOpen }: {
  attraction: { name: string; image?: string }; image: string;
  onImageOpen: (image: string, title: string) => void;
}) {
  return <article className={styles.attraction}>
    <button className={styles.attractionPhoto} type="button" onClick={() => onImageOpen(image, attraction.name)} aria-label={`View ${attraction.name}`}>
      <Image src={image} unoptimized={/^https?:\/\//i.test(attraction.image || "")} alt={attraction.name} fill sizes="(min-width: 900px) 22vw, (min-width: 540px) 40vw, 85vw" />
    </button>
    <h3>{attraction.name}</h3>
  </article>;
}

function DestinationAttractions({ attractions, fallback, onImageOpen }: {
  attractions: { name: string; image?: string }[]; fallback: string;
  onImageOpen: (image: string, title: string) => void;
}) {
  const [viewportRef, carousel] = useEmblaCarousel({ loop: true, align: "start", slidesToScroll: 1 });
  useEffect(() => {
    if (!carousel) return;
    const timer = window.setInterval(() => {
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) carousel.scrollNext();
    }, 4500);
    return () => window.clearInterval(timer);
  }, [carousel]);
  return <div className={styles.attractions} role="region" aria-roledescription="carousel" aria-label="Key Attractions">
    <h2>Key Attractions</h2>
    <div className={styles.attractionViewport} ref={viewportRef}>
      <div className={styles.attractionGrid}>
        {attractions.map((attraction, index) => <DestinationAttractionCard key={`${attraction.name}-${index}`} attraction={attraction}
          image={getHomeMediaUrl(attraction.image || "") || fallback} onImageOpen={onImageOpen} />)}
      </div>
    </div>

  </div>;
}
