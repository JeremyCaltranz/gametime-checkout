import assert from "node:assert/strict";
import { test } from "node:test";
import { DECLINE_MESSAGE, type PaymentRequest } from "./contract";
import { createPaymentsClient } from "./client";
import {
  createMemoryStore,
  createMockServer,
  LEDGER_KEY,
  type HandleResult,
  type PaymentScenario,
} from "./mockServer";

const approved: PaymentRequest = {
  amountCents: 9000,
  currency: "usd",
  method: "card",
  token: "tok_visa_4242_ok",
};

function setup(initial: PaymentScenario = "normal") {
  let scenario = initial;
  const store = createMemoryStore();
  const server = createMockServer({
    store,
    peekScenario: async () => scenario,
    consumeScenario: async () => {
      scenario = "normal";
    },
  });
  return {
    server,
    store,
    scenario: () => scenario,
  };
}

function post(key: string, body: PaymentRequest = approved) {
  return {
    method: "POST" as const,
    path: "/v1/payments",
    headers: { "Idempotency-Key": key },
    body,
  };
}

async function asResponse(result: HandleResult) {
  assert.equal(result.kind, "response");
  if (result.kind !== "response") throw new Error("expected a response");
  return result;
}

test("replay returns the same payment id and does not create a second charge", async () => {
  const { server } = setup();
  const first = await asResponse(await server.handle(post("key-1")));
  const second = await asResponse(await server.handle(post("key-1")));
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal((first.body as { id: string }).id, (second.body as { id: string }).id);
  assert.equal(await server.ledgerCount(), 1);
});

test("the same key with a different body is a conflict", async () => {
  const { server } = setup();
  await server.handle(post("key-1"));
  const conflict = await asResponse(
    await server.handle(post("key-1", { ...approved, amountCents: 16000 })),
  );
  assert.equal(conflict.status, 422);
  assert.deepEqual(conflict.body, { code: "idempotency_key_reused" });
  assert.equal(await server.ledgerCount(), 1);
});

test("a declined token is stored and replayed as 402", async () => {
  const { server } = setup();
  const declined = { ...approved, token: "tok_visa_0002_declined" };
  const first = await asResponse(await server.handle(post("key-1", declined)));
  const second = await asResponse(await server.handle(post("key-1", declined)));
  assert.equal(first.status, 402);
  assert.equal(second.status, 402);
  assert.deepEqual(first.body, {
    status: "declined",
    code: "card_declined",
    message: DECLINE_MESSAGE,
  });
  assert.equal(await server.ledgerCount(), 1);

  const lookup = await asResponse(
    await server.handle({ method: "GET", path: "/v1/payments?idempotencyKey=key-1" }),
  );
  assert.equal(lookup.status, 200);
  assert.equal((lookup.body as { status: string }).status, "declined");
});

test("a dropped response leaves one stored success", async () => {
  const { server, scenario } = setup("drop");
  const dropped = await server.handle(post("key-1"));
  assert.equal(dropped.kind, "drop");
  assert.equal(scenario(), "normal");
  assert.equal(await server.ledgerCount(), 1);

  const lookup = await asResponse(
    await server.handle({ method: "GET", path: "/v1/payments?idempotencyKey=key-1" }),
  );
  assert.equal(lookup.status, 200);
  assert.equal((lookup.body as { status: string }).status, "succeeded");
});

test("the client treats a dropped response as a failure and the following GET finds one charge", async () => {
  const { server } = setup("drop");
  const client = createPaymentsClient(async (request) => {
    const result = await server.handle(request);
    if (result.kind === "drop") throw new Error("response_dropped");
    return { status: result.status, body: result.body };
  });
  await assert.rejects(() => client.postPayment(approved, "key-1"));
  const found = await client.getPayment("key-1");
  assert.equal(found.found, true);
  if (found.found) assert.equal(found.status, "succeeded");
  assert.equal(await server.ledgerCount(), 1);
});

test("a missing charge is a 404 and the PAN is not stored", async () => {
  const { server, store } = setup();
  const missing = await asResponse(
    await server.handle({ method: "GET", path: "/v1/payments?idempotencyKey=nope" }),
  );
  assert.equal(missing.status, 404);

  await server.handle(post("key-1"));
  const raw = await store.get(LEDGER_KEY);
  assert.equal(raw?.includes("4242424242424242"), false);
});

test("overlapping posts for one key create one charge", async () => {
  const { server } = setup();
  const [first, second] = await Promise.all([server.handle(post("key-1")), server.handle(post("key-1"))]);
  const left = await asResponse(first);
  const right = await asResponse(second);
  assert.equal((left.body as { id: string }).id, (right.body as { id: string }).id);
  assert.equal(await server.ledgerCount(), 1);
});
