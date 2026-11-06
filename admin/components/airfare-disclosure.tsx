import { AIRFARE_NOTE } from "@/lib/airfare";
import type { ReactNode } from "react";
export function AirfareDisclosure({ excluded, amount = 0, addedAt, includedInTotal = false, renderText = (_field, value) => value }: { excluded?: boolean; amount?: number; addedAt?: string | null; includedInTotal?: boolean; renderText?: (field: string, value: string) => ReactNode }) {
  if (!excluded && !amount) return null;
  const pending = !addedAt && amount === 0;
  return <div className="my-3 rounded-md border border-primary/20 p-3 text-sm">
    <p className="font-semibold">{renderText("heading", includedInTotal ? "Airfare/Trainfare charges (Included in Total)" : "+ Airfare/Trainfare charges (Additional)")}</p>
    <p>{renderText("amount", pending ? "Airfare/Trainfare charges: To Be Added" : "Airfare/Trainfare charges: " + new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount))}</p>
    {includedInTotal && !pending ? <p className="mt-2 text-xs leading-relaxed">{renderText("included", "This airfare is already included in the booking total and is not added again.")}</p> : null}
    {pending ? <p className="mt-2 text-xs leading-relaxed">{renderText("pending", AIRFARE_NOTE)}</p> : null}
  </div>;
}
