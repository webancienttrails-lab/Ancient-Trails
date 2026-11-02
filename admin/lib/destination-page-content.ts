export type DestinationDetailIcon = "landmark" | "crown" | "river" | "temple" | "map" | "calendar" | "sun" | "rain" | "leaf";
export type DestinationPageContent = {
  heroTagline?: string; heroDescription?: string; heroImage?: string;
  overviewEyebrow?: string; overviewTitle?: string; overviewDescription?: string; overviewQuote?: string;
  illustrationImage?: string;
  attractions?: Array<{ name: string; image?: string; description?: string }>;
  quickFacts?: Array<{ icon: DestinationDetailIcon; value: string; label?: string; description?: string }>;
  bestTimeNote?: string; travelTip?: string;
  seasons?: Array<{ icon: DestinationDetailIcon; name: string; months?: string; description?: string }>;
  thingsToKnow?: string[];
  timings?: string; tickets?: string; facilities?: string; closingQuote?: string;
  byAir?: string; byRail?: string; byRoad?: string; localTransport?: string;
  mapQuery?: string; mapImage?: string; mapLink?: string; mapEmbedUrl?: string; mapHighlights?: string[];
};
