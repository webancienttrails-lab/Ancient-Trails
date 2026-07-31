import { HttpError } from "./httpError";

const defaultCountryCode = process.env.DEFAULT_COUNTRY_CODE || "91";

export function normalizeMobileNumber(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    throw new HttpError(400, "Mobile number is required");
  }

  const mobileNumber =
    digits.length === 10 ? `${defaultCountryCode}${digits}` : digits;

  if (!/^\d{10,15}$/.test(mobileNumber)) {
    throw new HttpError(
      400,
      "Mobile number must include country code and contain 10 to 15 digits"
    );
  }

  return mobileNumber;
}
