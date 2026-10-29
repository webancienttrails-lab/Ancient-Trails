import { getImageProps } from "next/image";

export function HomeHeroImage() {
  const shared = { alt: "Ancient Trails heritage landscape", fill: true, sizes: "100vw", loading: "eager" as const, fetchPriority: "high" as const };
  const { props: desktop } = getImageProps({ ...shared, src: "/home assets/Briddeshwara temple_banner.webp" });
  const { props: mobile } = getImageProps({ ...shared, src: "/home assets/Mobile_banner.webp" });
  return <picture>
    <source media="(max-width: 767px)" srcSet={mobile.srcSet} sizes={mobile.sizes} />
    {/* getImageProps provides optimized srcsets; picture selects one hero without preloading both. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img {...desktop} className="object-cover object-center md:scale-[1.1] lg:scale-[1.12]" />
  </picture>;
}
