import {
  isPaymentMethod,
  type ApiRequest,
  type ApiResponse,
  type PaymentLookup,
  type PaymentMethod,
  type PaymentRequest,
} from "./contract";

export type Transport = (request: ApiRequest) => Promise<ApiResponse>;

export type PostPaymentResult =
  | { status: "succeeded"; id: string; amountCents: number; method: PaymentMethod }
  | { status: "declined"; message: string };

export function createPaymentsClient(transport: Transport) {
  return {
    async postPayment(body: PaymentRequest, idempotencyKey: string): Promise<PostPaymentResult> {
      const response = await transport({
        method: "POST",
        path: "/v1/payments",
        headers: { "Idempotency-Key": idempotencyKey },
        body,
      });
      if (response.status === 200 && isSucceeded(response.body)) {
        return {
          status: "succeeded",
          id: response.body.id,
          amountCents: response.body.amountCents,
          method: response.body.method,
        };
      }
      if (response.status === 402 && isDeclined(response.body)) {
        return { status: "declined", message: response.body.message };
      }
      throw new Error(`Unexpected payment response (${response.status})`);
    },

    async getPayment(idempotencyKey: string): Promise<PaymentLookup> {
      const response = await transport({
        method: "GET",
        path: `/v1/payments?idempotencyKey=${encodeURIComponent(idempotencyKey)}`,
      });
      if (response.status === 404) return { found: false };
      if (response.status === 200 && isStored(response.body)) {
        return {
          found: true,
          id: response.body.id,
          status: response.body.status,
          amountCents: response.body.amountCents,
          message: typeof response.body.message === "string" ? response.body.message : undefined,
        };
      }
      throw new Error(`Unexpected lookup response (${response.status})`);
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSucceeded(value: unknown): value is {
  id: string;
  status: "succeeded";
  amountCents: number;
  method: PaymentMethod;
} {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.status === "succeeded" &&
    typeof value.amountCents === "number" &&
    isPaymentMethod(value.method)
  );
}

function isDeclined(value: unknown): value is { status: "declined"; message: string } {
  if (!isRecord(value)) return false;
  return value.status === "declined" && typeof value.message === "string";
}

function isStored(value: unknown): value is {
  id: string;
  status: "succeeded" | "declined";
  amountCents: number;
  message?: string;
} {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.amountCents === "number" &&
    (value.status === "succeeded" || value.status === "declined")
  );
}
