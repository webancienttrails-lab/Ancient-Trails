import axios from "axios";

import { HttpError } from "../utils/httpError";

const whatsappBaseUrl =
  process.env.MSG91_WHATSAPP_BASE_URL ||
  "https://control.msg91.com/api/v5/whatsapp";
const bookingConfirmationTemplateName = "booking_confirmation";
const bookingReminderTemplateName = "ancient_trails_booking_reminder";
const finalPaymentTemplateName =
  process.env.MSG91_WHATSAPP_FINAL_PAYMENT_TEMPLATE_NAME ||
  bookingReminderTemplateName;
const bookingConfirmationIntegratedNumber =
  process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER || "917262930404";
const defaultTemplateLanguage =
  process.env.MSG91_WHATSAPP_TEMPLATE_LANGUAGE || "en";
const defaultPaymentLinkTemplateName = "booking_payment_link";

type Msg91WhatsappResponse = {
  error?: unknown;
  errors?: unknown;
  reason?: unknown;
  status?: string;
  success?: boolean;
  type?: string;
  message?: string;
  requestId?: string;
  request_id?: string;
  data?: unknown;
  [key: string]: unknown;
};

export type BookingConfirmationWhatsappPayload = {
  amountPaid: string;
  paymentStatus: "Partially Paid" | "Paid in Full";
  recipientNumber: string;
  travellerName: string;
  tourName: string;
  departureDate: string;
  crqId?: string;
};

export type BookingRecoveryWhatsappPayload = {
  recipientNumber: string;
  travellerName: string;
  tourName: string;
  recoveryUrl: string;
  crqId?: string;
};

export type BookingFinalPaymentWhatsappPayload = {
  recipientNumber: string;
  travellerName: string;
  tourName: string;
  paymentUrl: string;
  crqId?: string;
};

export type BookingPaymentLinkWhatsappPayload = {
  amount: string;
  bookingReference: string;
  crqId?: string;
  paymentPurpose: string;
  paymentUrl: string;
  recipientNumber: string;
  tourName: string;
  travellerName: string;
};

function getMsg91AuthKey() {
  const authKey = process.env.MSG91_AUTH_KEY?.trim();

  if (!authKey) {
    throw new HttpError(503, "MSG91 auth key is not configured");
  }

  return authKey;
}

function getTemplateNamespace() {
  return process.env.MSG91_WHATSAPP_TEMPLATE_NAMESPACE?.trim() || "";
}

function getPaymentLinkTemplateName() {
  return (
    process.env.MSG91_WHATSAPP_PAYMENT_LINK_TEMPLATE_NAME?.trim() ||
    defaultPaymentLinkTemplateName
  );
}

function hasFailureResponse(data: Msg91WhatsappResponse): boolean {
  if (data.success === false) {
    return true;
  }

  const type = data.type?.toLowerCase() || "";
  const status = data.status?.toLowerCase() || "";
  const message = data.message?.toLowerCase() || "";

  if (
    type === "error" ||
    status === "error" ||
    status === "fail" ||
    status === "failed" ||
    message.includes("error") ||
    message.includes("fail")
  ) {
    return true;
  }

  if (data.error || data.errors) {
    return true;
  }

  if (Array.isArray(data.data)) {
    return data.data.some((item) =>
      item && typeof item === "object"
        ? hasFailureResponse(item as Msg91WhatsappResponse)
        : false
    );
  }

  if (data.data && typeof data.data === "object") {
    return hasFailureResponse(data.data as Msg91WhatsappResponse);
  }

  return false;
}

function extractMsg91Message(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as Msg91WhatsappResponse).message;

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  if (data && typeof data === "object" && "reason" in data) {
    const reason = (data as Msg91WhatsappResponse).reason;

    if (typeof reason === "string" && reason.trim()) {
      return reason;
    }
  }

  if (data && typeof data === "object" && "error" in data) {
    const error = (data as Msg91WhatsappResponse).error;

    if (typeof error === "string" && error.trim()) {
      return error;
    }
  }

  if (data && typeof data === "object" && "data" in data) {
    const nestedMessage = extractMsg91Message(
      (data as Msg91WhatsappResponse).data,
      ""
    );

    if (nestedMessage) {
      return nestedMessage;
    }
  }

  return fallback;
}

