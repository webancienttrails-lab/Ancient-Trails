import type {
  DepositAppliesTo,
  DepositType,
} from "../departure/departure.types";

export function calculateDeposit({
  depositAppliesTo,
  depositType,
  depositValue,
  grandTotal,
  totalTravellers,
}: {
  depositAppliesTo: DepositAppliesTo;
  depositType: DepositType;
  depositValue: number;
  grandTotal: number;
  totalTravellers: number;
}): number {
  const rawDeposit =
    depositType === "percentage"
      ? (grandTotal * depositValue) / 100
      : depositAppliesTo === "per_person"
        ? depositValue * totalTravellers
        : depositValue;

  return Math.min(Math.max(0, Math.round(rawDeposit)), Math.max(0, grandTotal));
}

export function calculateBalance(grandTotal: number, depositAmount: number): number {
  return Math.max(0, Math.round(grandTotal - depositAmount));
}
