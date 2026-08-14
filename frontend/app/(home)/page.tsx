import { HomePage } from "./_components/home-page";
import {
  fallbackTrendingDestinations,
  getHomeTrendingDestinations,
} from "@/lib/home-travel";

export const dynamic = "force-dynamic";

export default async function Home() {
  let topDestinations = fallbackTrendingDestinations;

  try {
    topDestinations = await getHomeTrendingDestinations(8);
  } catch {
    topDestinations = fallbackTrendingDestinations;
  }

  return <HomePage topDestinations={topDestinations} />;
}
