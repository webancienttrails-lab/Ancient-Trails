import fs from "node:fs";
import path from "node:path";

import nodemailer, { type SendMailOptions } from "nodemailer";

import { HttpError } from "../utils/httpError";

export type BookingConfirmationEmailPayload = {
  amountPaid: number;
  balanceAmount: number;
  balanceDueDate?: Date | string | null;
  bookingId: string;
  bookingReference: string;
  confirmationUrl?: string;
  confirmedAt?: Date | string | null;
  departureDate?: Date | string | null;
  destinationName?: string;
  durationLabel?: string;
  paymentId?: string;
  recipientEmail: string;
  returnDate?: Date | string | null;
  supportEmail?: string;
  supportPhone?: string;
  totalAmount: number;
  tourName: string;
  travellerName: string;
  travellersLabel: string;
};

export type BookingAlertEmailPayload = BookingConfirmationEmailPayload & {
  travellerEmail?: string;
  travellerPhone?: string;
};

type SmtpConfig = {
  from: string;
  host: string;
  pass: string;
  port: number;
  secure: boolean;
  user: string;
};

const brandName = "Ancient Trails";
const colors = {
  accent: "#9b3b13",
  background: "#f7f2ee",
  border: "#e8ded6",
  foreground: "#323232",
  muted: "#f7f2ee",
  primary: "#d47220",
  white: "#ffffff",
};

let cachedTransporter: nodemailer.Transporter | null = null;
let cachedTransportKey = "";

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string | null | undefined): string {
  return escapeHtml(value);
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function getFrontendBaseUrl() {
  return process.env.FRONTEND_URL?.trim().replace(/\/$/, "") || "";
}

function getConfiguredLogoUrl() {
  return (
    process.env.BOOKING_CONFIRMATION_LOGO_URL?.trim() ||
    process.env.EMAIL_LOGO_URL?.trim() ||
    ""
  );
}

function getDefaultPublicLogoUrl() {
  const frontendBaseUrl = getFrontendBaseUrl();

  return frontendBaseUrl ? `${frontendBaseUrl}/Header%20Logo.png` : "";
}

function getLocalLogoPath() {
  const configuredPath = process.env.BOOKING_CONFIRMATION_LOGO_PATH?.trim();

  if (configuredPath) {
    return path.resolve(process.cwd(), configuredPath);
  }

  return path.resolve(process.cwd(), "../frontend/public/Header Logo.png");
}

function createLogoBlock(): {
  attachments: SendMailOptions["attachments"];
  html: string;
} {
  const logoUrl = getConfiguredLogoUrl();

  if (logoUrl) {
    return {
      attachments: [],
      html: `<img src="${escapeAttribute(
        logoUrl
      )}" width="150" alt="${brandName}" class="logo-img" style="display:block;width:150px;max-width:150px;height:auto;border:0;outline:none;text-decoration:none;" />`,
    };
  }

  const localLogoPath = getLocalLogoPath();

  if (fs.existsSync(localLogoPath)) {
    return {
      attachments: [
        {
          cid: "ancient-trails-logo",
          filename: path.basename(localLogoPath),
          path: localLogoPath,
        },
      ],
      html: `<img src="cid:ancient-trails-logo" width="150" alt="${brandName}" class="logo-img" style="display:block;width:150px;max-width:150px;height:auto;border:0;outline:none;text-decoration:none;" />`,
    };
  }

  const defaultPublicLogoUrl = getDefaultPublicLogoUrl();

  if (defaultPublicLogoUrl) {
    return {
      attachments: [],
      html: `<img src="${escapeAttribute(
        defaultPublicLogoUrl
      )}" width="150" alt="${brandName}" class="logo-img" style="display:block;width:150px;max-width:150px;height:auto;border:0;outline:none;text-decoration:none;" />`,
    };
  }

  return {
    attachments: [],
    html: `<span style="display:inline-block;background:${colors.muted};color:${colors.accent};font-family:Georgia,'Times New Roman',serif;font-size:14px;font-weight:700;line-height:1;padding:11px 22px;border-radius:2px;">${brandName}</span>`,
  };
}

function getSmtpConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const fromAddress = process.env.SMTP_FROM?.trim() || user;
  const fromName = process.env.SMTP_FROM_NAME?.trim() || brandName;
  const secure =
    process.env.SMTP_SECURE?.trim().toLowerCase() === "true" || port === 465;

  if (!host || !Number.isInteger(port) || port <= 0 || !user || !pass || !fromAddress) {
    throw new HttpError(
      503,
      "SMTP email service is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM."
    );
  }

  return {
    from: fromAddress.includes("<")
      ? fromAddress
      : `"${fromName.replace(/"/g, "")}" <${fromAddress}>`,
    host,
    pass,
    port,
    secure,
    user,
  };
}

