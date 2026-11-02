import { isGoogleMapsUrl } from "../utils/destination-map";
import { z } from "zod";

const text = (max: number) => z.string().trim().max(max).optional();
const icon = z.enum(["landmark", "crown", "river", "temple", "map", "calendar", "sun", "rain", "leaf"]);
const image = z.string().trim().max(500).refine(value => !value || /^\/(?!\/)/.test(value) || /^https?:\/\//i.test(value), "Use an image path or an HTTP(S) image URL").optional();
export const destinationPageContentSchema = z.object({
  heroTagline: text(180), heroDescription: text(600), heroImage: image,
  overviewEyebrow: text(160), overviewTitle: text(240), overviewDescription: text(1800), overviewQuote: text(360),
  illustrationImage: image,
  attractions: z.array(z.object({ name: z.string().trim().min(1).max(160), image, description: text(500) })).max(12).optional(),
  quickFacts: z.array(z.object({ icon: icon.default("landmark"), value: z.string().trim().max(120), label: text(160), description: text(300) })).max(5).optional(),
  bestTimeNote: text(400), travelTip: text(500),
  seasons: z.array(z.object({ icon: icon.default("sun"), name: z.string().trim().max(80), months: text(120), description: text(240) })).max(3).optional(),
  thingsToKnow: z.array(z.string().trim().max(240)).max(15).optional(),
  timings: text(500), tickets: text(500), facilities: text(500), closingQuote: text(500),
  byAir: text(600), byRail: text(600), byRoad: text(600), localTransport: text(600),
  mapQuery: text(300), mapImage: image,
  mapLink: z.string().trim().max(2048).refine(value => !value || isGoogleMapsUrl(value), "Use a Google Maps share or embed URL").optional(),
  mapHighlights: z.array(z.string().trim().max(160)).max(12).optional(),
});
export type DestinationPageContent = z.infer<typeof destinationPageContentSchema>;

type DestinationRecord = {
  destinationId: string; destinationName: string; pageContent?: DestinationPageContent;
  keyLandmarks?: string[]; keyLandmarkImages?: string[]; galleryImages?: string[];
};

export function getDestinationPageContent(destination: DestinationRecord): DestinationPageContent {
  const isHampi = /^hampi$/i.test(destination.destinationName.trim()) || /^hampi$/i.test(destination.destinationId.trim());
  // Legacy attraction overrides are no longer returned: the page uses Key Landmarks.
  const { attractions: legacyAttractions, ...pageContent } = destination.pageContent || {};
  if (!isHampi) return pageContent;
  // Editable starting content for the supplied Hampi design. Historical facts:
  // https://whc.unesco.org/en/list/241/ and https://karnatakatourism.org/en/destinations/hampi/
  const defaults: DestinationPageContent = {
    heroTagline: "Where Stone Remembers an Empire",
    heroDescription: "A timeless landscape of majestic temples, royal ruins and boulder-strewn hills. Hampi is a place where history, spirituality and nature become one.",
    heroImage: "/uploads/destinations/Hampi-banner-1786446560801-r0ra8t.webp",
    overviewEyebrow: "A UNESCO World Heritage Site",
    overviewTitle: "A City of Stone, Sacred Spaces & Stories",
    overviewDescription: "Hampi was the capital of the Vijayanagara Empire, a meeting place of power, artistry and culture. Its temples, royal complexes and historic market streets tell the story of a remarkable city. Today, the Tungabhadra River and boulder-strewn hills frame a landscape of living temples and extraordinary ruins.",
    overviewQuote: "You hear a destination, but living it stays with you.",
    illustrationImage: "/illustration/Hampi illustration.webp",
    quickFacts: [
      { icon: "landmark", value: "UNESCO", label: "World Heritage Site", description: "Recognised for its outstanding cultural heritage" },
      { icon: "crown", value: "14th – 16th Century", label: "Vijayanagara Empire", description: "A magnificent chapter of Indian history" },
      { icon: "river", value: "Tungabhadra River", label: "A sacred river landscape", description: "Flowing through Hampi’s spectacular setting" },
      { icon: "temple", value: "1,600+", label: "Surviving remains", description: "Temples, royal complexes, waterworks and more" },
      { icon: "map", value: "1986", label: "UNESCO inscription", description: "A heritage landscape recognised worldwide" },
    ],
    bestTimeNote: "Pleasant weather, ideal for sightseeing.",
    seasons: [
      { icon: "sun", name: "Mar – May", months: "Summer", description: "Hot and dry" },
      { icon: "rain", name: "Jun – Sep", months: "Monsoon", description: "A greener landscape" },
      { icon: "leaf", name: "Oct – Feb", months: "Winter", description: "Comfortable for exploring" },
    ],
    travelTip: "Start early to beat the heat and enjoy the ruins at your own pace.",
    timings: "Opening hours vary by monument. Check temple and ticketed-site timings before your visit.",
    tickets: "Selected monuments require admission tickets. Check current charges when planning your visit.",
    facilities: "Plan drinking water, sun protection and walking breaks. Facilities vary between monuments.",
    closingQuote: "A journey to Hampi is not just a visit, it’s a walk through living history.",
    byAir: "Nearby regional airport, followed by a road transfer.",
    byRail: "Hosapete railway station; continue to Hampi by road.",
    byRoad: "Road connections through Hosapete to Hampi.",
    localTransport: "Explore with local transport or a guided vehicle, with walking at the monuments.",
    mapQuery: "Hampi, Karnataka, India",
    mapHighlights: ["Virupaksha Temple", "Vijaya Vittala Temple", "Lotus Mahal", "Hemakuta Hill"],
  };
  return { ...defaults, ...pageContent };
}
