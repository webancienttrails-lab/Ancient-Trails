"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { CalendarDays, MapPin, Users } from "lucide-react";

import { Button, ButtonArrow } from "@/components/ui/button";

const tripOptions = [
  {
    label: "Where to?",
    icon: MapPin,
  },
  {
    label: "Any Month",
    icon: CalendarDays,
  },
  {
    label: "2 Adults",
    icon: Users,
  },
];

const planTripButtonClassName =
  "group h-11 min-w-[210px] justify-between gap-5 px-5 font-normal shadow-none";
const panelPadding = 12;

function PlanTripButtonContent() {
  return (
    <>
      Plan your trip
      <ButtonArrow className="group-hover/button:brightness-0 group-hover/button:invert" />
    </>
  );
}

type PanelPosition = {
  left: number;
  top: number;
  width: number;
  closedScaleX: number;
  closedScaleY: number;
};

type ButtonRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function PlanTripLauncher() {
  const [isOpen, setIsOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const [buttonStartRect, setButtonStartRect] = useState<ButtonRect | null>(null);
  const [isCtaFlying, setIsCtaFlying] = useState(false);
  const [isCtaSettled, setIsCtaSettled] = useState(false);
  const launcherRef = useRef<HTMLDivElement>(null);

  const updatePanelPosition = useCallback(() => {
    const launcher = launcherRef.current;

    if (!launcher) {
      return;
    }

    const buttonRect = launcher.getBoundingClientRect();
    const viewportPadding = window.innerWidth < 768 ? 20 : 48;
    const maxPanelWidth = 1120;
    const panelChromeHeight = panelPadding * 2;
    const panelVisualHeight = buttonRect.height + panelChromeHeight;
    const left =
      window.innerWidth < 768
        ? viewportPadding
        : buttonRect.left;
    const panelWidth = Math.min(
      window.innerWidth - left - viewportPadding,
      maxPanelWidth
    );
    const width = Math.max(panelWidth, 280);
    const top = buttonRect.top - panelChromeHeight / 2;

    setPanelPosition({
      left,
      top,
      width,
      closedScaleX: buttonRect.width / width,
      closedScaleY: buttonRect.height / panelVisualHeight,
    });
  }, []);

  const closePlanner = useCallback(() => {
    setIsOpen(false);
    setIsCtaFlying(false);
    setIsCtaSettled(false);
    setButtonStartRect(null);
  }, []);

  const openPlanner = useCallback(() => {
    const launcher = launcherRef.current;

    if (launcher) {
      const buttonRect = launcher.getBoundingClientRect();

      setButtonStartRect({
        left: buttonRect.left,
        top: buttonRect.top,
        width: buttonRect.width,
        height: buttonRect.height,
      });
    }

    setPanelPosition(null);
    setIsCtaFlying(false);
    setIsCtaSettled(false);
    setIsOpen(true);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePanelPosition();
  }, [isOpen, updatePanelPosition]);

  useLayoutEffect(() => {
    if (!isOpen || !buttonStartRect || !panelPosition) {
      return;
    }

    let firstFrameId = 0;
    let secondFrameId = 0;
    let settleTimeoutId = 0;

    firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        setIsCtaFlying(true);
        settleTimeoutId = window.setTimeout(() => {
          setIsCtaSettled(true);
        }, 1100);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrameId);
      window.cancelAnimationFrame(secondFrameId);
      window.clearTimeout(settleTimeoutId);
    };
  }, [buttonStartRect, isOpen, panelPosition]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePlanner();
      }
    };

    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closePlanner, isOpen, updatePanelPosition]);

  const handleLauncherClick = () => {
    if (isOpen) {
      closePlanner();
      return;
    }

    openPlanner();
  };

  const ctaMotion =
    isOpen && buttonStartRect && panelPosition
      ? {
          ...buttonStartRect,
          endLeft:
            panelPosition.left +
            panelPosition.width -
            panelPadding -
            buttonStartRect.width,
          endTop: panelPosition.top + panelPadding,
        }
      : null;

  return (
    <>
      <button
        type="button"
        aria-label="Close trip planner"
        onClick={closePlanner}
        className={`fixed inset-0 z-20 bg-secondary/10 backdrop-blur-[3px] transition-opacity duration-500 ease-out ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <div ref={launcherRef} className="relative z-30 mt-16 inline-flex">
        <Button
          type="button"
          variant="outline"
          aria-expanded={isOpen}
          aria-controls="plan-trip-panel"
          onClick={handleLauncherClick}
          className={`${planTripButtonClassName} transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isOpen
              ? "pointer-events-none scale-95 bg-primary text-white opacity-0"
              : "opacity-100"
          }`}
        >
          <PlanTripButtonContent />
        </Button>
      </div>

      {isOpen && ctaMotion ? (
        <div
          className="fixed z-50 transition-transform duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            left: ctaMotion.left,
            top: ctaMotion.top,
            width: ctaMotion.width,
            height: ctaMotion.height,
            transform: isCtaFlying
              ? `translate3d(${ctaMotion.endLeft - ctaMotion.left}px, ${
                  ctaMotion.endTop - ctaMotion.top
                }px, 0)`
              : "translate3d(0, 0, 0)",
            willChange: "transform",
          }}
        >
          <Button
            type="button"
            variant="outline"
            tabIndex={isCtaSettled ? 0 : -1}
            className={`${planTripButtonClassName} h-full w-full min-w-0 !bg-white !text-primary hover:!bg-white hover:!text-primary [&_svg]:!text-primary ${
              isCtaSettled ? "pointer-events-auto" : "pointer-events-none"
            }`}
          >
            <PlanTripButtonContent />
          </Button>
        </div>
      ) : null}

      <div
        id="plan-trip-panel"
        aria-hidden={!isOpen}
        style={
          panelPosition
            ? ({
                left: panelPosition.left,
                top: panelPosition.top,
                width: panelPosition.width,
                "--launcher-closed-scale-x": panelPosition.closedScaleX,
                "--launcher-closed-scale-y": panelPosition.closedScaleY,
              } as CSSProperties)
            : undefined
        }
        className={`fixed z-40 max-w-[calc(100vw-2.5rem)] origin-left transition-all duration-[850ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen
            ? "translate-y-0 scale-x-100 scale-y-100 opacity-100"
            : "pointer-events-none translate-y-0 scale-x-[var(--launcher-closed-scale-x)] scale-y-[var(--launcher-closed-scale-y)] opacity-0"
        }`}
      >
        <div className="flex flex-col items-center overflow-visible rounded-[34px] border border-accent/30 bg-white/90 p-3  backdrop-blur-md md:min-h-[60px] md:flex-row md:items-stretch">
          <div
            className={`grid flex-1 divide-y divide-accent/25 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] md:h-full md:grid-cols-3 md:items-center md:divide-x md:divide-y-0 ${
              isOpen ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0"
            }`}
          >
            {tripOptions.map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                className="flex min-h-12 items-center gap-5 p-3 text-left text-description font-medium text-secondary transition-colors hover:text-primary md:h-full md:px-8"
              >
                <Icon className="size-6 shrink-0 text-accent" strokeWidth={1.9} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div
            className="relative z-10 p-0 md:flex md:h-full md:min-w-[210px] md:items-center"
          >
            <Button
              type="button"
              variant="outline"
              aria-hidden="true"
              tabIndex={-1}
              className={`${planTripButtonClassName} pointer-events-none opacity-0`}
            >
              <PlanTripButtonContent />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
