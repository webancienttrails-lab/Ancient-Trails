import crypto from "node:crypto";
import axios from "axios";
import { HttpError } from "../../utils/httpError";

export type VirtualAccount = {
  id: string; status: string; close_by?: number; closed_at?: number;
  amount_paid?: number; notes?: Record<string, string>;
  receivers?: Array<{ entity: string; name: string; account_number: string; ifsc: string; bank_name?: string }>;
};
export type BankPayment = {
  id: string; amount: number; currency: string; status: string; method: string;
  captured?: boolean; created_at: number; amount_refunded?: number;
};
export type BankTransfer = {
  payment_id: string; virtual_account_id: string; amount: number; mode?: string; bank_reference?: string;
  virtual_account?: VirtualAccount;
};
export function smartCollectContext(keyId: string) {
  const match = /^rzp_(test|live)_/.exec(keyId);
  if (!match) throw new HttpError(503, "Smart Collect requires a valid Razorpay test or live key");
  return {
    environment: match[1] as "test" | "live",
    scope: crypto.createHash("sha256").update(keyId).digest("hex"),
  };
}
export class SmartCollectGatewayError extends HttpError {
  readonly definitiveRejection: boolean;
  constructor(providerStatus?: number) {
    super(502, providerStatus ? "Razorpay Smart Collect request failed (HTTP " + providerStatus + ")" : "Razorpay Smart Collect is temporarily unreachable");
    this.definitiveRejection = [400, 401, 403, 422].includes(providerStatus || 0);
  }
}
export function createSmartCollectGateway(keyId: string, keySecret: string) {
  const context = smartCollectContext(keyId);
  const api = axios.create({
    baseURL: "https://api.razorpay.com/v1",
    auth: { username: keyId, password: keySecret }, timeout: 15000,
  });
  // Never pass Axios request configs (which contain Basic Auth secrets) to application logging.
  api.interceptors.response.use(response => response, (error: unknown) => {
    throw new SmartCollectGatewayError(axios.isAxiosError(error) ? error.response?.status : undefined);
  });
  const id = (value: string, prefix: string) => {
    if (!new RegExp("^" + prefix + "_[A-Za-z0-9]+$").test(value)) throw new HttpError(400, "Invalid Razorpay identifier");
    return value;
  };
  return {
    ...context,
    async create(data: Record<string, unknown>) {
      return (await api.post<VirtualAccount>("/virtual_accounts", data)).data;
    },
    async fetch(virtualAccountId: string) {
      return (await api.get<VirtualAccount>("/virtual_accounts/" + id(virtualAccountId, "va"))).data;
    },
    async close(virtualAccountId: string) {
      return (await api.post<VirtualAccount>("/virtual_accounts/" + id(virtualAccountId, "va") + "/close")).data;
    },
    async list(skip: number) {
      return (await api.get<{ items: VirtualAccount[] }>("/virtual_accounts", { params: { count: 100, skip } })).data.items;
    },
    async payments(virtualAccountId: string, skip: number) {
      return (await api.get<{ items: BankPayment[] }>("/virtual_accounts/" + id(virtualAccountId, "va") + "/payments",
        { params: { count: 100, skip } })).data.items;
    },
    async payment(paymentId: string) {
      return (await api.get<BankPayment>("/payments/" + id(paymentId, "pay"))).data;
    },
    async transfer(paymentId: string) {
      return (await api.get<BankTransfer>("/payments/" + id(paymentId, "pay") + "/bank_transfer")).data;
    },
  };
}
export type SmartCollectGateway = ReturnType<typeof createSmartCollectGateway>;
export function verifySmartCollectSignature(raw: unknown, signature: string, secret: string) {
  if (!secret) throw new HttpError(503, "Smart Collect webhook secret is not configured");
  if (!Buffer.isBuffer(raw) || !/^[a-f0-9]{64}$/i.test(signature)) throw new HttpError(400, "Invalid webhook signature");
  const expected = crypto.createHmac("sha256", secret).update(raw).digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(signature, "hex"))) throw new HttpError(400, "Invalid webhook signature");
}
