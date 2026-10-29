"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Building2, LoaderCircle, Mail, Phone } from "lucide-react";
import {
  Dialog, DialogClose, DialogDescription, DialogHeader, DialogOverlay, DialogPortal, DialogTitle,
} from "@/components/ui/dialog";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { createCallbackEnquiry } from "@/lib/enquiries";
import {
  defaultSiteContactSettings, getMailtoHref, getPublicSiteSettings,
  getTelephoneHref, type SiteContactSettings,
} from "@/lib/site-settings";

export function QuoteDialog({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const id = useId();
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [contact, setContact] = useState<SiteContactSettings>(defaultSiteContactSettings);
  const [heading, setHeading] = useState("Looking for assistance?");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    getPublicSiteSettings().then(({ data }) => {
      if (!active) return;
      setContact(data.settings.contact);
      setHeading(data.settings.quoteAssistanceTitle || "Looking for assistance?");
    }).catch(() => { /* Keep the site's contact defaults if settings are unavailable. */ });
    return () => { active = false; };
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const mobile = String(data.get("phone") || "").trim();
    const digits = mobile.replace(/\D/g, "");
    const phone = `${data.get("countryCode")}${digits}`;
    const nextErrors = {
      name: name ? undefined : "Full Name is required",
      phone: !mobile ? "Mobile No. is required" :
        /^[\d\s()-]+$/.test(mobile) && digits.length >= 6 && /^\+[1-9]\d{6,14}$/.test(phone)
          ? undefined : "Enter a valid mobile number",
    };
    setErrors(nextErrors);
    setFeedback(null);
    if (nextErrors.name || nextErrors.phone) {
      (form.elements.namedItem(nextErrors.name ? "name" : "phone") as HTMLInputElement)?.focus();
      return;
    }
    submitting.current = true;
    setPending(true);
    try {
      await createCallbackEnquiry({ name, phone });
      form.reset();
      setFeedback({ kind: "success", message: "Thank you! Our team will call you to help with your quote." });
    } catch {
      setFeedback({ kind: "error", message: "We couldn't send your request. Please try again or contact us below." });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  const phone = contact.primaryCalling || contact.landline || contact.secondaryCalling;
  const inputClass = "h-12 w-full min-w-0 rounded-lg border bg-white px-3 text-base text-secondary outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
      <DialogOverlay className="z-[2147483647] bg-secondary/45 backdrop-blur-sm" />
      <DialogPrimitive.Popup className="fixed inset-x-0 bottom-0 z-[2147483647] grid max-h-[90dvh] w-full min-w-0 gap-5 overflow-y-auto overscroll-contain rounded-t-3xl border border-primary/15 bg-background p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] font-sans shadow-2xl outline-none transition-transform duration-300 ease-out max-sm:data-starting-style:translate-y-full max-sm:data-ending-style:translate-y-full motion-reduce:transition-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-[440px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:pb-6" data-lenis-prevent>
        <DialogHeader className="relative pr-10">
          <DialogTitle className="font-heading text-2xl font-bold text-secondary">Want us to call you?</DialogTitle>
          <DialogDescription className="sr-only">Request a travel quote with your full name and mobile number.</DialogDescription>
          <DialogClose aria-label="Close quote form" className="absolute right-0 top-1/2 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-secondary/10 text-secondary hover:bg-primary/15"><X className="size-4" /></DialogClose>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit}>
          <fieldset disabled={pending} className="grid min-w-0 gap-5 disabled:opacity-65">
            <div>
              <label htmlFor={`${id}-name`} className="mb-1.5 block text-sm font-medium text-secondary">Full Name <span className="text-brand-text">*</span></label>
              <input id={`${id}-name`} name="name" required maxLength={160} autoComplete="name" placeholder="Enter your full name"
                aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? `${id}-name-error` : undefined}
                onChange={() => setErrors(value => ({ ...value, name: undefined }))}
                className={`${inputClass} ${errors.name ? "border-red-500" : "border-secondary/25"}`} />
              {errors.name && <p id={`${id}-name-error`} className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor={`${id}-phone`} className="mb-1.5 block text-sm font-medium text-secondary">Mobile No. <span className="text-brand-text">*</span></label>
              <div className={`flex min-w-0 rounded-lg border bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 ${errors.phone ? "border-red-500" : "border-secondary/25"}`}>
                <select name="countryCode" defaultValue="+91" autoComplete="tel-country-code" aria-label="Phone country code"
                  onChange={() => setErrors(value => ({ ...value, phone: undefined }))}
                  className="w-24 shrink-0 rounded-l-lg border-r border-secondary/15 bg-transparent px-2 text-sm text-secondary outline-none">
                  <option value="+91">+91</option>
                </select>
                <input id={`${id}-phone`} name="phone" type="tel" inputMode="tel" required maxLength={20} autoComplete="tel-national" placeholder="Mobile number"
                  aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? `${id}-phone-error` : undefined}
                  onChange={() => setErrors(value => ({ ...value, phone: undefined }))}
                  className="h-12 w-full min-w-0 rounded-r-lg bg-transparent px-3 text-base text-secondary outline-none" />
              </div>
              {errors.phone && <p id={`${id}-phone-error`} className="mt-1 text-xs text-red-600">{errors.phone}</p>}
            </div>
            <button type="submit" className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-3 rounded-lg bg-primary px-4 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-wait">
              {pending ? <LoaderCircle className="size-5 animate-spin" /> : <Phone className="size-5" />}
              {pending ? "Submitting..." : "Submit here"}
            </button>
          </fieldset>
          {feedback && <p role={feedback.kind === "error" ? "alert" : "status"} className={`mt-3 text-sm ${feedback.kind === "error" ? "text-red-700" : "text-green-700"}`}>{feedback.message}</p>}
        </form>
        <div className="border-t border-primary/15 pt-4 text-secondary">
          <h3 className="mb-3 text-lg font-medium text-secondary/65">{heading}</h3>
          <div className="grid gap-3 text-sm font-semibold [&_a]:underline [&_a]:underline-offset-4 [&_a]:transition-colors [&_a]:hover:text-brand-text">
            {phone && <a href={getTelephoneHref(phone)} className="flex items-center gap-3"><Phone className="size-4 shrink-0 text-brand-text" />{phone}</a>}
            {contact.emailId && <a href={getMailtoHref(contact.emailId)} className="flex items-center gap-3 break-all"><Mail className="size-4 shrink-0 text-brand-text" />{contact.emailId}</a>}
            {contact.officeAddress && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.officeAddress)}`} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3"><Building2 className="mt-0.5 size-4 shrink-0 text-brand-text" /><span><span className="block">Locate our office</span><span className="mt-1 block text-xs font-normal leading-relaxed text-secondary/65">{contact.officeAddress}</span></span></a>}
          </div>
        </div>
      </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