function toHttpError(error: unknown, fallback: string): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const statusCode = error.response?.status || 502;
    const message = extractMsg91Message(error.response?.data, fallback);

    return new HttpError(statusCode >= 500 ? 502 : statusCode, message);
  }

  return new HttpError(502, fallback);
}

function getRequestId(data: Msg91WhatsappResponse) {
  const directRequestId = data.requestId || data.request_id;

  if (directRequestId) {
    return String(directRequestId);
  }

  if (data.data && typeof data.data === "object") {
    const nestedData = data.data as Msg91WhatsappResponse;

    return nestedData.requestId || nestedData.request_id
      ? String(nestedData.requestId || nestedData.request_id)
      : "";
  }

  return "";
}

export async function sendBookingConfirmationWhatsapp({
  amountPaid,
  paymentStatus,
  crqId,
  departureDate,
  recipientNumber,
  tourName,
  travellerName,
}: BookingConfirmationWhatsappPayload): Promise<{
  requestId: string;
  response: Msg91WhatsappResponse;
}> {
  const authKey = getMsg91AuthKey();
  const namespace = getTemplateNamespace();
  const response = await axios
    .post<Msg91WhatsappResponse>(
      `${whatsappBaseUrl}/whatsapp-outbound-message/bulk/`,
      {
        integrated_number: bookingConfirmationIntegratedNumber,
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          template: {
            name: bookingConfirmationTemplateName,
            language: {
              code: defaultTemplateLanguage,
              policy: "deterministic",
            },
            ...(namespace ? { namespace } : {}),
            to_and_components: [
              {
                to: [recipientNumber],
                components: {
                  body_1: {
                    type: "text",
                    value: travellerName,
                  },
                  body_2: {
                    type: "text",
                    value: tourName,
                  },
                  body_3: {
                    type: "text",
                    value: departureDate,
                  },
                  body_4: {
                    type: "text",
                    value: amountPaid,
                  },
                  body_5: {
                    type: "text",
                    value: paymentStatus,
                  },
                },
                ...(crqId ? { CRQID: crqId } : {}),
              },
            ],
          },
        },
      },
      {
        headers: {
          accept: "application/json",
          authkey: authKey,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    )
    .catch((error: unknown) => {
      throw toHttpError(error, "MSG91 failed to send WhatsApp confirmation");
    });

  if (hasFailureResponse(response.data)) {
    throw new HttpError(
      502,
      extractMsg91Message(
        response.data,
        "MSG91 failed to send WhatsApp confirmation"
      )
    );
  }

  return {
    requestId: getRequestId(response.data),
    response: response.data,
  };
}

export async function sendBookingRecoveryWhatsapp({
  crqId,
  recipientNumber,
  recoveryUrl,
  tourName,
  travellerName,
}: BookingRecoveryWhatsappPayload): Promise<{
  requestId: string;
  response: Msg91WhatsappResponse;
}> {
  const authKey = getMsg91AuthKey();
  const namespace = getTemplateNamespace();
  const response = await axios
    .post<Msg91WhatsappResponse>(
      `${whatsappBaseUrl}/whatsapp-outbound-message/bulk/`,
      {
        integrated_number: bookingConfirmationIntegratedNumber,
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          template: {
            name: bookingReminderTemplateName,
            language: {
              code: defaultTemplateLanguage,
              policy: "deterministic",
            },
            ...(namespace ? { namespace } : {}),
            to_and_components: [
              {
                to: [recipientNumber],
                components: {
                  body_1: {
                    type: "text",
                    value: travellerName,
                  },
                  body_2: {
                    type: "text",
                    value: tourName,
                  },
                  button_1: {
                    subtype: "url",
                    type: "text",
                    value: recoveryUrl,
                  },
                },
                ...(crqId ? { CRQID: crqId } : {}),
              },
            ],
          },
        },
      },
      {
        headers: {
          accept: "application/json",
          authkey: authKey,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    )
    .catch((error: unknown) => {
      throw toHttpError(error, "MSG91 failed to send WhatsApp recovery reminder");
    });

  if (hasFailureResponse(response.data)) {
    throw new HttpError(
      502,
      extractMsg91Message(
        response.data,
        "MSG91 failed to send WhatsApp recovery reminder"
      )
    );
  }

  return {
    requestId: getRequestId(response.data),
    response: response.data,
  };
}

export async function sendBookingFinalPaymentWhatsapp({
  crqId,
  paymentUrl,
  recipientNumber,
  tourName,
  travellerName,
}: BookingFinalPaymentWhatsappPayload): Promise<{
  requestId: string;
  response: Msg91WhatsappResponse;
}> {
  const authKey = getMsg91AuthKey();
  const namespace = getTemplateNamespace();
  const response = await axios
    .post<Msg91WhatsappResponse>(
      `${whatsappBaseUrl}/whatsapp-outbound-message/bulk/`,
      {
        integrated_number: bookingConfirmationIntegratedNumber,
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          template: {
            name: finalPaymentTemplateName,
            language: {
              code: defaultTemplateLanguage,
              policy: "deterministic",
            },
            ...(namespace ? { namespace } : {}),
            to_and_components: [
              {
                to: [recipientNumber],
                components: {
                  body_1: {
                    type: "text",
                    value: travellerName,
                  },
                  body_2: {
                    type: "text",
                    value: tourName,
                  },
                  button_1: {
                    subtype: "url",
                    type: "text",
                    value: paymentUrl,
                  },
                },
                ...(crqId ? { CRQID: crqId } : {}),
              },
            ],
          },
        },
      },
      {
        headers: {
          accept: "application/json",
          authkey: authKey,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    )
    .catch((error: unknown) => {
      throw toHttpError(error, "MSG91 failed to send WhatsApp final payment link");
    });

  if (hasFailureResponse(response.data)) {
    throw new HttpError(
      502,
      extractMsg91Message(
        response.data,
        "MSG91 failed to send WhatsApp final payment link"
      )
    );
  }

  return {
    requestId: getRequestId(response.data),
    response: response.data,
  };
}

export async function sendBookingPaymentLinkWhatsapp({
  amount,
  bookingReference,
  crqId,
  paymentPurpose,
  paymentUrl,
  recipientNumber,
  tourName,
  travellerName,
}: BookingPaymentLinkWhatsappPayload): Promise<{
  requestId: string;
  response: Msg91WhatsappResponse;
}> {
  const authKey = getMsg91AuthKey();
  const namespace = getTemplateNamespace();
  const templateName = getPaymentLinkTemplateName();
  const response = await axios
    .post<Msg91WhatsappResponse>(
      `${whatsappBaseUrl}/whatsapp-outbound-message/bulk/`,
      {
        integrated_number: bookingConfirmationIntegratedNumber,
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          template: {
            name: templateName,
            language: {
              code: defaultTemplateLanguage,
              policy: "deterministic",
            },
            ...(namespace ? { namespace } : {}),
            to_and_components: [
              {
                to: [recipientNumber],
                components: {
                  body_1: {
                    type: "text",
                    value: travellerName,
                  },
                  body_2: {
                    type: "text",
                    value: bookingReference,
                  },
                  body_3: {
                    type: "text",
                    value: tourName,
                  },
                  body_4: {
                    type: "text",
                    value: paymentPurpose,
                  },
                  body_5: {
                    type: "text",
                    value: amount,
                  },
                  body_6: {
                    type: "text",
                    value: paymentUrl,
                  },
                },
                ...(crqId ? { CRQID: crqId } : {}),
              },
            ],
          },
        },
      },
      {
        headers: {
          accept: "application/json",
          authkey: authKey,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    )
    .catch((error: unknown) => {
      throw toHttpError(error, "MSG91 failed to send WhatsApp payment link");
    });

  if (hasFailureResponse(response.data)) {
    throw new HttpError(
      502,
      extractMsg91Message(response.data, "MSG91 failed to send WhatsApp payment link")
    );
  }

  return {
    requestId: getRequestId(response.data),
    response: response.data,
  };
}

export async function sendOfflineBookingAdminWhatsapp(values: {
  travellerName: string; bookingReference: string; tourName: string;
  departureDate: string; totalAmount: string; travellerPhone: string;
  totalGuests: string; paymentMethod: string;
}) {
  const templateName = process.env.MSG91_WHATSAPP_OFFLINE_BOOKING_TEMPLATE_NAME?.trim();
  const recipients = [...new Set((process.env.OFFLINE_BOOKING_ALERT_WHATSAPP_NUMBERS || "")
    .split(",").map(value => value.replace(/\D/g, "")).filter(Boolean))];
  if (!templateName || recipients.length === 0) {
    throw new HttpError(503, "Configure OFFLINE_BOOKING_ALERT_WHATSAPP_NUMBERS and an approved MSG91_WHATSAPP_OFFLINE_BOOKING_TEMPLATE_NAME");
  }
  if (recipients.some(value => !/^\d{8,15}$/.test(value))) {
    throw new HttpError(503, "Offline booking admin WhatsApp numbers must include the country code");
  }
  const variables = [values.bookingReference, values.travellerName, values.travellerPhone,
    values.tourName, values.departureDate, values.totalGuests, values.totalAmount, values.paymentMethod];
  const namespace = getTemplateNamespace();
  const response = await axios.post<Msg91WhatsappResponse>(
    `${whatsappBaseUrl}/whatsapp-outbound-message/bulk/`,
    {
      integrated_number: bookingConfirmationIntegratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp", type: "template",
        template: {
          name: templateName,
          language: { code: defaultTemplateLanguage, policy: "deterministic" },
          ...(namespace ? { namespace } : {}),
          to_and_components: [{
            to: recipients,
            components: Object.fromEntries(variables.map((value, index) =>
              [`body_${index + 1}`, { type: "text", value }])),
          }],
        },
      },
    },
    { headers: { authkey: getMsg91AuthKey(), "Content-Type": "application/json" }, timeout: 10000 }
  ).catch((error: unknown) => { throw toHttpError(error, "Offline booking admin WhatsApp alert failed"); });
  if (hasFailureResponse(response.data)) {
    throw new HttpError(502, extractMsg91Message(response.data, "Offline booking admin WhatsApp alert failed"));
  }
  return { requestId: getRequestId(response.data) };
}
async function sendPaymentLifecycleTemplate(templateName: string, recipientNumber: string, values: string[], crqId: string) {
  const namespace = getTemplateNamespace();
  const response = await axios.post<Msg91WhatsappResponse>(
    whatsappBaseUrl + "/whatsapp-outbound-message/bulk/",
    { integrated_number: bookingConfirmationIntegratedNumber, content_type: "template", payload: {
      messaging_product: "whatsapp", type: "template", template: {
        name: templateName, language: { code: defaultTemplateLanguage, policy: "deterministic" },
        ...(namespace ? { namespace } : {}), to_and_components: [{ to: [recipientNumber], CRQID: crqId,
          components: Object.fromEntries(values.map((value, index) => ["body_" + (index + 1), { type: "text", value }])) }],
      },
    } },
    { headers: { accept: "application/json", authkey: getMsg91AuthKey(), "Content-Type": "application/json" }, timeout: 10000 }
  ).catch((error: unknown) => { throw toHttpError(error, "MSG91 payment notification failed"); });
  if (hasFailureResponse(response.data)) throw new HttpError(502, extractMsg91Message(response.data, "MSG91 payment notification failed"));
  return { requestId: getRequestId(response.data) };
}
export function sendRemainingPaymentReminderWhatsapp(payload: {
  recipientNumber: string; travellerName: string; dueDate: string; tourName: string; bookingReference: string;
  totalAmount: string; amountPaid: string; remainingAmount: string; paymentUrl: string; crqId: string;
}) {
  return sendPaymentLifecycleTemplate("remaining_payment_reminder", payload.recipientNumber,
    [payload.travellerName, payload.dueDate, payload.tourName, payload.bookingReference,
      payload.totalAmount, payload.amountPaid, payload.remainingAmount, payload.paymentUrl], payload.crqId);
}
export function sendTourFullPaymentConfirmationWhatsapp(payload: {
  recipientNumber: string; travellerName: string; tourName: string; bookingReference: string;
  amountPaid: string; paymentDate: string; crqId: string;
}) {
  return sendPaymentLifecycleTemplate("tour_full_payment_confirmation", payload.recipientNumber,
    [payload.travellerName, payload.tourName, payload.bookingReference, payload.amountPaid, payload.paymentDate], payload.crqId);
}
