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
