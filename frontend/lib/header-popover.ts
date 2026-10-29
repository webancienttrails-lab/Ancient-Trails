"use client";

import { useEffect, useRef, type RefObject } from "react";

// Header dropdowns must not make the rest of the navigation inert.
export function activateHeaderPopover(
  dialog: HTMLDialogElement,
  onClose: () => void,
  initialFocus: string,
  trigger?: HTMLElement | null
) {
  const close = () => { if (!dialog.open) onClose(); };
  const escape = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || event.defaultPrevented || document.querySelector("dialog:modal")) return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };
  const outside = (event: PointerEvent) => {
    const target = event.target as Node;
    if (!dialog.contains(target) && !trigger?.contains(target)) onClose();
  };
  dialog.addEventListener("close", close);
  document.addEventListener("keydown", escape);
  document.addEventListener("pointerdown", outside);
  if (!dialog.open) dialog.show();
  dialog.querySelector<HTMLElement>(initialFocus)?.focus({ preventScroll: true });

  return () => {
    const restoreFocus = dialog.contains(document.activeElement) || document.activeElement === document.body;
    dialog.removeEventListener("close", close);
    document.removeEventListener("keydown", escape);
    document.removeEventListener("pointerdown", outside);
    if (dialog.open) dialog.close();
    if (restoreFocus && trigger?.isConnected && !trigger.closest("[inert]")) trigger.focus({ preventScroll: true });
  };
}

export function useHeaderPopover(
  ref: RefObject<HTMLDialogElement | null>,
  open: boolean,
  onClose: () => void,
  initialFocus: string,
  triggerRef: RefObject<HTMLElement | null>
) {
  const latestClose = useRef(onClose);
  useEffect(() => { latestClose.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open || !ref.current) return;
    return activateHeaderPopover(ref.current, () => latestClose.current(), initialFocus, triggerRef.current);
  }, [ref, open, initialFocus, triggerRef]);
}
