import type { EnquiryCategory } from "@/lib/enquiries";

export function getBookingAddContext(category: string | null, enquiryCategory?: EnquiryCategory) {
  const resolvedCategory = enquiryCategory || (category === "group" || category === "customise" ? category : "normal");
  return {
    category: resolvedCategory,
    tourScope: resolvedCategory === "customise" ? "customise" as const : "master" as const,
    title: resolvedCategory === "group" ? "Add Group Booking" : resolvedCategory === "customise" ? "Add Customised Booking" : "Add Booking",
  };
}
