"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DestinationPhotoGallery({ destinationName, images, onImageOpen }: {
  destinationName: string;
  images: string[];
  onImageOpen: (index: number) => void;
}) {
  const [viewportRef, carousel] = useEmblaCarousel({ loop: true, align: "start", slidesToScroll: 1 });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  useEffect(() => {
    if (!carousel) return;
    const sync = () => { setCanScrollPrev(carousel.canScrollPrev()); setCanScrollNext(carousel.canScrollNext()); };
    sync(); carousel.on("select", sync); carousel.on("reInit", sync);
    return () => { carousel.off("select", sync); carousel.off("reInit", sync); };
  }, [carousel]);
  return <section className="mt-12" aria-label="Destination photo gallery">
    <div className="flex items-center justify-between gap-4">
      <h2 className="font-heading text-title font-bold text-secondary">Photo Gallery</h2>
      <div className="flex shrink-0 gap-2">
        <Button type="button" variant="outline" size="icon-lg" className="size-10 rounded-full" aria-label="Previous gallery photos" disabled={!canScrollPrev} onClick={() => carousel?.scrollPrev()}><ChevronLeft /></Button>
        <Button type="button" variant="outline" size="icon-lg" className="size-10 rounded-full" aria-label="Next gallery photos" disabled={!canScrollNext} onClick={() => carousel?.scrollNext()}><ChevronRight /></Button>
      </div>
    </div>
    <div ref={viewportRef} className="mt-5 overflow-hidden touch-pan-y" data-destination-gallery-viewport>
      <div className="-ml-3 flex">
        {images.map((image, index) => <div key={`${image}-${index}`} className="min-w-0 shrink-0 grow-0 basis-1/2 pl-3 sm:basis-1/3 lg:basis-1/5" role="group" aria-roledescription="slide" aria-label={`Photo ${index + 1} of ${images.length}`}>
          <button type="button" aria-label={`View ${destinationName} photo ${index + 1}`} className="relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-[8px] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2" onClick={() => onImageOpen(index)}>
            <Image src={image} alt={`${destinationName} gallery ${index + 1}`} fill sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw" className="object-cover" />
          </button>
        </div>)}
      </div>
    </div>
  </section>;
}
