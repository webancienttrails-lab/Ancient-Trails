"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { updateAdminBookingTravelDetails, type AdminBooking, type BookingHotelDetail, type BookingFlightDetail } from "@/lib/bookings";

export function BookingTravelDetailsDialog({ booking, kind, onClose, onSaved }: {
  booking: AdminBooking;
  kind: "hotel" | "flight";
  onClose: () => void;
  onSaved: (booking: AdminBooking) => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const blankHotel = (): BookingHotelDetail => ({ destination: "", hotel: "", category: "", nights: 1 });
  const blankFlight = (): BookingFlightDetail => ({ from: "", to: "", airline: "", seats: booking.totalGuest || 1, dateTime: "" });
  const [hotels, setHotels] = useState<BookingHotelDetail[]>(() => booking.hotelDetails?.length ? booking.hotelDetails.map(row => ({ ...row })) : [blankHotel()]);
  const [flights, setFlights] = useState<BookingFlightDetail[]>(() => booking.flightDetails?.length ? booking.flightDetails.map(row => ({ ...row })) : [blankFlight()]);
  const rows = kind === "hotel" ? hotels : flights;
  const fields = kind === "hotel"
    ? [{ key: "destination", label: "Destination", max: 200 }, { key: "hotel", label: "Hotel name", max: 200 }, { key: "category", label: "Hotel category", max: 160 }, { key: "nights", label: "Nights", max: 365 }]
    : [{ key: "from", label: "From", max: 200 }, { key: "to", label: "To", max: 200 }, { key: "airline", label: "Airline / flight number", max: 300 }, { key: "seats", label: "Seats", max: 1000 }, { key: "dateTime", label: "Departure date and time (local)", max: 16 }];

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await updateAdminBookingTravelDetails(booking.id, kind === "hotel" ? { hotelDetails: hotels } : { flightDetails: flights });
      onSaved(response.data.booking);
      toast.success("Travel details saved", "The saved details will appear in this booking's voucher.");
      onClose();
    } catch (error) {
      toast.error("Could not save details", error instanceof Error ? error.message : "Please try again.");
    } finally { setSaving(false); }
  }

  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
    <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] flex-col overflow-hidden p-0 sm:max-w-3xl">
      <form onSubmit={save} className="flex min-h-0 flex-col overflow-hidden">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-5 pr-12">
          <DialogTitle>{kind === "hotel" ? "Hotel details" : "Flight details"}</DialogTitle>
          <DialogDescription>{booking.bookingReference || booking.id} — Details saved here appear in the booking voucher.</DialogDescription>
        </DialogHeader>
        <fieldset disabled={saving} className="min-h-0 overflow-y-auto p-6">
          <div className="grid gap-4">
            {rows.map((row, index) => <fieldset key={index} className="rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-semibold">{kind === "hotel" ? "Hotel" : "Flight"} {index + 1}</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                {fields.map(field => {
                  const numeric = field.key === "nights" || field.key === "seats";
                  const value = (row as unknown as Record<string, string | number>)[field.key];
                  return <label key={field.key} className="grid gap-2 text-sm">
                    {field.label} *
                    <input required type={numeric ? "number" : field.key === "dateTime" ? "datetime-local" : "text"}
                      min={numeric ? 1 : undefined} max={numeric ? field.max : undefined} step={numeric ? 1 : undefined}
                      maxLength={!numeric ? field.max : undefined} value={value ?? ""}
                      onChange={event => {
                        const next = numeric ? Number(event.target.value) : event.target.value;
                        if (kind === "hotel") setHotels(current => current.map((item, i) => i === index ? { ...item, [field.key]: next } : item));
                        else setFlights(current => current.map((item, i) => i === index ? { ...item, [field.key]: next } : item));
                      }} className="h-11 min-w-0 w-full rounded-md border border-border bg-white px-3" />
                  </label>;
                })}
              </div>
              <Button type="button" variant="outline" className="mt-4" onClick={() => kind === "hotel" ? setHotels(current => current.filter((_, i) => i !== index)) : setFlights(current => current.filter((_, i) => i !== index))}>Remove {kind}</Button>
            </fieldset>)}
          </div>
          {!rows.length && <p className="mb-4 text-sm text-foreground/60">No {kind} details. Save to clear previously added details.</p>}
          <Button type="button" variant="outline" className="mt-4" disabled={rows.length >= 50} onClick={() => kind === "hotel" ? setHotels(current => [...current, blankHotel()]) : setFlights(current => [...current, blankFlight()])}>Add {kind}</Button>
        </fieldset>
        <DialogFooter className="mb-0 shrink-0 border-t border-border px-6 pt-4 pb-6">
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save details"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
