import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkoutReducer,
  eventForPaymentLookup,
  initialCheckoutState,
  type CheckoutState,
  type PaymentIntent,
} from "./machine";

const intent: PaymentIntent = {
  idempotencyKey: "key-1",
  amountCents: 9000,
  method: "apple_pay",
};

function ready(): CheckoutState {
  return checkoutReducer(initialCheckoutState, { type: "capabilities_ready" });
}

test("express tap, cancel, and approve", () => {
  let state = ready();
  state = checkoutReducer(state, { type: "start_express", intent });
  assert.equal(state.phase, "authorizing");
  assert.equal(state.intent?.idempotencyKey, "key-1");

  const cancelled = checkoutReducer(state, { type: "cancel_authorization" });
  assert.equal(cancelled.phase, "ready");
  assert.equal(cancelled.intent, null);
  assert.equal(cancelled.notice, null);

  state = checkoutReducer(state, { type: "approved" });
  assert.equal(state.phase, "processing");
  state = checkoutReducer(state, { type: "payment_succeeded", id: "pay_0001", amountCents: 9000 });
  assert.equal(state.phase, "succeeded");
  assert.equal(state.intent, null);
  assert.equal(state.confirmationId, "pay_0001");
});

test("card submit declines, and retry returns to ready for a new key", () => {
  let state = ready();
  state = checkoutReducer(state, {
    type: "start_card",
    intent: { ...intent, method: "card" },
  });
  assert.equal(state.phase, "processing");
  state = checkoutReducer(state, {
    type: "payment_declined",
    message: "Payment was declined.",
  });
  assert.equal(state.phase, "declined");
  assert.equal(state.intent, null);

  state = checkoutReducer(state, { type: "retry" });
  assert.equal(state.phase, "ready");
  assert.equal(state.declineMessage, null);

  state = checkoutReducer(state, {
    type: "start_card",
    intent: { ...intent, idempotencyKey: "key-2", method: "card" },
  });
  assert.equal(state.intent?.idempotencyKey, "key-2");
});

test("reconciles a stored success, a stored decline, and a missing charge", () => {
  let state = checkoutReducer(initialCheckoutState, { type: "hydrate_pending", intent });
  assert.equal(state.phase, "reconciling");
  state = checkoutReducer(
    state,
    eventForPaymentLookup({ found: true, status: "succeeded", id: "pay_0001", amountCents: 9000 }),
  );
  assert.equal(state.phase, "succeeded");
  assert.equal(state.confirmationId, "pay_0001");
  assert.equal(state.intent, null);

  state = checkoutReducer(initialCheckoutState, { type: "hydrate_pending", intent });
  state = checkoutReducer(
    state,
    eventForPaymentLookup({
      found: true,
      status: "declined",
      id: "pay_0002",
      amountCents: 9000,
      message: "Payment was declined.",
    }),
  );
  assert.equal(state.phase, "declined");
  assert.equal(state.declineMessage, "Payment was declined.");

  state = checkoutReducer(ready(), { type: "start_card", intent });
  state = checkoutReducer(state, { type: "request_failed" });
  assert.equal(state.phase, "reconciling");
  state = checkoutReducer(state, eventForPaymentLookup({ found: false }));
  assert.equal(state.phase, "ready");
  assert.equal(state.notice, "No charge was made.");
  assert.equal(state.intent, null);
});
