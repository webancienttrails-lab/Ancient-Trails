"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Minus, Plus, Save } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { EnquiryPayload } from "@/lib/enquiries";
import { listAdminTourDepartures, type AdminTour, type AdminTourDeparture } from "@/lib/tours";
import "./group-enquiry-form.css";

type GuestCounts = { adults: number; children: number; infants: number };
const groupEnquirySources: EnquiryPayload["source"][] = ["Website", "Contact Form", "Email", "Phone Call"];

const guestTypes = [
  { key: "adults", label: "Adult", age: "Above 12 years", minimum: 1 },
  { key: "children", label: "Child", age: "Above 6 to 12 years", minimum: 0 },
  { key: "infants", label: "Infant", age: "Below 6 years", minimum: 0 },
] as const;

export function createGroupEnquiryPayload(data: FormData, tour: AdminTour, counts: GuestCounts): EnquiryPayload {
  const read = (key: string) => String(data.get(key) || "").trim();
  return {
    name: read("name"),
    email: read("email"),
    phone: read("phone"),
    gender: read("gender"),
    tourId: tour.id,
    tourName: tour.tourName,
    subject: `Tour enquiry - ${tour.tourName}`,
    message: [
      `Tour: ${tour.tourName}`,
      `Tour ID: ${tour.tourId}`,
      read("city") ? `Current City: ${read("city")}` : "",
      `Guests: ${counts.adults} Adult, ${counts.children} Child, ${counts.infants} Infant`,
      `Travel Date: ${read("travelDate")}`,
    ].filter(Boolean).join("\n"),
    source: groupEnquirySources.find((source) => source === read("source")) || "Website",
    status: "New",
  };
}

