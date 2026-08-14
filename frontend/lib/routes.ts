export function slugifyRoute(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function namedRouteValue(name: string, fallbackId = "") {
  const slug = slugifyRoute(name);

  return slug || fallbackId.trim();
}

function namedRouteSegment(name: string, fallbackId = "") {
  return encodeURIComponent(namedRouteValue(name, fallbackId));
}

export function getTourHref(tour: { tourId?: string; tourName?: string; title?: string }) {
  return `/tours/${namedRouteSegment(tour.tourName || tour.title || "", tour.tourId)}`;
}

export function getDestinationHref(destination: {
  destinationId?: string;
  destinationName?: string;
  name?: string;
}) {
  return `/destinations/${namedRouteSegment(
    destination.destinationName || destination.name || "",
    destination.destinationId
  )}`;
}

export function getTourCalendarHref({
  destination,
  tour,
}: {
  destination?: { destinationId?: string; destinationName?: string; name?: string };
  tour?: { tourId?: string; tourName?: string; title?: string };
} = {}) {
  const params = new URLSearchParams();
  const destinationValue = destination
    ? namedRouteValue(
        destination.destinationName || destination.name || "",
        destination.destinationId
      )
    : "";
  const tourValue = tour
    ? namedRouteValue(tour.tourName || tour.title || "", tour.tourId)
    : "";

  if (destinationValue) {
    params.set("destination", destinationValue);
  }

  if (tourValue) {
    params.set("tour", tourValue);
  }

  const query = params.toString();

  return `/tour-calendar${query ? `?${query}` : ""}`;
}

export function getDestinationsHref(search = "") {
  const trimmedSearch = search.trim();

  if (!trimmedSearch) {
    return "/destinations";
  }

  const params = new URLSearchParams({ search: trimmedSearch });

  return `/destinations?${params.toString()}`;
}

export function matchesRouteValue(
  routeValue: string,
  idValue = "",
  nameValue = ""
) {
  const decodedValue = decodeURIComponent(routeValue).trim();

  if (!decodedValue) {
    return false;
  }

  return (
    idValue.trim().toUpperCase() === decodedValue.toUpperCase() ||
    slugifyRoute(idValue) === slugifyRoute(decodedValue) ||
    slugifyRoute(nameValue) === slugifyRoute(decodedValue)
  );
}
