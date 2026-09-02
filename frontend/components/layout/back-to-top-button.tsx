"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

import { cn } from "@/lib/utils";

export function BackToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    function updateVisibility() {
      setIsVisible(window.scrollY > 360);
    }

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });

    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed bottom-5 right-5 z-[70] grid size-11 place-items-center rounded-full border border-primary bg-white text-primary shadow-[0_12px_30px_rgba(50,50,50,0.18)] transition-all duration-300 hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 sm:bottom-7 sm:right-7",
        isVisible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0"
      )}
    >
      <ArrowUp className="size-5" strokeWidth={2.2} />
    </button>
  );
}
