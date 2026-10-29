import { cn } from "@/lib/utils";

export function TourPriceNote({
  airfareExtra = false,
  gstPercentage = 5,
  className,
}: {
  airfareExtra?: boolean;
  gstPercentage?: number;
  className?: string;
}) {
  return (
    <p className={cn("mt-1 font-sans text-[12px] font-medium leading-snug text-secondary/72", className)}>
      + {gstPercentage}% GST{airfareExtra ? ", airfare extra" : ""}
    </p>
  );
}
