"use client";

import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

type RevealOnViewProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  motion?: "lift" | "scale";
  replay?: boolean;
};

export function RevealOnView({
  children,
  className,
  delay = 0,
  motion = "lift",
  replay = false,
}: RevealOnViewProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = elementRef.current;

    if (!element) {
      return;
    }

    const reveal = () => setIsVisible(true);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frameId = window.requestAnimationFrame(reveal);

      return () => window.cancelAnimationFrame(frameId);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal();
          if (!replay) {
            observer.unobserve(entry.target);
          }
        } else if (replay) {
          setIsVisible(false);
        }
      },
      {
        rootMargin: "0px 0px -70px",
        threshold: 0.18,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [replay]);

  return (
    <div
      ref={elementRef}
      style={{ transitionDelay: `${isVisible ? delay : 0}ms` } as CSSProperties}
      className={cn(
        "transform-gpu transition-all duration-[850ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        motion === "scale" && "origin-center",
        isVisible && "opacity-100 blur-0",
        !isVisible && "opacity-0 blur-[2px]",
        motion === "scale"
          ? isVisible
            ? "scale-100"
            : "scale-[0.88]"
          : isVisible
            ? "translate-y-0"
            : "translate-y-8",
        className
      )}
    >
      {children}
    </div>
  );
}
