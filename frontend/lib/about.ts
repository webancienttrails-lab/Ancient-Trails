import { apiBaseUrl, apiRequest } from "@/lib/api";

export type AboutStatIcon =
  | "BookOpen"
  | "CalendarDays"
  | "Globe2"
  | "MapPin"
  | "Users";

export type AboutStat = {
  id: string;
  label: string;
  value: string;
  icon: AboutStatIcon;
  sortOrder: number;
};

export type AboutTeamMember = {
  id: string;
  name: string;
  role: string;
  bio: string;
  image: string;
  sortOrder: number;
};

export type AboutPageContent = {
  id: string;
  stats: AboutStat[];
  teamMembers: AboutTeamMember[];
  createdAt: string;
  updatedAt: string;
};

export const fallbackAboutContent: AboutPageContent = {
  id: "fallback-about",
  stats: [
    {
      id: "stat-curated-tours",
      value: "150+",
      label: "Curated Tours",
      icon: "BookOpen",
      sortOrder: 0,
    },
    {
      id: "stat-destinations",
      value: "75+",
      label: "Destinations",
      icon: "MapPin",
      sortOrder: 1,
    },
    {
      id: "stat-travellers",
      value: "25,000+",
      label: "Happy Travellers",
      icon: "Users",
      sortOrder: 2,
    },
    {
      id: "stat-experience",
      value: "12+",
      label: "Years of Experience",
      icon: "CalendarDays",
      sortOrder: 3,
    },
    {
      id: "stat-countries",
      value: "10+",
      label: "Countries Explored",
      icon: "Globe2",
      sortOrder: 4,
    },
  ],
  teamMembers: [
    {
      id: "team-girinath",
      name: "Girinath Bharade",
      role: "Founder & Heritage Expert",
      bio: "Indologist and cultural storyteller with deep expertise in temple architecture and iconography.",
      image: "/home assets/Khajuraho.webp",
      sortOrder: 0,
    },
    {
      id: "team-ankita",
      name: "Ankita Deshpande",
      role: "Travel Curator",
      bio: "Passionate about art, culture and curating purposeful travel experiences.",
      image: "/home assets/destination/Udaipur.webp",
      sortOrder: 1,
    },
    {
      id: "team-vikram",
      name: "Vikram Hegde",
      role: "Heritage Researcher",
      bio: "Researcher and photographer specialising in history, folklore and traditions.",
      image: "/home assets/destination/Hampi.webp",
      sortOrder: 2,
    },
    {
      id: "team-pooja",
      name: "Pooja Menon",
      role: "Operations Lead",
      bio: "Ensures seamless travel experiences with attention to every little detail.",
      image: "/home assets/destination/Varanasi.webp",
      sortOrder: 3,
    },
  ],
  createdAt: "",
  updatedAt: "",
};

export function getAboutMediaUrl(source: string): string {
  const trimmedSource = source.trim();

  if (!trimmedSource) {
    return "";
  }

  if (/^(https?:|data:|blob:)/i.test(trimmedSource)) {
    return trimmedSource;
  }

  if (trimmedSource.startsWith("/uploads/")) {
    return `${apiBaseUrl}${trimmedSource}`;
  }

  return trimmedSource;
}

export async function getAboutPageContent() {
  return apiRequest<{ about: AboutPageContent }>("/api/about");
}
