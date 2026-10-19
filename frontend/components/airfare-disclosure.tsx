import { AIRFARE_NOTE } from "@/lib/airfare";
export function AirfareDisclosure({ excluded, amount = 0, addedAt, includedInTotal = false }: { excluded?: boolean; amount?: number; addedAt?: string | null; includedInTotal?: boolean }) {
  if (!excluded && !amount) return null;
  const pending = !addedAt && amount === 0;
  return <div className="my-3 rounded-md border border-primary/20 p-3 text-sm">
    <p className="font-semibold">{includedInTotal ? "Air-Flight Charges (Included in Total)" : "+ Air-Flight Charges (Additional)"}</p>
    <p>{pending ? "Air-Flight Charges: To Be Added" : "Air-Flight Charges: " + new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount)}</p>
    {includedInTotal && !pending ? <p className="mt-2 text-xs leading-relaxed">This airfare is already included in the booking total and is not added again.</p> : null}
    {pending ? <p className="mt-2 text-xs leading-relaxed">{AIRFARE_NOTE}</p> : null}
  </div>;
}
