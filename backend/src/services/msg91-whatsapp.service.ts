import axios from "axios";

import { HttpError } from "../utils/httpError";

const whatsappBaseUrl =
  process.env.MSG91_WHATSAPP_BASE_URL ||
  "https://control.msg91.com/api/v5/whatsapp";
const bookingConfirmationTemplateName = "booking_confirmation";
const bookingConfirmationIntegratedNumber = "917262930404";
const defaultTemplateLanguage =
  process.env.MSG91_WHATSAPP_TEMPLATE_LANGUAGE || "en";

type Msg91WhatsappResponse = {
  type?: string;
  message?: string;
  requestId?: string;
  request_id?: string;
  data?: unknown;
  [key: string]: unknown;
};

export type BookingConfirmationWhatsappPayload = {
  recipientNumber: string;
  travellerName: string;
  tourName: string;
  departureDate: string;
  crqId?: string;
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

function hasFailureResponse(data: Msg91WhatsappResponse) {
  const type = data.type?.toLowerCase() || "";
  const message = data.message?.toLowerCase() || "";

  return type === "error" || message.includes("error") || message.includes("fail");
}

function extractMsg91Message(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as Msg91WhatsappResponse).message;

    if (typeof message === "string" && message.trim()) {
      return message;
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
