import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatUsd,
  getEligibleMethods,
  orderTotalCents,
} from "./eligibility";

test("quantity 1 stays under $100 and quantity 2 crosses it", () => {
  assert.equal(orderTotalCents(1), 9000);
  assert.equal(orderTotalCents(2), 16000);
  assert.equal(formatUsd(9000), "$90.00");
  assert.equal(formatUsd(16000), "$160.00");

  const under = getEligibleMethods({
    platform: "ios",
    walletReady: true,
    totalCents: orderTotalCents(1),
  });
  const over = getEligibleMethods({
    platform: "ios",
    walletReady: true,
    totalCents: orderTotalCents(2),
  });
  assert.equal(under.includes("affirm"), false);
  assert.equal(over.includes("affirm"), true);
});

test("exactly $100.00 does not qualify for Affirm and one cent over does", () => {
  assert.deepEqual(
    getEligibleMethods({ platform: "android", walletReady: false, totalCents: 10000 }),
    ["card"],
  );
  assert.deepEqual(
    getEligibleMethods({ platform: "android", walletReady: false, totalCents: 10001 }),
    ["affirm", "card"],
  );
});

test("wallet methods follow the platform and card is always last", () => {
  assert.deepEqual(
    getEligibleMethods({ platform: "ios", walletReady: true, totalCents: 16000 }),
    ["apple_pay", "affirm", "card"],
  );
  assert.deepEqual(
    getEligibleMethods({ platform: "ios", walletReady: false, totalCents: 16000 }),
    ["affirm", "card"],
  );
  assert.deepEqual(
    getEligibleMethods({ platform: "android", walletReady: true, totalCents: 5000 }),
    ["google_pay", "card"],
  );
  assert.deepEqual(
    getEligibleMethods({ platform: "android", walletReady: false, totalCents: 5000 }),
    ["card"],
  );
  assert.deepEqual(
    getEligibleMethods({ platform: "ios", walletReady: true, totalCents: 5000 }),
    ["apple_pay", "card"],
  );
  assert.equal(
    getEligibleMethods({ platform: "android", walletReady: true, totalCents: 16000 }).includes(
      "apple_pay",
    ),
    false,
  );
});
