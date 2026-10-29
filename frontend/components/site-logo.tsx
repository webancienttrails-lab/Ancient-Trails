"use client";

import Image, { type ImageProps } from "next/image";
import { useState, useSyncExternalStore } from "react";
import { defaultSiteLogo, getSiteLogoSnapshot, subscribeSiteLogo } from "@/lib/site-logo";

export function SiteLogo(props: Omit<ImageProps, "src">) {
  const source = useSyncExternalStore(subscribeSiteLogo, getSiteLogoSnapshot, () => defaultSiteLogo);
  const [failed, setFailed] = useState("");
  return <Image {...props} alt={props.alt} src={source === failed ? defaultSiteLogo : source} style={{ objectFit: "contain", maxHeight: props.height ? Number(props.height) : undefined, ...props.style }} onError={event => { setFailed(source); props.onError?.(event); }} />;
}
