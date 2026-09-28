"use client";

import type { AnimationItem } from "lottie-web";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const loaderDuration = 1500;
const reducedMotionLoaderDuration = 350;
const fadeDuration = 520;

function LoaderAnimation() {
  const animationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animationRef.current) {
      return;
    }

    let animation: AnimationItem | null = null;
    let isMounted = true;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    import("lottie-web").then(({ default: lottie }) => {
      if (!isMounted || !animationRef.current) {
        return;
      }

      animation = lottie.loadAnimation({
        autoplay: !reducedMotion,
        container: animationRef.current,
        loop: true,
        path: "/paw_walk_4steps_2.json",
        renderer: "svg",
        rendererSettings: {
          preserveAspectRatio: "xMidYMid meet",
        },
      });

      if (reducedMotion) {
        animation.goToAndStop(0, true);
      }
    });

    return () => {
      isMounted = false;
      animation?.destroy();
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-7 px-6 text-center">
      <div
        aria-hidden="true"
        className="relative h-[clamp(170px,42vw,260px)] w-[clamp(120px,32vw,190px)]"
        ref={animationRef}
      />
      <p className="font-sans text-[clamp(0.72rem,2.4vw,0.82rem)] font-semibold uppercase tracking-[0.22em] text-accent">
        FOLLOWING THE TRAIL...
      </p>
    </div>
  );
}

function usePreventDocumentScroll(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isLocked]);
}

export function LoaderScreen() {
  usePreventDocumentScroll(true);

  return (
    <main className="grid min-h-screen place-items-center bg-background">
      <span className="sr-only">Loading Ancient Trails</span>
      <LoaderAnimation />
    </main>
  );
}

export function SiteLoader() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(() => pathname !== "/");
  const [isLeaving, setIsLeaving] = useState(false);
  const startedAtRef = useRef(0);
  const fadeTimerRef = useRef(0);
  const removeTimerRef = useRef(0);

  usePreventDocumentScroll(isVisible && pathname !== "/");

  useEffect(() => {
    const clearTimers = () => {
      window.clearTimeout(fadeTimerRef.current);
      window.clearTimeout(removeTimerRef.current);
    };

    return clearTimers;
  }, []);

  useEffect(() => {
    const startLoader = () => {
      window.clearTimeout(fadeTimerRef.current);
      window.clearTimeout(removeTimerRef.current);
      startedAtRef.current = window.performance.now();
      setIsLeaving(false);
      setIsVisible(true);
    };

    const handlePageClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;

      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }

      const url = new URL(link.href, window.location.href);
      const currentPath = `${window.location.pathname}${window.location.search}`;
      const nextPath = `${url.pathname}${url.search}`;

      if (
        url.origin !== window.location.origin ||
        link.target ||
        link.hasAttribute("download") ||
        nextPath === currentPath ||
        url.pathname === "/"
      ) {
        return;
      }

      startLoader();
    };

    document.addEventListener("click", handlePageClick, true);

    return () => {
      document.removeEventListener("click", handlePageClick, true);
    };
  }, []);

  useEffect(() => {
    if (pathname === "/") {
      window.clearTimeout(fadeTimerRef.current);
      window.clearTimeout(removeTimerRef.current);
      return;
    }

    if (!startedAtRef.current) {
      startedAtRef.current = window.performance.now();
      setIsVisible(true);
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const minimumDuration = reducedMotion
      ? reducedMotionLoaderDuration
      : loaderDuration;

    const closeLoader = () => {
      const elapsed = window.performance.now() - startedAtRef.current;
      const remaining = Math.max(0, minimumDuration - elapsed);

      window.clearTimeout(fadeTimerRef.current);
      window.clearTimeout(removeTimerRef.current);

      fadeTimerRef.current = window.setTimeout(() => {
        setIsLeaving(true);
        removeTimerRef.current = window.setTimeout(() => {
          setIsVisible(false);
          setIsLeaving(false);
          startedAtRef.current = 0;
        }, fadeDuration);
      }, remaining);
    };

    if (document.readyState === "complete") {
      closeLoader();
    } else {
      window.addEventListener("load", closeLoader, { once: true });
    }

    return () => {
      window.removeEventListener("load", closeLoader);
    };
  }, [pathname]);

  if (!isVisible || pathname === "/") {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[2147483647] grid place-items-center bg-background transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isLeaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <span className="sr-only">Loading Ancient Trails</span>
      <LoaderAnimation />
    </div>
  );
}
