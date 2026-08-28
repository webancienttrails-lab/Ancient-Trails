import type { Metadata } from "next";

import { WishlistPageContent } from "@/components/user-dashboard/wishlist-page-content";

export const metadata: Metadata = {
  title: "My Wishlist",
};

export default function WishlistPage() {
  return <WishlistPageContent />;
}
