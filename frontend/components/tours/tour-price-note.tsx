"use client";

import { useEffect, useState } from "react";
import { getPublicTaxSettings } from "@/lib/site-settings";
import { cn } from "@/lib/utils";

export function TourPriceNote({
  airfareExtra = false,
  gstPercentage,
  className,
}: {
  airfareExtra?: boolean;
  gstPercentage?: number;
  className?: string;
}) {
  const [savedGst, setSavedGst] = useState<number | null>(null);
  useEffect(() => {
    if (gstPercentage !== undefined) return;
    let mounted = true;
    getPublicTaxSettings().then(taxes => {
      if (mounted) setSavedGst(Math.round((taxes.sgstPercentage + taxes.cgstPercentage) * 100) / 100);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [gstPercentage]);
  const rate = gstPercentage ?? savedGst;
  return (
    <p className={cn("mt-1 font-sans text-[12px] font-medium leading-snug text-secondary/72", className)}>
      + {rate === null ? "" : `${rate}% `}GST{airfareExtra ? ", airfare extra" : ""}
    </p>
  );
}
