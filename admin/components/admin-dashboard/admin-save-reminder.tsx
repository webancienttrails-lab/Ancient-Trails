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
const submitControlSelector = "button[type='submit'], input[type='submit']";

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

  if (!action || action.closest(submitControlSelector)) {
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

  return /\b(add|remove|upload|delete|archive|publish|duplicate|use hero|auto place)\b/.test(label);
}

function getUnsavedForm() {
  const form = document.querySelector("form[data-admin-unsaved='true']");

  return form instanceof HTMLFormElement ? form : null;
}

function getNavigationLink(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }

  const link = target.closest("a[href]");

  if (!(link instanceof HTMLAnchorElement)) {
    return null;
  }

  const href = link.getAttribute("href") || "";

  if (
    !href ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    link.hasAttribute("download")
  ) {
    return null;
  }

  return link;
}

function isVisibleControl(control: HTMLElement) {
  return control.getClientRects().length > 0;
}

function getHeaderSaveControl() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) =>
      isVisibleControl(button) &&
      !button.disabled &&
      /^save\b/i.test(button.textContent?.trim() || "")
  );
}

function getFormSaveControl(form: HTMLFormElement) {
  const controls = Array.from(
    form.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
      submitControlSelector
    )
  );

  return controls.find(isVisibleControl) || controls[0] || null;
}

function focusSaveControl(form: HTMLFormElement) {
  const saveControl = getFormSaveControl(form) || getHeaderSaveControl();

  if (!saveControl) {
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  saveControl.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "nearest",
  });
  saveControl.focus({ preventScroll: true });
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

    function showReminder(form: HTMLFormElement, forceToast = false) {
      form.dataset.adminUnsaved = "true";

      const now = Date.now();

      if (!forceToast && now - lastToastAtRef.current < 1200) {
        return;
      }

      lastToastAtRef.current = now;
      toast.warning("Save required", "Click Save to keep this action.");
    }

    function blockUntilSaved(event: MouseEvent, form: HTMLFormElement) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      showReminder(form, true);
      focusSaveControl(form);
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
      const unsavedForm = getUnsavedForm();

      if (unsavedForm && getNavigationLink(event.target)) {
        blockUntilSaved(event, unsavedForm);
        return;
      }

      if (!isSaveReminderAction(event.target)) {
        return;
      }

      const form = getEditableForm(event.target);

      if (form?.dataset.adminUnsaved === "true") {
        blockUntilSaved(event, form);
        return;
      }

      if (form) {
        showReminder(form, true);
        focusSaveControl(form);
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
