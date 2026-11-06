import { jsPDF } from "jspdf";
import type { AdminTour, AdminTourItinerary } from "@/lib/tours";

export function createTourItineraryPdf(tour: AdminTour, itinerary: AdminTourItinerary) {
  if (tour.tourId !== itinerary.tourId) throw new Error("The itinerary does not belong to this tour.");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 18;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  const bottom = pdf.internal.pageSize.getHeight() - margin;
  let y = margin;

  function text(value: string, size = 11, bold = false) {
    if (!value.trim()) return;
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const lineHeight = size * 0.48;
    const lines = pdf.splitTextToSize(value, width) as string[];
    for (const line of lines) {
      if (y + lineHeight > bottom) { pdf.addPage(); y = margin; }
      pdf.text(line, margin, y + lineHeight);
      y += lineHeight;
    }
    y += 3;
  }

  pdf.setTextColor(205, 107, 28);
  text("ANCIENT TRAILS", 13, true);
  pdf.setTextColor(50, 50, 50);
  text(tour.tourName, 19, true);
  text(`Tour: ${tour.tourId} | Duration: ${tour.durationDn}`, 10);
  text("Tour Itinerary", 14, true);
  text(itinerary.itinerarySummary);

  for (const day of [...itinerary.days].sort((a, b) => a.dayNumber - b.dayNumber)) {
    if (y + 24 > bottom) { pdf.addPage(); y = margin; }
    text(`Day ${day.dayNumber}${day.title ? ` - ${day.title}` : ""}`, 13, true);
    text(day.summary);
    if (day.placesVisited.length) text(`Places visited: ${day.placesVisited.join(", ")}`);
    if (day.hotels) text(`Hotels: ${day.hotels}`);
    if (day.walkingDifficulty) text(`Walking difficulty: ${day.walkingDifficulty}`);
    if (day.meals) text(`Meals: ${day.meals}`);
    y += 3;
  }

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setFontSize(9);
    pdf.setTextColor(130, 130, 130);
    pdf.text(`${page} / ${pages}`, pdf.internal.pageSize.getWidth() - margin, bottom + 8, { align: "right" });
  }
  return pdf;
}

export function downloadTourItineraryPdf(tour: AdminTour, itinerary: AdminTourItinerary) {
  const name = (tour.tourName || tour.tourId).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim();
  createTourItineraryPdf(tour, itinerary).save(`${name || "Tour"}-Itinerary.pdf`);
}
