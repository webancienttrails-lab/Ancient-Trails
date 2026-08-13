"use client";

import Rive, { Alignment, Fit, Layout } from "@rive-app/react-canvas";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const loaderDuration = 1500;
const reducedMotionLoaderDuration = 350;
const fadeDuration = 520;

function LoaderAnimation() {
  const riveLayout = useMemo(
    () => new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    []
  );

  return (
    <div className="h-[min(68vw,330px)] w-[min(68vw,330px)]">
      <Rive
        src="/loaders/travel-onboarding-loader.riv"
        layout={riveLayout}
        shouldDisableRiveListeners
        className="h-full w-full"
      />
    </div>
  );
}

export function LoaderScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#fff8f0]">
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
      className={`fixed inset-0 z-[2147483647] grid place-items-center bg-[#fff8f0] transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isLeaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <span className="sr-only">Loading Ancient Trails</span>
      <LoaderAnimation />
    </div>
  );
}
