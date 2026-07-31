"use client";

import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

type RevealTrigger = "view" | "load";

type RevealOnViewProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  motion?: "lift" | "scale";
  replay?: boolean;
  rootMargin?: string;
  trigger?: RevealTrigger;
  visible?: boolean;
};

type RevealVisibilityOptions = {
  replay: boolean;
  rootMargin: string;
  trigger: RevealTrigger;
  visible?: boolean;
};

function useRevealVisibility<TElement extends HTMLElement>(
  elementRef: RefObject<TElement | null>,
  { replay, rootMargin, trigger, visible }: RevealVisibilityOptions
) {
  const [internalIsVisible, setInternalIsVisible] = useState(false);
  const isVisible = visible ?? internalIsVisible;

  useEffect(() => {
    if (typeof visible === "boolean") {
      return;
    }

    const element = elementRef.current;

    if (!element) {
      return;
    }

    const reveal = () => setInternalIsVisible(true);
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (trigger === "load" || reduceMotion) {
      let firstFrameId = 0;
      let secondFrameId = 0;

      firstFrameId = window.requestAnimationFrame(() => {
        if (reduceMotion) {
          reveal();
          return;
        }

        secondFrameId = window.requestAnimationFrame(reveal);
      });

      return () => {
        window.cancelAnimationFrame(firstFrameId);
        window.cancelAnimationFrame(secondFrameId);
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal();
          if (!replay) {
            observer.unobserve(entry.target);
          }
        } else if (replay) {
          setInternalIsVisible(false);
        }
      },
      {
        rootMargin,
        threshold: 0.18,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [elementRef, replay, rootMargin, trigger, visible]);

  return isVisible;
}

export function RevealOnView({
  children,
  className,
  delay = 0,
  motion = "lift",
  replay = false,
  rootMargin = "0px 0px -70px",
  trigger = "view",
  visible,
}: RevealOnViewProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const isVisible = useRevealVisibility(elementRef, {
    replay,
    rootMargin,
    trigger,
    visible,
  });

  return (
    <div
      ref={elementRef}
      style={{ transitionDelay: `${isVisible ? delay : 0}ms` } as CSSProperties}
      className={cn(
        "transform-gpu transition-[opacity,transform,filter] duration-[1050ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity,transform,filter]",
        motion === "scale" && "origin-center",
        isVisible && "opacity-100 blur-0",
        !isVisible && "opacity-0 blur-[1px]",
        motion === "scale"
          ? isVisible
            ? "scale-100"
            : "scale-[0.94]"
          : isVisible
            ? "translate-y-0"
            : "translate-y-6",
        className
      )}
    >
      {children}
    </div>
  );
}

type TextRevealProps = Omit<RevealOnViewProps, "motion"> & {
  innerClassName?: string;
};

export function TextReveal({
  children,
  className,
  innerClassName,
}: TextRevealProps) {
  return (
    <div className={cn("overflow-visible", className)}>
      <div className={innerClassName}>{children}</div>
    </div>
  );
}