function getTransporter() {
  const config = getSmtpConfig();
  const transportKey = [
    config.host,
    config.port,
    config.secure,
    config.user,
    config.from,
  ].join("|");

  if (!cachedTransporter || cachedTransportKey !== transportKey) {
    cachedTransporter = nodemailer.createTransport({
      auth: {
        pass: config.pass,
        user: config.user,
      },
      host: config.host,
      port: config.port,
      secure: config.secure,
    });
    cachedTransportKey = transportKey;
  }

  return {
    from: config.from,
    transporter: cachedTransporter,
  };
}

function formatDate(value: Date | string | null | undefined, fallback = "To be announced") {
  if (!value) {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
    .format(date)
    .replace(",", "");
}

function formatCurrency(value: number | null | undefined) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function renderDetailRows(rows: Array<{ label: string; value: string }>) {
  return rows
    .map(
      (row) => `
        <tr>
          <td class="detail-label" style="border-bottom:1px solid ${colors.border};color:${colors.foreground};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:500;line-height:20px;padding:12px 0;vertical-align:top;width:38%;">
            ${escapeHtml(row.label)}
          </td>
          <td class="detail-value" style="border-bottom:1px solid ${colors.border};color:${colors.foreground};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;line-height:20px;padding:12px 0;text-align:right;vertical-align:top;width:62%;">
            ${escapeHtml(row.value || "-")}
          </td>
        </tr>`
    )
    .join("");
}

function renderPaymentRows(rows: Array<{ label: string; value: string }>) {
  return rows
    .map(
      (row) => `
        <tr>
          <td class="payment-label" style="color:${colors.foreground};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:500;line-height:20px;padding:8px 0;vertical-align:top;width:45%;">
            ${escapeHtml(row.label)}
          </td>
          <td class="payment-value" style="color:${colors.foreground};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:800;line-height:20px;padding:8px 0;text-align:right;vertical-align:top;width:55%;">
            ${escapeHtml(row.value || "-")}
          </td>
        </tr>`
    )
    .join("");
}

function buildConfirmationUrl(payload: BookingConfirmationEmailPayload) {
  if (payload.confirmationUrl) {
    return payload.confirmationUrl;
  }

  const frontendBaseUrl = getFrontendBaseUrl();

  return frontendBaseUrl
    ? `${frontendBaseUrl}/booking-confirmed/${payload.bookingId}`
    : "";
}

function buildBookingConfirmationEmailContent(
  payload: BookingConfirmationEmailPayload
): {
  attachments: SendMailOptions["attachments"];
  html: string;
  text: string;
} {
  const logo = createLogoBlock();
  const supportEmail =
    payload.supportEmail ||
    process.env.BOOKING_CONFIRMATION_SUPPORT_EMAIL?.trim() ||
    process.env.SUPPORT_EMAIL?.trim() ||
    "Holidays@ancient.com";
  const supportPhone =
    payload.supportPhone ||
    process.env.BOOKING_CONFIRMATION_SUPPORT_PHONE?.trim() ||
    process.env.SUPPORT_PHONE?.trim() ||
    "011-43033003 | 43131313";
  const confirmationUrl = buildConfirmationUrl(payload);
  const departureDate = formatDate(payload.departureDate);
  const returnDate = formatDate(payload.returnDate);
  const balanceDueDate =
    payload.balanceAmount > 0
      ? formatDate(payload.balanceDueDate, "To be shared")
      : "Paid in full";
  const destinationText = payload.destinationName
    ? ` in ${payload.destinationName}`
    : "";
  const paymentId = payload.paymentId || "Recorded against your booking";
  const confirmedAt = formatDate(payload.confirmedAt, formatDate(new Date()));
  const previewText = `Your ${brandName} booking ${payload.bookingReference} is confirmed.`;

  const detailRows = renderDetailRows([
    { label: "Tour", value: payload.tourName },
    { label: "Departure", value: departureDate },
    { label: "Return", value: returnDate },
    { label: "Duration", value: payload.durationLabel || "-" },
    { label: "Travellers", value: payload.travellersLabel },
  ]);
  const paymentRows = renderPaymentRows([
    { label: "Total", value: formatCurrency(payload.totalAmount) },
    { label: "Amount Paid", value: formatCurrency(payload.amountPaid) },
    { label: "Balance", value: formatCurrency(payload.balanceAmount) },
    { label: "Balance Due", value: balanceDueDate },
  ]);
  const confirmationLinkHtml = confirmationUrl
    ? `
      <tr>
        <td align="center" style="padding:2px 0 22px;">
          <a href="${escapeAttribute(
            confirmationUrl
          )}" style="background:${colors.primary};border-radius:999px;color:${colors.white};display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:800;line-height:42px;min-width:172px;text-align:center;text-decoration:none;">View Booking</a>
        </td>
      </tr>`
    : "";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta content="width=device-width, initial-scale=1" name="viewport" />
    <meta content="telephone=no,address=no,email=no,date=no,url=no" name="format-detection" />
    <title>${escapeHtml(previewText)}</title>
    <style>
      @media screen and (max-width: 640px) {
        .email-outer { padding: 0 !important; }
        .email-shell { border-radius: 0 !important; width: 100% !important; }
        .email-header { padding: 18px 18px 14px !important; }
        .email-content { padding: 24px 18px 26px !important; }
        .email-title { font-size: 26px !important; line-height: 31px !important; }
        .intro-text { font-size: 13px !important; line-height: 21px !important; }
        .booking-pill { font-size: 11px !important; max-width: 100% !important; white-space: normal !important; }
        .section-title { font-size: 16px !important; }
        .detail-label, .detail-value, .payment-label, .payment-value {
          display: block !important;
          padding-bottom: 3px !important;
          text-align: left !important;
          width: 100% !important;
        }
        .detail-value, .payment-value {
          padding-top: 0 !important;
        }
        .payment-box { padding: 14px !important; }
        .logo-img { width: 132px !important; max-width: 132px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${colors.background};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(
      previewText
    )}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${colors.background};border-collapse:collapse;margin:0;padding:0;width:100%;">
      <tr>
        <td align="center" class="email-outer" style="padding:16px 8px;">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" class="email-shell" style="background:${colors.white};border-collapse:separate;border-radius:8px;box-shadow:0 12px 32px rgba(50,50,50,0.08);overflow:hidden;width:640px;">
            <tr>
              <td align="center" class="email-header" style="border-bottom:1px solid ${colors.border};padding:28px 28px 20px;">
                ${logo.html}
              </td>
            </tr>
            <tr>
              <td class="email-content" style="padding:34px 34px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td align="center" style="padding:0 0 12px;">
                      <span style="background:${colors.muted};border-radius:999px;color:${colors.primary};display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;height:54px;line-height:54px;text-align:center;width:54px;">&#10003;</span>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:0;">
                      <h1 class="email-title" style="color:${colors.accent};font-family:Georgia,'Times New Roman',serif;font-size:29px;font-weight:700;line-height:36px;margin:0;">Your Journey is Confirmed</h1>
                      <p style="color:${colors.foreground};font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:20px;margin:13px 0 0;">Dear ${escapeHtml(
                        payload.travellerName
                      )},</p>
                      <p class="intro-text" style="color:${colors.foreground};font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:500;line-height:22px;margin:5px auto 0;max-width:500px;">
                        We are delighted to confirm your booking for <strong style="color:${colors.accent};">${escapeHtml(
                          payload.tourName
                        )}</strong>${escapeHtml(destinationText)}.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:18px 0 26px;">
                      <span class="booking-pill" style="background:${colors.muted};border-radius:999px;color:${colors.primary};display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:800;letter-spacing:0;line-height:1.2;padding:10px 18px;white-space:nowrap;">Booking ID: ${escapeHtml(
                        payload.bookingReference
                      )}</span>
                    </td>
                  </tr>
                  ${confirmationLinkHtml}
                  <tr>
                    <td style="padding:0 0 18px;">
                      <h2 class="section-title" style="color:${colors.foreground};font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:700;line-height:24px;margin:0 0 10px;">Booking Details</h2>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                        ${detailRows}
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0 18px;">
                      <h2 class="section-title" style="color:${colors.foreground};font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:700;line-height:24px;margin:0 0 10px;">Payment Summary</h2>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                        ${paymentRows}
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td class="payment-box" style="background:${colors.muted};border-radius:8px;padding:18px 20px;">
                      <p style="color:${colors.primary};font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:800;line-height:20px;margin:0 0 8px;">&#10003; Payment Received Successfully</p>
                      <p style="color:${colors.foreground};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:500;line-height:21px;margin:0;">
                        We have successfully received ${escapeHtml(
                          formatCurrency(payload.amountPaid)
                        )} towards your booking. Your booking summary is included in this email for your reference.
                      </p>
                      <p style="color:${colors.foreground};font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:500;line-height:19px;margin:12px 0 0;">
                        The invoice and final payment receipt will be generated and sent to your registered email once the complete booking amount has been received.
                      </p>
                      <p style="color:${colors.foreground};font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;line-height:19px;margin:12px 0 0;">
                        Payment reference: ${escapeHtml(paymentId)}
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:24px 0 0;">
                      <h2 class="section-title" style="color:${colors.foreground};font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:700;line-height:24px;margin:0 0 8px;">What Happens Next?</h2>
                      <p style="color:${colors.foreground};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:500;line-height:22px;margin:0;">
                        The Ancient Trails team will share your detailed tour information, reporting instructions and travel guidelines before departure. We recommend keeping this email and the attached invoice handy for your journey.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:23px 0 0;">
                      <h2 class="section-title" style="color:${colors.foreground};font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:700;line-height:24px;margin:0 0 8px;">Support</h2>
                      <p style="color:${colors.foreground};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:500;line-height:22px;margin:0;">
                        <strong>Email:</strong> <a href="mailto:${escapeAttribute(
                          supportEmail
                        )}" style="color:${colors.primary};font-weight:700;text-decoration:none;">${escapeHtml(
                          supportEmail
                        )}</a><br />
                        <strong>Phone:</strong> ${escapeHtml(supportPhone)}<br />
                        <strong>Confirmed On:</strong> ${escapeHtml(confirmedAt)}
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:23px 0 0;">
                      <p style="color:${colors.foreground};font-family:Georgia,'Times New Roman',serif;font-size:13px;font-style:italic;font-weight:500;line-height:22px;margin:0;">
                        We look forward to welcoming you on a memorable journey through history, culture and heritage.
                      </p>
                      <p style="color:${colors.foreground};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:500;line-height:21px;margin:18px 0 0;">
                        Warm regards,<br />
                        <strong style="color:${colors.accent};">Team ${brandName}</strong>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textLines = [
    `${brandName} Booking Confirmation`,
    "",
    `Dear ${payload.travellerName},`,
    `Your journey is confirmed for ${payload.tourName}${destinationText}.`,
    "",
    `Booking ID: ${payload.bookingReference}`,
    `Tour: ${payload.tourName}`,
    `Departure: ${departureDate}`,
    `Return: ${returnDate}`,
    `Duration: ${payload.durationLabel || "-"}`,
    `Travellers: ${payload.travellersLabel}`,
    "",
    "Payment Summary",
    `Total: ${formatCurrency(payload.totalAmount)}`,
    `Amount Paid: ${formatCurrency(payload.amountPaid)}`,
    `Balance: ${formatCurrency(payload.balanceAmount)}`,
    `Balance Due: ${balanceDueDate}`,
    `Payment Reference: ${stripTags(paymentId)}`,
    confirmationUrl ? `View Booking: ${confirmationUrl}` : "",
    "",
    "What Happens Next?",
    "The Ancient Trails team will share your detailed tour information, reporting instructions and travel guidelines before departure.",
    "",
    `Support Email: ${supportEmail}`,
    `Support Phone: ${supportPhone}`,
    `Confirmed On: ${confirmedAt}`,
    "",
    "Warm regards,",
    `Team ${brandName}`,
  ].filter(Boolean);

  return {
    attachments: logo.attachments,
    html,
    text: textLines.join("\n"),
  };
}

