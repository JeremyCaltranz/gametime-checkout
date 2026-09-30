import type { PlatformOverride, WalletOverride } from "../dev/overrides";
import type { CheckoutPlatform } from "../eligibility";

export const WALLET_PROBE_MS = 300;

export function effectivePlatform(os: string, override: PlatformOverride): CheckoutPlatform {
  if (override === "ios" || override === "android") return override;
  if (os === "ios" || os === "android") return os;
  return "other";
}

export function probeWallet(
  platform: CheckoutPlatform,
  wallet: WalletOverride,
): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (wallet === "no") {
        resolve(false);
        return;
      }
      resolve(platform === "ios" || platform === "android");
    }, WALLET_PROBE_MS);
  });
}
