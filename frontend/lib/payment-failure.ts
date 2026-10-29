export function paymentFailureMessage(reason?: string): string {
  const message = "Payment not completed. No successful charge has been confirmed. Your booking details and choices have been kept. "
    + "If your bank shows no debit, you can try again. If money was deducted, check payment status or contact our team before retrying. "
    + "Failed-payment reversals are handled by your bank; timing can vary.";
  return reason?.trim() ? message + " (" + reason.trim() + ")" : message;
}
