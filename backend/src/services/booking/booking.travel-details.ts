import { z } from "zod";

const text = (max: number) => z.string().trim().min(1, "This field is required").max(max);
const dateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Enter a valid date and time").refine((value) => {
  const date = new Date(`${value}:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 16) === value;
}, "Enter a valid date and time");

export const bookingTravelDetailsSchema = z.object({
  hotelDetails: z.array(z.object({
    destination: text(200), hotel: text(200), category: text(160),
    nights: z.number().int().min(1).max(365),
  }).strict()).max(50).optional(),
  flightDetails: z.array(z.object({
    from: text(200), to: text(200), airline: text(300),
    seats: z.number().int().min(1).max(1000), dateTime,
  }).strict()).max(50).optional(),
}).strict().refine((value) => value.hotelDetails !== undefined || value.flightDetails !== undefined, "Add hotel or flight details");
