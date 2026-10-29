import Link from "next/link";
import { bookingTerms, bookingTermsHref, type BookingTerm } from "@/lib/booking-terms";
import { cn } from "@/lib/utils";

export function BookingTermExplanation({ term, className }: { term: BookingTerm; className?: string }) {
  return <span className={cn("mt-1 block font-sans text-[12px] font-normal leading-relaxed text-secondary/75", className)}>{bookingTerms[term].explanation}</span>;
}

export function BookingTermsLink({ className }: { className?: string }) {
  return <Link href={bookingTermsHref} target="_blank" rel="noopener noreferrer" aria-label="What do these mean? Opens booking explanations in a new tab" className={cn("mt-2 inline-flex font-sans text-[12px] font-medium text-brand-text underline underline-offset-4 hover:text-accent", className)}>What do these mean?</Link>;
}

export function BookingTermsGlossary() {
  return (
    <section id="booking-terms-explained" className="mt-10 scroll-mt-28 rounded-lg border border-primary/20 bg-primary/5 p-5 sm:p-6">
      <h2 className="font-heading text-2xl font-bold text-secondary">What do these mean?</h2>
      <dl className="mt-5 grid gap-5 sm:grid-cols-2">
        {Object.entries(bookingTerms).map(([key, term]) => (
          <div key={key}>
            <dt className="font-sans text-sm font-semibold text-secondary">{term.label}</dt>
            <dd className="mt-1 font-sans text-sm leading-relaxed text-secondary/75">{term.explanation}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
