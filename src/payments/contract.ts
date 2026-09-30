export const PAYMENT_METHODS = ["apple_pay", "google_pay", "affirm", "card"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const DECLINE_MESSAGE = "Payment was declined.";

export type PaymentRequest = {
  amountCents: number;
  currency: "usd";
  method: PaymentMethod;
  token: string;
};

export type SucceededBody = {
  id: string;
  status: "succeeded";
  amountCents: number;
  method: PaymentMethod;
};

export type DeclinedBody = {
  status: "declined";
  code: "card_declined";
  message: string;
};

export type PaymentLookup =
  | { found: false }
  | {
      found: true;
      id: string;
      status: "succeeded" | "declined";
      amountCents: number;
      message?: string;
    };

export type ApiRequest = {
  method: "GET" | "POST";
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export type ApiResponse = {
  status: number;
  body: unknown;
};

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && (PAYMENT_METHODS as readonly string[]).includes(value);
}
