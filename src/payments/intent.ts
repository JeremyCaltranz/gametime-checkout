import AsyncStorage from "@react-native-async-storage/async-storage";
import { isPaymentMethod, type PaymentMethod } from "./contract";
import type { PaymentIntent } from "../machine";

const KEY = "gametime.intent.v1";

export async function loadIntent(): Promise<PaymentIntent | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PaymentIntent>;
    if (
      typeof parsed.idempotencyKey !== "string" ||
      parsed.idempotencyKey.length === 0 ||
      typeof parsed.amountCents !== "number" ||
      !Number.isInteger(parsed.amountCents) ||
      !isPaymentMethod(parsed.method)
    ) {
      return null;
    }
    return {
      idempotencyKey: parsed.idempotencyKey,
      amountCents: parsed.amountCents,
      method: parsed.method,
    };
  } catch {
    return null;
  }
}

export async function saveIntent(intent: PaymentIntent): Promise<void> {
  const stored: PaymentIntent = {
    idempotencyKey: intent.idempotencyKey,
    amountCents: intent.amountCents,
    method: intent.method satisfies PaymentMethod,
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(stored));
}

export async function clearIntent(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
