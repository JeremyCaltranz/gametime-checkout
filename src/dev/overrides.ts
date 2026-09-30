import AsyncStorage from "@react-native-async-storage/async-storage";

export type PlatformOverride = "auto" | "ios" | "android";
export type WalletOverride = "auto" | "yes" | "no";
export type NextPayment = "normal" | "decline" | "drop";

export type Overrides = {
  platform: PlatformOverride;
  wallet: WalletOverride;
  nextPayment: NextPayment;
};

export const defaultOverrides: Overrides = {
  platform: "auto",
  wallet: "auto",
  nextPayment: "normal",
};

const KEY = "gametime.overrides.v1";

export async function loadOverrides(): Promise<Overrides> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { ...defaultOverrides };
  try {
    const parsed = JSON.parse(raw) as Partial<Overrides>;
    return {
      platform: oneOf(parsed.platform, ["auto", "ios", "android"] as const, "auto"),
      wallet: oneOf(parsed.wallet, ["auto", "yes", "no"] as const, "auto"),
      nextPayment: oneOf(parsed.nextPayment, ["normal", "decline", "drop"] as const, "normal"),
    };
  } catch {
    return { ...defaultOverrides };
  }
}

export async function saveOverrides(overrides: Overrides): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(overrides));
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}
