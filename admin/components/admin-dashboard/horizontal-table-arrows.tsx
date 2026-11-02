"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function HorizontalTableArrows() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    let activeTarget: HTMLElement | null = null;
    const cleanups = new Map<HTMLElement, () => void>();

    const isVisible = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
    };

    const updateButtons = (element: HTMLElement | null) => {
      if (!element || !isVisible(element) || element.scrollWidth <= element.clientWidth + 2) {
        setTarget(null);
        setCanScrollLeft(false);
        setCanScrollRight(false);
        return;
      }
      setTarget(element);
      setCanScrollLeft(element.scrollLeft > 2);
      setCanScrollRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 2);
    };

    const handleWindowChange = () => {
      const currentStillUsable = activeTarget && isVisible(activeTarget) && activeTarget.scrollWidth > activeTarget.clientWidth + 2;
      if (currentStillUsable) {
        updateButtons(activeTarget);
        return;
      }
      const firstVisible = [...cleanups.keys()].find(element => isVisible(element) && element.scrollWidth > element.clientWidth + 2) || null;
      activeTarget = firstVisible;
      updateButtons(firstVisible);
    };

    const discover = () => {
      const elements = Array.from(document.querySelectorAll<HTMLElement>(
        ".admin-dashboard-main [data-horizontal-scroll], .admin-dashboard-main [class*='overflow-x-auto'], .admin-dashboard-main [class*='overflow-x-scroll']"
      )).filter(element => element.querySelector("table") && element.scrollWidth > element.clientWidth + 2);

      for (const [element, cleanup] of cleanups) {
        if (!elements.includes(element)) {
          cleanup();
          resizeObserver.unobserve(element);
          const table = element.querySelector("table");
          if (table) resizeObserver.unobserve(table);
          cleanups.delete(element);
          if (activeTarget === element) activeTarget = null;
        }
      }

      for (const element of elements) {
        if (cleanups.has(element)) continue;
        resizeObserver.observe(element);
        const table = element.querySelector("table");
        if (table) resizeObserver.observe(table);
        const activate = () => {
          activeTarget = element;
          updateButtons(element);
        };
        const onScroll = () => {
          if (activeTarget === element) updateButtons(element);
        };
        element.addEventListener("mouseenter", activate);
        element.addEventListener("focusin", activate);
        element.addEventListener("scroll", onScroll, { passive: true });
        cleanups.set(element, () => {
          element.removeEventListener("mouseenter", activate);
          element.removeEventListener("focusin", activate);
          element.removeEventListener("scroll", onScroll);
        });
      }
      handleWindowChange();
    };

    const mutationObserver = new MutationObserver(discover);
    mutationObserver.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
    const resizeObserver = new ResizeObserver(discover);
    window.addEventListener("scroll", handleWindowChange, { passive: true });
    window.addEventListener("resize", discover);
    discover();

    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("scroll", handleWindowChange);
      window.removeEventListener("resize", discover);
      cleanups.forEach(cleanup => cleanup());
    };
  }, []);

  if (!target) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[70] flex items-center gap-1 rounded-full border border-orange-200 bg-white/95 p-1.5 shadow-lg backdrop-blur-sm" aria-label="Table horizontal scroll controls">
      <button
        type="button"
        aria-label="Scroll table left"
        disabled={!canScrollLeft}
        onClick={() => target.scrollBy({ left: -Math.max(240, target.clientWidth * 0.7), behavior: "smooth" })}
        className="grid size-10 place-items-center rounded-full text-orange-800 transition-colors hover:bg-orange-100 disabled:cursor-default disabled:text-stone-300 disabled:hover:bg-transparent"
      >
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <span className="px-1 text-[11px] font-medium text-stone-500">Scroll table</span>
      <button
        type="button"
        aria-label="Scroll table right"
        disabled={!canScrollRight}
        onClick={() => target.scrollBy({ left: Math.max(240, target.clientWidth * 0.7), behavior: "smooth" })}
        className="grid size-10 place-items-center rounded-full text-orange-800 transition-colors hover:bg-orange-100 disabled:cursor-default disabled:text-stone-300 disabled:hover:bg-transparent"
      >
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </div>
  );
}