export function GroupEnquiryForm({ tours, onClose, onSubmit }: {
  tours: AdminTour[];
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>, payload: EnquiryPayload) => Promise<void>;
}) {
  const [selectedTourId, setSelectedTourId] = useState("");
  const [counts, setCounts] = useState<GuestCounts>({ adults: 1, children: 0, infants: 0 });
  const [departures, setDepartures] = useState<AdminTourDeparture[]>([]);
  const [isLoadingDates, setIsLoadingDates] = useState(true);
  const [datesError, setDatesError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedTour = tours.find((tour) => tour.id === selectedTourId);

  useEffect(() => {
    let active = true;
    void listAdminTourDepartures()
      .then((result) => { if (active) setDepartures(result.data.departures); })
      .catch(() => { if (active) setDatesError("Unable to load travel dates. Please close the form and try again."); })
      .finally(() => { if (active) setIsLoadingDates(false); });
    return () => { active = false; };
  }, []);

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const travelDates = [...new Set(departures
    .filter((departure) => selectedTour &&
      (departure.tourId === selectedTour.id || departure.tourId === selectedTour.tourId) &&
      (departure.status === "scheduled" || departure.status === "coming_soon") &&
      departure.departureDate && !Number.isNaN(Date.parse(departure.departureDate)) &&
      departure.departureDate.slice(0, 10) >= today)
    .map((departure) => departure.departureDate!.slice(0, 10)))].sort();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTour || isSubmitting || isLoadingDates || datesError) return;
    const payload = createGroupEnquiryPayload(new FormData(event.currentTarget), selectedTour, counts);
    setIsSubmitting(true);
    try {
      await onSubmit(event, payload);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !isSubmitting) onClose(); }}>
      <DialogContent data-admin-group-enquiry-form showCloseButton={false} className="flex h-[90dvh] max-h-[90dvh] flex-col gap-0 overflow-hidden rounded-[14px] bg-white p-5 text-[#383838] sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div data-admin-popup-header className="mb-4 flex shrink-0 items-center justify-between gap-4 border-b border-border pb-3">
            <DialogTitle className="font-heading text-lg font-bold">Add Enquiry</DialogTitle>
            <button type="button" aria-label="Close enquiry form" disabled={isSubmitting} onClick={onClose} className="cursor-pointer text-sm font-semibold text-foreground/55 hover:text-foreground focus-visible:outline-2 focus-visible:outline-orange-500 disabled:opacity-50">Close</button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-2">
            <DialogDescription className="sr-only">
              Do you have any questions before you book? Complete the form below and our tour team will get back to you shortly.
            </DialogDescription>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tour *" fullWidth>
                <select required name="tourId" value={selectedTourId} onChange={(event) => setSelectedTourId(event.target.value)}>
                  <option value="">{tours.length ? "Select a tour" : "No tours available"}</option>
                  {tours.map((tour) => <option key={tour.id} value={tour.id}>{tour.tourName} ({tour.tourId})</option>)}
                </select>
              </Field>
              <Field label="Your Name *"><input required name="name" maxLength={160} placeholder="Your Name" /></Field>
              <Field label="Email address *"><input required type="email" name="email" maxLength={254} placeholder="Email address" /></Field>
              <Field label="Phone Number *"><input required type="tel" name="phone" maxLength={24} placeholder="Phone Number" /></Field>
              <Field label="Gender">
                <select name="gender" defaultValue="">
                  <option value="">Select gender (optional)</option>
                  <option>Female</option><option>Male</option><option>Non-binary</option><option>Other</option><option>Prefer not to say</option>
                </select>
              </Field>
              <Field label="Current City"><input name="city" maxLength={120} placeholder="Current City" /></Field>
              <fieldset className="min-w-0 sm:col-span-2">
                <legend className="mb-1.5 text-xs font-semibold">Total No. of Guests *</legend>
                <div className="flex flex-wrap gap-2 pb-1">
                  {guestTypes.map(({ key, label, age, minimum }) => (
                    <div key={key} className="grid min-w-0 flex-[1_1_130px] content-start gap-1.5">
                      <span className="text-xs font-semibold">{label}</span>
                      <span className="flex h-10 min-w-0 items-center justify-between gap-2 rounded-[14px] border border-[#ead8cb] bg-white px-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
                        <button type="button" aria-label={`Decrease ${label} count`} disabled={counts[key] <= minimum} onClick={() => setCounts((current) => ({ ...current, [key]: Math.max(minimum, current[key] - 1) }))} className="grid size-7 cursor-pointer place-items-center rounded-full border border-[#ed721e] text-[#ed721e] disabled:cursor-default disabled:opacity-40"><Minus className="size-4" /></button>
                        <output aria-label={`${label} count`} className="min-w-4 text-center text-sm" aria-live="polite">{counts[key]}</output>
                        <button type="button" aria-label={`Increase ${label} count`} onClick={() => setCounts((current) => ({ ...current, [key]: current[key] + 1 }))} className="grid size-7 cursor-pointer place-items-center rounded-full border border-[#ed721e] text-[#ed721e]"><Plus className="size-4" /></button>
                      </span>
                      <span className="whitespace-normal break-words text-xs font-normal text-[#929292]">{age}</span>
                    </div>
                  ))}
                </div>
              </fieldset>
              <Field label="Date Of Travel *">
                <select key={selectedTourId} required name="travelDate" defaultValue="" disabled={!selectedTour || isLoadingDates || Boolean(datesError)}>
                  {!selectedTour ? <option value="">Select a tour first</option> : isLoadingDates ? <option value="">Loading travel dates...</option> : datesError ? <option value="">Unable to load dates</option> : travelDates.length ? <>
                    <option value="">Select travel date</option>
                    {travelDates.map((date) => <option key={date} value={date}>{new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`))}</option>)}
                  </> : <option value="To be announced">Dates to be announced</option>}
                </select>
              </Field>
              <Field label="Source">
                <select name="source" defaultValue="Website">
                  {groupEnquirySources.map((source) => <option key={source} value={source}>{source}</option>)}
                </select>
              </Field>
            </div>
            {datesError ? <p role="alert" className="mt-3 text-sm text-red-700">{datesError}</p> : null}
          </div>

          <div data-admin-popup-footer className="mt-4 flex shrink-0 justify-end border-t border-border pt-3">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || !selectedTour || isLoadingDates || Boolean(datesError)}>
              <Save className="size-4" data-icon="inline-start" />{isSubmitting ? "Saving..." : "Save Enquiry"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, fullWidth = false, children }: { label: string; fullWidth?: boolean; children: ReactNode }) {
  return <label className={`grid min-w-0 content-start gap-1.5 text-xs font-semibold ${fullWidth ? "sm:col-span-2" : ""}`}>{label}{children}</label>;
}
