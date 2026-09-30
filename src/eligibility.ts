import type { PaymentMethod } from "./payments/contract";

export const TICKET_CENTS = 7000;
export const FEE_CENTS = 2000;
export const MAX_QUANTITY = 4;
export const AFFIRM_MINIMUM_EXCLUSIVE_CENTS = 10000;

export type CheckoutPlatform = "ios" | "android" | "other";

export function orderTotalCents(quantity: number): number {
  return TICKET_CENTS * quantity + FEE_CENTS;
}

export function formatUsd(cents: number): string {
  const dollars = Math.floor(Math.abs(cents) / 100);
  const remainder = Math.abs(cents) % 100;
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${dollars}.${remainder.toString().padStart(2, "0")}`;
}

export function getEligibleMethods(input: {
  platform: CheckoutPlatform;
  walletReady: boolean;
  totalCents: number;
}): PaymentMethod[] {
  const methods: PaymentMethod[] = [];
  if (input.platform === "ios" && input.walletReady) methods.push("apple_pay");
  if (input.platform === "android" && input.walletReady) methods.push("google_pay");
  if (input.totalCents > AFFIRM_MINIMUM_EXCLUSIVE_CENTS) methods.push("affirm");
  methods.push("card");
  return methods;
}
