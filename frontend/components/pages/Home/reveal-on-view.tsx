"use client";

import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

type RevealOnViewProps = {
  children: ReactNode;
  delay?: number;
};

export function RevealOnView({ children, delay = 0 }: RevealOnViewProps) {
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
          observer.unobserve(entry.target);
        }
      },
      {
        rootMargin: "0px 0px -70px",
        threshold: 0.18,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={elementRef}
      style={{ transitionDelay: `${delay}ms` } as CSSProperties}
      className={`transform-gpu transition-all duration-[850ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isVisible
          ? "translate-y-0 opacity-100 blur-0"
          : "translate-y-8 opacity-0 blur-[2px]"
      }`}
    >
      {children}
    </div>
  );
}
