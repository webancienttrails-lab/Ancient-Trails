"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { LoaderCircle, X } from "lucide-react";
import { Button, ButtonArrow } from "@/components/ui/button";
import {
  Dialog, DialogClose, DialogDescription, DialogHeader, DialogOverlay,
  DialogPortal, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { createContactEnquiry } from "@/lib/enquiries";
import { cn } from "@/lib/utils";

const categories = [
  { value: "photographers", label: "Photographers" },
  { value: "dancers", label: "Dancers" },
  { value: "artists", label: "Artists" },
  { value: "bikers", label: "Bikers" },
  { value: "kids", label: "Kids" },
  { value: "foreigners", label: "Foreigners & NRIs" },
];
const inputClass = "h-11 w-full min-w-0 rounded-lg border border-secondary/20 bg-white px-3 text-base font-normal text-secondary outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:text-sm";
const labelClass = "grid min-w-0 content-start gap-1.5 text-sm font-medium text-secondary";

export function SpecialisedTourEnquiryButton({ category = "", className, children }: {
  category?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button className={className} />}>{children}</DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="z-[2147483647] bg-secondary/45 backdrop-blur-sm" />
        <DialogPrimitive.Popup data-lenis-prevent className="fixed inset-x-0 bottom-0 z-[2147483647] grid max-h-[90dvh] w-full min-w-0 gap-5 overflow-y-auto overscroll-contain rounded-t-3xl border border-primary/15 bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] font-sans shadow-2xl outline-none transition-[opacity,transform,translate] duration-300 ease-out data-starting-style:opacity-0 data-ending-style:opacity-0 max-sm:data-starting-style:translate-y-full max-sm:data-ending-style:translate-y-full motion-reduce:transition-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-[640px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:p-7">
          <DialogHeader className="relative pr-10">
            <DialogTitle className="font-heading text-2xl font-bold text-secondary">Plan Your Specialised Tour</DialogTitle>
            <DialogDescription>Tell us about your group. Fields marked with * are required.</DialogDescription>
            <DialogClose aria-label="Close specialised tour form" className="absolute right-0 top-0 grid size-8 cursor-pointer place-items-center rounded-full bg-secondary/10 text-secondary hover:bg-primary/15"><X className="size-4" /></DialogClose>
          </DialogHeader>
          <SpecialisedTourForm initialCategory={category} />
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}

function SpecialisedTourForm({ initialCategory }: { initialCategory: string }) {
  const id = useId();
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const read = (name: string) => String(data.get(name) || "").trim();
    const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement;
    const digits = read("phone").replace(/\D/g, "");
    const phone = `${read("countryCode")}${digits}`;
    const category = categories.find(item => item.value === read("category"));
    field("name").setCustomValidity(read("name") ? "" : "Enter your full name.");
    field("phone").setCustomValidity(/^[\d\s()-]+$/.test(read("phone")) && digits.length >= 6 && /^\+[1-9]\d{6,14}$/.test(phone) ? "" : "Enter a valid contact number.");
    field("category").setCustomValidity(category ? "" : "Select who the specialised tour is for.");
    field("participants").setCustomValidity(Number.isSafeInteger(Number(read("participants"))) && Number(read("participants")) > 0 ? "" : "Enter a whole number of participants, at least 1.");
    if (!form.reportValidity() || !category) return;

    submitting.current = true;
    setPending(true);
    setFeedback(null);
    try {
      await createContactEnquiry({
        name: read("name"), email: read("email"), phone,
        subject: `Specialised tour enquiry: ${category.label}`,
        message: [
          `Specialised Tour For: ${category.label}`,
          `Preferred Date: ${read("preferredDate")}`,
          `Number of Participants: ${read("participants")}`,
          `Message / Requirements: ${read("requirements") || "Not specified"}`,
        ].join("\n"),
      });
      form.reset();
      setFeedback({ kind: "success", message: "Thank you! Your specialised tour enquiry has been sent. Our team will contact you soon." });
    } catch {
      setFeedback({ kind: "error", message: "We couldn't send your enquiry. Please try again." });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} onInput={event => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) event.target.setCustomValidity("");
      if (event.target instanceof HTMLSelectElement && event.target.name === "countryCode") {
        (event.currentTarget.elements.namedItem("phone") as HTMLInputElement).setCustomValidity("");
      }
    }}>
      <fieldset disabled={pending} className="grid min-w-0 gap-4 disabled:opacity-65 sm:grid-cols-2">
        <label className={labelClass}>
          <span>Full Name *</span>
          <input className={inputClass} name="name" required maxLength={160} autoComplete="name" placeholder="Enter your full name" />
        </label>
        <label className={labelClass}>
          <span>Email Address *</span>
          <input className={inputClass} name="email" type="email" required maxLength={254} autoComplete="email" placeholder="Enter your email address" />
        </label>
        <div className={labelClass}>
          <label htmlFor={`${id}-phone`}>Contact Number *</label>
          <div className="flex min-w-0 gap-2">
            <select className={cn(inputClass, "w-24 shrink-0")} name="countryCode" aria-label="Phone country code" defaultValue="+91" autoComplete="tel-country-code">
              <option value="+91">+91</option>
            </select>
            <input id={`${id}-phone`} className={inputClass} name="phone" type="tel" required maxLength={20} autoComplete="tel-national" placeholder="Contact number" />
          </div>
        </div>
        <label className={labelClass}>
          <span>Specialised Tour For *</span>
          <select className={inputClass} name="category" required defaultValue={initialCategory}>
            <option value="" disabled>Select a category</option>
            {categories.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          <span>Preferred Date *</span>
          <input className={inputClass} name="preferredDate" type="date" required min={today} />
        </label>
        <label className={labelClass}>
          <span>Number of Participants *</span>
          <input className={inputClass} name="participants" type="number" required min={1} step={1} placeholder="Number of participants" />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          <span>Message / Requirements <span className="font-normal text-secondary/60">(optional)</span></span>
          <textarea className={`${inputClass} h-auto resize-y py-3`} name="requirements" rows={3} maxLength={2500} placeholder="Tell us about your interests, group and any special requirements" />
        </label>
        <Button type="submit" disabled={pending} className="mt-1 h-auto min-h-11 min-w-0 gap-5 whitespace-normal px-5 py-2 font-normal sm:col-span-2">
          {pending ? "Sending..." : "Submit Enquiry"}
          {pending ? <LoaderCircle className="size-5 animate-spin" /> : <ButtonArrow className="brightness-0 invert group-hover/button:brightness-100 group-hover/button:invert-0" />}
        </Button>
      </fieldset>
      {feedback && <p role={feedback.kind === "error" ? "alert" : "status"} className={`mt-4 text-sm ${feedback.kind === "error" ? "text-red-700" : "text-green-700"}`}>{feedback.message}</p>}
    </form>
  );
}
