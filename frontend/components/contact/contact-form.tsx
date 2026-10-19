"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createContactEnquiry } from "@/lib/enquiries";

const inputClass = "h-10 w-full min-w-0 rounded-[7px] border border-secondary/15 bg-white px-3 text-[13px] font-normal text-secondary shadow-xs outline-none transition-colors placeholder:text-secondary/40 focus:border-primary focus:ring-2 focus:ring-primary/10";
const labelClass = "grid min-w-0 gap-1.5 text-[13px] font-medium text-secondary";

export function ContactForm() {
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const read = (key: string) => String(data.get(key) || "").trim();
    submitting.current = true;
    setPending(true);
    setFeedback(null);
    try {
      await createContactEnquiry({
        name: read("name"), email: read("email"),
        phone: `${read("countryCode")}${read("phone").replace(/\D/g, "")}`,
        subject: read("subject"), message: read("message"),
      });
      form.reset();
      setFeedback({ kind: "success", message: "Thank you! Your message has been sent. Our team will get back to you soon." });
    } catch {
      setFeedback({ kind: "error", message: "We couldn't send your message. Please try again or contact our team using the details below." });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-0 rounded-[12px] border border-primary/10 bg-white p-5 shadow-[0_10px_40px_color-mix(in_srgb,var(--primary)_7%,transparent)] sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-[27px] font-bold leading-tight text-secondary sm:text-[30px]">Send Us a <span className="text-primary">Message</span></h2>
        <p className="text-[10px] text-primary">Fields marked with * are required</p>
      </div>
      <fieldset disabled={pending} className="min-w-0 disabled:opacity-65">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <label className={labelClass}>
            <span>Full Name <span className="text-primary">*</span></span>
            <input className={inputClass} name="name" required maxLength={160} autoComplete="name" placeholder="Enter your full name" />
          </label>
          <label className={labelClass}>
            <span>Email Address <span className="text-primary">*</span></span>
            <input className={inputClass} name="email" type="email" required maxLength={254} autoComplete="email" placeholder="Enter your email address" />
          </label>
          <div className={labelClass}>
            <label htmlFor="contact-phone">Phone Number <span className="text-primary">*</span></label>
            <div className="flex min-w-0 rounded-[7px] border border-secondary/15 shadow-xs focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
              <select name="countryCode" aria-label="Phone country code" defaultValue="+91" autoComplete="tel-country-code" className="w-[86px] shrink-0 rounded-l-[7px] border-r border-secondary/10 bg-[#fafafa] px-1.5 text-[12px] text-secondary outline-none">
                <option value="+91">🇮🇳 +91</option>
                <option value="+1">🇺🇸 +1</option>
                <option value="+44">🇬🇧 +44</option>
                <option value="+61">🇦🇺 +61</option>
                <option value="+971">🇦🇪 +971</option>
                <option value="+65">🇸🇬 +65</option>
              </select>
              <input id="contact-phone" name="phone" type="tel" required pattern="[0-9 \(\)\-]{6,20}" maxLength={20} autoComplete="tel-national" placeholder="Enter your phone number" className="h-10 w-full min-w-0 rounded-r-[7px] px-3 text-[13px] font-normal text-secondary outline-none placeholder:text-secondary/40" />
            </div>
          </div>
          <label className={labelClass}>
            <span>Subject <span className="text-primary">*</span></span>
            <select className={`${inputClass} text-secondary/65`} name="subject" required defaultValue="">
              <option value="" disabled>Select a subject</option>
              <option>Tour enquiry</option>
              <option>Customized travel</option>
              <option>Booking / Payment</option>
              <option>Cancellation / Refunds</option>
              <option>Partnership</option>
              <option>General enquiry</option>
            </select>
          </label>
        </div>
        <label className={`${labelClass} mt-4`}>
          <span>Your Message <span className="text-primary">*</span></span>
          <textarea className={`${inputClass} h-auto min-h-[110px] resize-y py-3 leading-relaxed`} name="message" required rows={4} maxLength={3000} placeholder="Tell us more about your requirements, preferred destinations, travel dates, or any other details..." />
        </label>
        <Button type="submit" disabled={pending} className="mt-4 h-11 gap-6 bg-primary px-6">
          <span className="text-[14px] font-semibold">{pending ? "Sending..." : "Send Message"}</span>
          {pending ? <LoaderCircle className="size-5 animate-spin" /> : <ArrowRight className="size-6" />}
        </Button>
      </fieldset>
      {feedback ? <p role={feedback.kind === "error" ? "alert" : "status"} className={`mt-4 text-[13px] leading-relaxed ${feedback.kind === "error" ? "text-red-700" : "text-green-700"}`}>{feedback.message}</p> : null}
    </form>
  );
}
