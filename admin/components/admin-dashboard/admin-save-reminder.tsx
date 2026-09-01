"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { useToast } from "@/components/ui/toast";

const editableControlSelector = [
  "input:not([type='hidden']):not([type='search']):not([readonly]):not([disabled])",
  "select:not([disabled])",
  "textarea:not([readonly]):not([disabled])",
  "[contenteditable='true']",
].join(",");

function getEditableForm(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }

  const form = target.closest("form");

  if (!form || form.dataset.adminIgnoreSaveReminder === "true") {
    return null;
  }

  const hasSubmitAction = Boolean(
    form.querySelector("button[type='submit'], input[type='submit']")
  );
  const hasEditableControl = Boolean(form.querySelector(editableControlSelector));

  return hasSubmitAction && hasEditableControl ? form : null;
}

function isEditableEventTarget(target: EventTarget | null) {
  return target instanceof Element && target.matches(editableControlSelector);
}

function isSaveReminderAction(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  const action = target.closest("button, [role='button']");

  if (!action || action.closest("button[type='submit']")) {
    return false;
  }

  const label = [
    action.textContent,
    action.getAttribute("aria-label"),
    action.getAttribute("title"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /\b(add|remove|upload|use hero|auto place)\b/.test(label);
}

export function AdminSaveReminder() {
  const toast = useToast();
  const pathname = usePathname();
  const lastToastAtRef = useRef(0);

  useEffect(() => {
    document
      .querySelectorAll("form[data-admin-unsaved='true']")
      .forEach((form) => {
        delete (form as HTMLFormElement).dataset.adminUnsaved;
      });
  }, [pathname]);

  useEffect(() => {
    if (pathname === "/login") {
      return;
    }

    function showReminder(form: HTMLFormElement) {
      if (form.dataset.adminUnsaved === "true") {
        return;
      }

      form.dataset.adminUnsaved = "true";

      const now = Date.now();

      if (now - lastToastAtRef.current < 1200) {
        return;
      }

      lastToastAtRef.current = now;
      toast.warning("Save required", "Click Save to keep this action.");
    }

    function handleEdit(event: Event) {
      if (!isEditableEventTarget(event.target)) {
        return;
      }

      const form = getEditableForm(event.target);

      if (form) {
        showReminder(form);
      }
    }

    function handleActionClick(event: MouseEvent) {
      if (!isSaveReminderAction(event.target)) {
        return;
      }

      const form = getEditableForm(event.target);

      if (form) {
        showReminder(form);
      }
    }

    function handleSubmit(event: SubmitEvent) {
      const form = event.target;

      if (form instanceof HTMLFormElement) {
        delete form.dataset.adminUnsaved;
      }
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!document.querySelector("form[data-admin-unsaved='true']")) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    document.addEventListener("input", handleEdit, true);
    document.addEventListener("change", handleEdit, true);
    document.addEventListener("click", handleActionClick, true);
    document.addEventListener("submit", handleSubmit, true);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("input", handleEdit, true);
      document.removeEventListener("change", handleEdit, true);
      document.removeEventListener("click", handleActionClick, true);
      document.removeEventListener("submit", handleSubmit, true);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [pathname, toast]);

  return null;
}
