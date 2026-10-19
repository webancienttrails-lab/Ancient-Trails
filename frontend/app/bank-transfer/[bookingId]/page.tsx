import type { Metadata } from "next";
import { BankTransferPage } from "@/components/bank-transfer-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bank Transfer | Ancient Trails", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function Page({ params, searchParams }: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [route, query] = await Promise.all([params, searchParams]);
  return <BankTransferPage bookingId={route.bookingId} token={query.token || ""} />;
}
