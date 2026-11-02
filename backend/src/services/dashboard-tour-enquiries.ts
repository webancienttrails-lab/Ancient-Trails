export function createTourEnquiryCounts(
  tours: Array<{ tourId: string; tourName: string }>,
  enquiries: Array<{ subject: string; message: string }>
) {
  const counts = new Map<string, number>();
  const tourById = new Map(tours.map((tour) => [tour.tourId, tour]));
  const tourByName = new Map(
    tours.map((tour) => [tour.tourName.trim().toLowerCase(), tour])
  );

  for (const enquiry of enquiries) {
    const tourId = enquiry.message.match(/^Tour ID:\s*([^\r\n]+)$/m)?.[1].trim();
    const tourName = enquiry.message.match(/^Tour:\s*([^\r\n]+)$/m)?.[1].trim()
      || enquiry.subject.match(/^Tour enquiry - (.+)$/i)?.[1].trim();
    const tour = tourId
      ? tourById.get(tourId)
      : tourName ? tourByName.get(tourName.toLowerCase()) : undefined;

    if (tour) {
      counts.set(tour.tourId, (counts.get(tour.tourId) || 0) + 1);
    }
  }

  return tours.map((tour) => ({
    tourId: tour.tourId,
    title: tour.tourName,
    enquiries: counts.get(tour.tourId) || 0,
  })).sort((left, right) => right.enquiries - left.enquiries || left.title.localeCompare(right.title));
}
