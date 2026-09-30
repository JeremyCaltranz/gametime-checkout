import type { PaymentLookup, PaymentMethod } from "./payments/contract";

export type CheckoutPhase =
  | "checking"
  | "ready"
  | "authorizing"
  | "processing"
  | "reconciling"
  | "declined"
  | "succeeded";

export type PaymentIntent = {
  idempotencyKey: string;
  amountCents: number;
  method: PaymentMethod;
};

export type CheckoutState = {
  phase: CheckoutPhase;
  intent: PaymentIntent | null;
  notice: string | null;
  declineMessage: string | null;
  confirmationId: string | null;
  chargedCents: number | null;
};

export const initialCheckoutState: CheckoutState = {
  phase: "checking",
  intent: null,
  notice: null,
  declineMessage: null,
  confirmationId: null,
  chargedCents: null,
};

export type CheckoutEvent =
  | { type: "capabilities_ready" }
  | { type: "hydrate_pending"; intent: PaymentIntent }
  | { type: "start_express"; intent: PaymentIntent }
  | { type: "start_card"; intent: PaymentIntent }
  | { type: "cancel_authorization" }
  | { type: "approved" }
  | { type: "payment_succeeded"; id: string; amountCents: number }
  | { type: "payment_declined"; message: string }
  | { type: "request_failed" }
  | { type: "reconcile_missing" }
  | { type: "retry" }
  | { type: "new_order" }
  | { type: "dev_reset" };

export function checkoutReducer(state: CheckoutState, event: CheckoutEvent): CheckoutState {
  switch (event.type) {
    case "capabilities_ready":
      if (state.phase !== "checking") return state;
      return { ...state, phase: "ready" };
    case "hydrate_pending":
      return {
        ...state,
        phase: "reconciling",
        intent: event.intent,
        notice: null,
        declineMessage: null,
      };
    case "start_express":
      if (state.phase !== "ready") return state;
      return {
        ...state,
        phase: "authorizing",
        intent: event.intent,
        notice: null,
        declineMessage: null,
        confirmationId: null,
        chargedCents: null,
      };
    case "start_card":
      if (state.phase !== "ready") return state;
      return {
        ...state,
        phase: "processing",
        intent: event.intent,
        notice: null,
        declineMessage: null,
        confirmationId: null,
        chargedCents: null,
      };
    case "cancel_authorization":
      if (state.phase !== "authorizing") return state;
      return { ...state, phase: "ready", intent: null };
    case "approved":
      if (state.phase !== "authorizing") return state;
      return { ...state, phase: "processing" };
    case "payment_succeeded":
      if (state.phase !== "processing" && state.phase !== "reconciling") return state;
      return {
        ...state,
        phase: "succeeded",
        intent: null,
        notice: null,
        declineMessage: null,
        confirmationId: event.id,
        chargedCents: event.amountCents,
      };
    case "payment_declined":
      if (state.phase !== "processing" && state.phase !== "reconciling") return state;
      return {
        ...state,
        phase: "declined",
        intent: null,
        notice: null,
        declineMessage: event.message,
        confirmationId: null,
        chargedCents: null,
      };
    case "request_failed":
      if (state.phase !== "processing") return state;
      return { ...state, phase: "reconciling" };
    case "reconcile_missing":
      if (state.phase !== "reconciling") return state;
      return {
        ...state,
        phase: "ready",
        intent: null,
        notice: "No charge was made.",
      };
    case "retry":
      if (state.phase !== "declined") return state;
      return { ...state, phase: "ready", declineMessage: null };
    case "new_order":
      if (state.phase !== "succeeded") return state;
      return { ...initialCheckoutState, phase: "ready" };
    case "dev_reset":
      return { ...initialCheckoutState, phase: "ready" };
    default:
      return state;
  }
}

export function eventForPaymentLookup(lookup: PaymentLookup): CheckoutEvent {
  if (!lookup.found) return { type: "reconcile_missing" };
  if (lookup.status === "succeeded") return { type: "payment_succeeded", id: lookup.id, amountCents: lookup.amountCents };
  return {
    type: "payment_declined",
    message: lookup.message ?? "Payment was declined.",
  };
}
