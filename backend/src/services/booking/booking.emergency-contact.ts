type EmergencyContact = {
  emergencyContactName?: string;
  emergencyContactMobileNumber?: string;
};

type BookingContactSource = EmergencyContact & {
  guestDetails?: EmergencyContact[];
  travellers?: (EmergencyContact & { id?: string; type?: string })[];
};

// The form collects one emergency contact for the booking, on its lead traveller.
// Accept older payloads while keeping that contact through unrelated admin edits.
export function resolveBookingEmergencyContact(
  source: BookingContactSource,
  existing?: BookingContactSource,
) {
  const candidates = (booking?: BookingContactSource) => [
    booking,
    booking?.guestDetails?.[0],
    booking?.travellers?.find(traveller => traveller.id === "adult-1")
      || booking?.travellers?.find(traveller => traveller.type === "adult")
      || booking?.travellers?.[0],
  ];
  const contact = [...candidates(source), ...candidates(existing)].find(candidate =>
    candidate?.emergencyContactName?.trim() || candidate?.emergencyContactMobileNumber?.trim()
  );
  return {
    emergencyContactName: contact?.emergencyContactName?.trim() || "",
    emergencyContactMobileNumber: contact?.emergencyContactMobileNumber?.trim() || "",
  };
}
