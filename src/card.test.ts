import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cvcLength,
  detectBrand,
  formatExpiry,
  formatPan,
  isCardValid,
  isCvcValid,
  isExpiryValid,
  isPanValid,
  luhnValid,
  tokenizeCard,
} from "./card";

const now = new Date(2026, 8, 30);

test("formats card numbers, including a pasted 16-digit value and Amex grouping", () => {
  assert.equal(formatPan("4242424242424242"), "4242 4242 4242 4242");
  assert.equal(formatPan("4242 4242 4242 4242"), "4242 4242 4242 4242");
  assert.equal(formatPan("42424242424242429999"), "4242 4242 4242 4242");
  assert.equal(formatPan("378282246310005"), "3782 822463 10005");
  assert.equal(formatExpiry("1226"), "12/26");
  assert.equal(formatExpiry("12/26"), "12/26");
});

test("detects brand, length, and CVC from the BIN", () => {
  assert.equal(detectBrand("4242"), "visa");
  assert.equal(detectBrand("5555555555554444"), "mastercard");
  assert.equal(detectBrand("2221000000000000"), "mastercard");
  assert.equal(detectBrand("378282246310005"), "amex");
  assert.equal(detectBrand("6011111111111117"), "discover");
  assert.equal(detectBrand("9999"), "unknown");
  assert.equal(cvcLength("amex"), 4);
  assert.equal(cvcLength("visa"), 3);
  assert.equal(isCvcValid("1234", "amex"), true);
  assert.equal(isCvcValid("123", "amex"), false);
  assert.equal(isCvcValid("123", "visa"), true);
  assert.equal(isCvcValid("1234", "visa"), false);
});

test("checks Luhn, expiry, and the decline test card", () => {
  assert.equal(luhnValid("4242424242424242"), true);
  assert.equal(luhnValid("4242424242424241"), false);
  assert.equal(isPanValid("4242424242424242"), true);
  assert.equal(isPanValid("4242 4242 4242 4241"), false);
  assert.equal(isPanValid("4000000000000002"), true);
  assert.equal(isPanValid("378282246310005"), true);
  assert.equal(isExpiryValid("09/26", now), true);
  assert.equal(isExpiryValid("08/26", now), false);
  assert.equal(isExpiryValid("10/26", now), true);
  assert.equal(isExpiryValid("09/25", now), false);
  assert.equal(isExpiryValid("13/26", now), false);
  assert.equal(isExpiryValid("00/26", now), false);
  assert.equal(isCardValid("4242 4242 4242 4242", "12/26", "123", now), true);
  assert.equal(isCardValid("4242 4242 4242 4242", "12/26", "12", now), false);
  assert.equal(tokenizeCard("4242 4242 4242 4242"), "tok_visa_4242_ok");
  assert.equal(tokenizeCard("4000 0000 0000 0002"), "tok_visa_0002_declined");
});
