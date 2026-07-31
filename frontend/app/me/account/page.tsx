import type { Metadata } from "next";

import { AccountPageContent } from "@/components/user-dashboard/account-page-content";

export const metadata: Metadata = {
  title: "My Account",
};

export default function AccountPage() {
  return <AccountPageContent />;
}
