export function getBookingKycDocumentTypes(tourType?: string, countryRegion?: string): string[] {
  const type = tourType?.trim().toLowerCase();
  const country = countryRegion?.trim().toLowerCase();
  const international = type === "international" || (type !== "domestic" && Boolean(country && country !== "india"));
  return international ? ["pan_card"] : ["voter_id", "driving_license", "pan_card"];
}

export function getTravellerKycDocumentTypes(baseTypes: string[], isNri: boolean): string[] {
  return isNri && baseTypes.length === 1 && baseTypes[0] === "pan_card"
    ? [...baseTypes, "visa", "oci"]
    : baseTypes;
}

export function hasRequiredBookingKycDocuments(uploadedTypes: string[], allowedTypes: string[]): boolean {
  return allowedTypes.includes("visa")
    ? ["pan_card", "visa"].every((type) => uploadedTypes.includes(type))
    : allowedTypes.some((type) => uploadedTypes.includes(type));
}

// Call with stored documents or documents resolved from server-signed upload tokens.
export function isTravellerTcsExempt(traveller: {
  isNri?: boolean;
  tcsExemptionVerified?: boolean;
  kycDocuments?: Array<{ documentType: string; fileUrl: string }>;
}): boolean {
  return Boolean(traveller.isNri && traveller.kycDocuments?.some(
    (document) => document.documentType === "visa" && document.fileUrl.trim().length > 0
  ));
}
