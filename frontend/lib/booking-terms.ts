export const bookingTerms = {
  "twin-sharing": {
    label: "Twin sharing",
    explanation: "Two guests share one room; separate beds are subject to availability.",
  },
  "registration-amount": {
    label: "Registration amount (deposit)",
    explanation: "The first part of the tour price you pay when registering.",
  },
  advance: {
    label: "Advance",
    explanation: "Pay part of your total now and the remaining balance by the due date.",
  },
  offline: {
    label: "Offline payment",
    explanation: "Pay by cash or cheque; your booking stays pending until payment is received and confirmed.",
  },
} as const;

export type BookingTerm = keyof typeof bookingTerms;
export const bookingTermsHref = "/faq#booking-terms-explained";