function getBookingAlertRecipients() {
  const configuredRecipients =
    process.env.BOOKING_ALERT_EMAILS?.trim() ||
    process.env.BOOKING_ALERT_EMAIL?.trim() ||
    "web.ancienttrails@gmail.com";

  return Array.from(
    new Set(
      configuredRecipients
        .split(",")
        .map((recipient) => recipient.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function buildBookingAlertEmailContent(payload: BookingAlertEmailPayload): {
  html: string;
  text: string;
} {
  const departureDate = formatDate(payload.departureDate);
  const returnDate = formatDate(payload.returnDate);
  const confirmedAt = formatDate(payload.confirmedAt, formatDate(new Date()));
  const balanceDueDate =
    payload.balanceAmount > 0
      ? formatDate(payload.balanceDueDate, "To be shared")
      : "Paid in full";
  const confirmationUrl = buildConfirmationUrl(payload);
  const destinationText = payload.destinationName
    ? ` in ${payload.destinationName}`
    : "";
  const detailRows = renderDetailRows([
    { label: "Booking ID", value: payload.bookingReference },
    { label: "Traveller", value: payload.travellerName },
    { label: "Email", value: payload.travellerEmail || payload.recipientEmail },
    { label: "Phone", value: payload.travellerPhone || "-" },
    { label: "Tour", value: payload.tourName },
    { label: "Destination", value: payload.destinationName || "-" },
    { label: "Departure", value: departureDate },
    { label: "Return", value: returnDate },
    { label: "Duration", value: payload.durationLabel || "-" },
    { label: "Travellers", value: payload.travellersLabel },
    { label: "Total", value: formatCurrency(payload.totalAmount) },
    { label: "Amount Paid", value: formatCurrency(payload.amountPaid) },
    { label: "Balance", value: formatCurrency(payload.balanceAmount) },
    { label: "Balance Due", value: balanceDueDate },
    { label: "Payment Reference", value: payload.paymentId || "-" },
    { label: "Confirmed On", value: confirmedAt },
  ]);
  const confirmationLinkHtml = confirmationUrl
    ? `<p style="margin:22px 0 0;"><a href="${escapeAttribute(
        confirmationUrl
      )}" style="background:${colors.primary};border-radius:999px;color:${colors.white};display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:800;line-height:40px;min-width:150px;text-align:center;text-decoration:none;">View Booking</a></p>`
    : "";
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta content="width=device-width, initial-scale=1" name="viewport" />
    <title>New booking alert - ${escapeHtml(payload.bookingReference)}</title>
    <style>
      @media screen and (max-width: 640px) {
        .email-outer { padding: 0 !important; }
        .email-shell { border-radius: 0 !important; width: 100% !important; }
        .email-content { padding: 24px 18px 26px !important; }
        .email-title { font-size: 24px !important; line-height: 30px !important; }
        .detail-label, .detail-value {
          display: block !important;
          padding-bottom: 3px !important;
          text-align: left !important;
          width: 100% !important;
        }
        .detail-value { padding-top: 0 !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${colors.background};">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${colors.background};border-collapse:collapse;margin:0;padding:0;width:100%;">
      <tr>
        <td align="center" class="email-outer" style="padding:16px 8px;">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" class="email-shell" style="background:${colors.white};border-collapse:separate;border-radius:8px;box-shadow:0 12px 32px rgba(50,50,50,0.08);overflow:hidden;width:640px;">
            <tr>
              <td class="email-content" style="padding:30px 34px 32px;">
                <h1 class="email-title" style="color:${colors.accent};font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;line-height:36px;margin:0;">New Booking Alert</h1>
                <p style="color:${colors.foreground};font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;line-height:22px;margin:10px 0 22px;">
                  A booking has been confirmed for <strong style="color:${colors.accent};">${escapeHtml(
                    payload.tourName
                  )}</strong>${escapeHtml(destinationText)}.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                  ${detailRows}
                </table>
                ${confirmationLinkHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  const textLines = [
    "New Booking Alert",
    "",
    `Booking ID: ${payload.bookingReference}`,
    `Traveller: ${payload.travellerName}`,
    `Email: ${payload.travellerEmail || payload.recipientEmail}`,
    `Phone: ${payload.travellerPhone || "-"}`,
    `Tour: ${payload.tourName}${destinationText}`,
    `Departure: ${departureDate}`,
    `Return: ${returnDate}`,
    `Duration: ${payload.durationLabel || "-"}`,
    `Travellers: ${payload.travellersLabel}`,
    `Total: ${formatCurrency(payload.totalAmount)}`,
    `Amount Paid: ${formatCurrency(payload.amountPaid)}`,
    `Balance: ${formatCurrency(payload.balanceAmount)}`,
    `Balance Due: ${balanceDueDate}`,
    `Payment Reference: ${payload.paymentId || "-"}`,
    `Confirmed On: ${confirmedAt}`,
    confirmationUrl ? `View Booking: ${confirmationUrl}` : "",
  ].filter(Boolean);

  return {
    html,
    text: textLines.join("\n"),
  };
}

export async function sendBookingConfirmationEmail(
  payload: BookingConfirmationEmailPayload
): Promise<{
  messageId: string;
}> {
  const recipientEmail = payload.recipientEmail.trim().toLowerCase();

  if (!recipientEmail) {
    throw new HttpError(400, "Booking confirmation recipient email is missing");
  }

  const { attachments, html, text } = buildBookingConfirmationEmailContent({
    ...payload,
    recipientEmail,
  });
  const { from, transporter } = getTransporter();
  const info = await transporter.sendMail({
    attachments,
    from,
    html,
    subject: `${brandName} booking confirmed - ${payload.bookingReference}`,
    text,
    to: recipientEmail,
  });

  return {
    messageId: info.messageId || "",
  };
}

export async function sendBookingAlertEmail(
  payload: BookingAlertEmailPayload
): Promise<{
  messageId: string;
  recipients: string[];
}> {
  const recipients = getBookingAlertRecipients();

  if (recipients.length === 0) {
    return {
      messageId: "",
      recipients,
    };
  }

  const { html, text } = buildBookingAlertEmailContent(payload);
  const { from, transporter } = getTransporter();
  const info = await transporter.sendMail({
    from,
    html,
    subject: `New booking alert - ${payload.bookingReference}`,
    text,
    to: recipients.join(","),
  });

  return {
    messageId: info.messageId || "",
    recipients,
  };
}
