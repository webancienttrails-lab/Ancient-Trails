import type { KeyboardEvent } from "react";

/** Automatic activation for horizontal tablists with locally available panels. */
export function handleTabKeyDown(event: KeyboardEvent<HTMLElement>) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(
    '[role="tab"]:not(:disabled):not([aria-disabled="true"])'
  ));
  const index = tabs.findIndex(tab => tab.contains(event.target as Node));
  if (index < 0) return;

  event.preventDefault();
  const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
    : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].focus({ preventScroll: true });
  tabs[next].click();
}
