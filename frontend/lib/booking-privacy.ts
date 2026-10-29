export function maskBookingEmail(email?: string): string {
  const value = email?.trim() || "";
  const at = value.indexOf("@");
  if (at <= 0 || at === value.length - 1) return value ? "***" : "-";
  return value[0] + "***" + value.slice(at);
}

export function maskBookingPhone(phone?: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  return digits ? "******" + digits.slice(-4) : "-";
}
