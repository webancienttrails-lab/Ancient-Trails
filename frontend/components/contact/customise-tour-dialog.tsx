"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createContactEnquiry } from "@/lib/enquiries";
import { cn } from "@/lib/utils";

const inputClass = "h-11 w-full min-w-0 rounded-lg border border-secondary/20 bg-white px-3 text-sm font-normal text-secondary outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelClass = "grid min-w-0 content-start gap-1.5 text-sm font-medium text-secondary";

export function CustomiseTourDialog({ destinationName }: { destinationName: string }) {
  return (
    <Dialog>
      <DialogTrigger className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full border border-white/80 bg-black/50 px-4 py-2 font-sans text-[13px] font-medium leading-none text-white backdrop-blur-sm sm:text-[14px]">
        Customise my {destinationName} Tour
        <ArrowRight className="size-3.5 sm:size-4" />
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto overscroll-contain bg-background p-5 sm:max-w-2xl sm:p-7" data-lenis-prevent>
        <DialogHeader className="pr-7">
          <DialogTitle className="text-2xl font-bold text-secondary sm:text-3xl">Customise your tour</DialogTitle>
          <DialogDescription>Tell us about your ideal journey. Fields marked with * are required.</DialogDescription>
        </DialogHeader>
        <CustomiseTourForm destinationName={destinationName} />
      </DialogContent>
    </Dialog>
  );
}

function CustomiseTourForm({ destinationName }: { destinationName: string }) {
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const read = (key: string) => String(data.get(key) || "").trim();

    // Native required validation accepts whitespace; reject it before sending.
    for (const key of ["name", "destination"]) {
      const input = form.elements.namedItem(key) as HTMLInputElement;
      input.setCustomValidity(read(key) ? "" : "Please fill out this field.");
    }
    const phone = form.elements.namedItem("phone") as HTMLInputElement;
    const phoneDigits = read("phone").replace(/\D/g, "");
    const fullPhone = `${read("countryCode")}${phoneDigits}`;
    phone.setCustomValidity(phoneDigits.length >= 6 && /^\+[1-9]\d{6,14}$/.test(fullPhone) ? "" : "Enter a valid contact number.");
    if (!form.reportValidity()) return;

    submitting.current = true;
    setPending(true);
    setFeedback(null);
    try {
      await createContactEnquiry({
        name: read("name"),
        email: read("email"),
        phone: fullPhone,
        subject: "Customised tour request",
        message: [
          `Preferred destination: ${read("destination")}`,
          `Preferred travel dates: ${read("startDate")} to ${read("endDate")}`,
          `Number of travellers: ${read("travellers")}`,
          `Hotel category: ${read("hotelCategory")} star`,
          `Travel preferences / requirements: ${read("preferences") || "Not specified"}`,
          `Additional message: ${read("message") || "Not specified"}`,
          `Submitted from destination: ${destinationName}`,
        ].join("\n"),
      });
      form.reset();
      setStartDate("");
      setFeedback({ kind: "success", message: "Thank you! Your custom tour request has been sent. Our team will contact you soon." });
    } catch {
      setFeedback({ kind: "error", message: "We couldn't send your request. Please try again." });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} onInput={(event) => {
      if (event.target instanceof HTMLInputElement) event.target.setCustomValidity("");
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
          <label htmlFor="customise-phone">Contact Number *</label>
          <div className="flex min-w-0 gap-2">
            <select className={cn(inputClass, "w-24 shrink-0")} name="countryCode" aria-label="Phone country code" defaultValue="+91" autoComplete="tel-country-code">
              <option value="+91">+91</option>
            </select>
            <input id="customise-phone" className={inputClass} name="phone" type="tel" required maxLength={20} pattern="[0-9\s\(\)\-]+" autoComplete="tel-national" placeholder="Contact number" />
          </div>
        </div>
        <label className={labelClass}>
          <span>Preferred Destination *</span>
          <input className={inputClass} name="destination" required maxLength={160} defaultValue={destinationName} />
        </label>
        <fieldset className="grid min-w-0 gap-3 sm:col-span-2 sm:grid-cols-2">
          <legend className="mb-1.5 text-sm font-medium text-secondary">Preferred Travel Dates *</legend>
          <label className={labelClass}>
            <span className="text-xs">Start date *</span>
            <input className={inputClass} name="startDate" type="date" required min={today} value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className={labelClass}>
            <span className="text-xs">End date *</span>
            <input className={inputClass} name="endDate" type="date" required min={startDate || today} />
          </label>
        </fieldset>
        <label className={labelClass}>
          <span>Number of Travellers *</span>
          <input className={inputClass} name="travellers" type="number" required min={1} step={1} placeholder="Number of travellers" />
        </label>
        <label className={labelClass}>
          <span>Hotel Category *</span>
          <select className={inputClass} name="hotelCategory" required defaultValue="">
            <option value="" disabled>Select hotel category</option>
            <option value="3">3 star</option>
            <option value="4">4 star</option>
            <option value="5">5 star</option>
          </select>
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          <span>Travel Preferences / Requirements <span className="font-normal text-secondary/60">(optional)</span></span>
          <textarea className={`${inputClass} h-auto resize-y py-3`} name="preferences" rows={2} maxLength={1000} placeholder="Your interests, dietary needs, accessibility requirements..." />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          <span>Additional Message <span className="font-normal text-secondary/60">(optional)</span></span>
          <textarea className={`${inputClass} h-auto resize-y py-3`} name="message" rows={2} maxLength={1000} placeholder="Anything else you would like us to know" />
        </label>
        <button type="submit" disabled={pending} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-3 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait sm:col-span-2">
          {pending ? "Sending..." : "Submit Request"}
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
        </button>
      </fieldset>
      {feedback ? <p role={feedback.kind === "error" ? "alert" : "status"} className={`mt-4 text-sm ${feedback.kind === "error" ? "text-red-700" : "text-green-700"}`}>{feedback.message}</p> : null}
    </form>
  );
}
