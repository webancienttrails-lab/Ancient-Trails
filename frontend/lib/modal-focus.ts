"use client";

import { useEffect, useRef, type RefObject } from "react";

// Native modal dialogs provide focus containment and make the rest of the page inert.
export function activateModal(dialog: HTMLDialogElement, onClose: () => void, initialFocus?: string, returnTarget?: HTMLElement | null) {
  const previous = returnTarget || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const overflow = document.body.style.overflow;
  const cancel = (event: Event) => { event.preventDefault(); event.stopPropagation(); onClose(); };
  // A close event queued during Strict Mode cleanup may arrive after reopening.
  const close = () => { if (!dialog.open) onClose(); };
  const cycleFocus = (event: KeyboardEvent) => {
    if (event.key !== "Tab") return;
    const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"]'
    )).filter(element => element.tabIndex >= 0 && !element.matches(":disabled") &&
      !element.closest("[inert]") && element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== "hidden");
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first || !last) { event.preventDefault(); dialog.focus(); return; }
    if (!dialog.contains(document.activeElement) ||
      (event.shiftKey && document.activeElement === first) ||
      (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus({ preventScroll: true });
    }
  };
  const outside = (event: MouseEvent) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
  };
  dialog.addEventListener("cancel", cancel);
  dialog.addEventListener("close", close);
  dialog.addEventListener("click", outside);
  dialog.addEventListener("keydown", cycleFocus);
  if (!dialog.open) dialog.showModal();
  document.body.style.overflow = "hidden";
  const first = initialFocus ? dialog.querySelector<HTMLElement>(initialFocus) : null;
  first?.focus({ preventScroll: true });
  return () => {
    dialog.removeEventListener("cancel", cancel);
    dialog.removeEventListener("close", close);
    dialog.removeEventListener("click", outside);
    dialog.removeEventListener("keydown", cycleFocus);
    if (dialog.open) dialog.close();
    document.body.style.overflow = overflow;
    if (previous?.isConnected && !previous.closest("[inert]")) previous.focus({ preventScroll: true });
  };
}

export function useModalFocus(ref: RefObject<HTMLDialogElement | null>, open: boolean, onClose: () => void, initialFocus?: string, returnRef?: RefObject<HTMLElement | null>) {
  const latestClose = useRef(onClose);
  latestClose.current = onClose;
  useEffect(() => {
    if (!open || !ref.current) return;
    return activateModal(ref.current, () => latestClose.current(), initialFocus, returnRef?.current);
  }, [ref, open, initialFocus, returnRef]);
}
