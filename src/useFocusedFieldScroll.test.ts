import assert from "node:assert/strict";
import { test } from "node:test";
import { offsetToRevealForm } from "./focusedFieldScroll";

test("scrolls a covered card form fully above the keyboard when it fits", () => {
  const offset = offsetToRevealForm(0, 400, 540, 52, 500, 230);
  assert.equal(offset, 346);
});

test("leaves the offset alone when the card form is already fully visible", () => {
  assert.equal(offsetToRevealForm(346, 400, 540, 52, 500, 230), 346);
});

test("pins the focused field when the whole form is taller than the space above the keyboard", () => {
  const offset = offsetToRevealForm(0, 250, 420, 52, 400, 400);
  assert.equal(offset, 238);
});
