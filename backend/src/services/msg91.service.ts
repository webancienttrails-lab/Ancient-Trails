import axios from "axios";

import { HttpError } from "../utils/httpError";
import { guardedOtpSend, guardedOtpVerification } from "./otp-security.service";

type Msg91Response = {
  type?: string;
  message?: string;
  [key: string]: unknown;
};

type Msg91Config = {
  authKey: string;
  templateId: string;
  baseUrl: string;
};

function getMsg91Config(): Msg91Config {
  const authKey = process.env.MSG91_AUTH_KEY?.trim();
  const templateId = process.env.MSG91_TEMPLATE_ID?.trim();

  if (!authKey || !templateId) {
    throw new HttpError(
      503,
      "MSG91 OTP service is not configured. Set MSG91_AUTH_KEY and MSG91_TEMPLATE_ID."
    );
  }

  return {
    authKey,
    templateId,
    baseUrl: process.env.MSG91_BASE_URL || "https://control.msg91.com/api/v5",
  };
}

function hasSuccessResponse(data: Msg91Response): boolean {
  return typeof data.type === "string" && data.type.toLowerCase() === "success";
}

function extractMsg91Message(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as Msg91Response).message;

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
}

function toHttpError(error: unknown, fallback: string): HttpError {
  if (error instanceof HttpError) {
    if (/already\s+verified/i.test(error.message)) {
      return new HttpError(401, "This OTP has already been used. Request a new OTP to continue.");
    }
    return error;
  }

  if (axios.isAxiosError(error)) {
    const statusCode = error.response?.status || 502;
    const message = extractMsg91Message(error.response?.data, fallback);

    if (/already\s+verified/i.test(message)) {
      return new HttpError(401, "This OTP has already been used. Request a new OTP to continue.");
    }

    return new HttpError(statusCode >= 500 ? 502 : statusCode, message);
  }

  return new HttpError(502, fallback);
}

export async function sendOtp(mobileNumber: string, ip = "unknown"): Promise<Msg91Response> {
  return guardedOtpSend(mobileNumber, ip, () => sendProviderOtp(mobileNumber));
}

async function sendProviderOtp(mobileNumber: string): Promise<Msg91Response> {
  const config = getMsg91Config();

  try {
    const response = await axios.post<Msg91Response>(
      `${config.baseUrl}/otp`,
      {},
      {
        params: {
          template_id: config.templateId,
          mobile: mobileNumber,
          authkey: config.authKey,
          otp_length: 6,
          otp_expiry: 5,
        },
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    if (!hasSuccessResponse(response.data)) {
      throw new HttpError(
        502,
        extractMsg91Message(response.data, "MSG91 failed to send OTP")
      );
    }

    return response.data;
  } catch (error) {
    throw toHttpError(error, "MSG91 failed to send OTP");
  }
}

export async function verifyOtp(
  mobileNumber: string,
  otp: string
): Promise<Msg91Response> {
  return guardedOtpVerification(mobileNumber, otp, () => verifyProviderOtp(mobileNumber, otp));
}

async function verifyProviderOtp(mobileNumber: string, otp: string): Promise<Msg91Response> {
  const config = getMsg91Config();

  try {
    const response = await axios.get<Msg91Response>(
      `${config.baseUrl}/otp/verify`,
      {
        params: {
          otp,
          mobile: mobileNumber,
        },
        headers: {
          authkey: config.authKey,
        },
        timeout: 10000,
      }
    );

    if (!hasSuccessResponse(response.data)) {
      throw new HttpError(
        401,
        extractMsg91Message(response.data, "Invalid or expired OTP")
      );
    }

    return response.data;
  } catch (error) {
    throw toHttpError(error, "Invalid or expired OTP");
  }
}
