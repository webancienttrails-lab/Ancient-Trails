import type { Metadata } from "next";
import { BankTransferPage } from "@/components/bank-transfer-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bank Transfer | Ancient Trails", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function Page({ params }: {
  params: Promise<{ bookingId: string }>;
}) {
  const route = await params;
  return <BankTransferPage bookingId={route.bookingId} />;
}
