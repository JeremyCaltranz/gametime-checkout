export type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "unknown";

export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function detectBrand(raw: string): CardBrand {
  const digits = digitsOnly(raw);
  if (/^3[47]/.test(digits)) return "amex";
  if (digits.startsWith("4")) return "visa";
  if (isMastercard(digits)) return "mastercard";
  if (isDiscover(digits)) return "discover";
  return "unknown";
}

export function panLength(brand: CardBrand): number {
  return brand === "amex" ? 15 : 16;
}

export function cvcLength(brand: CardBrand): number {
  return brand === "amex" ? 4 : 3;
}

export function formatPan(raw: string): string {
  const digits = digitsOnly(raw);
  const brand = detectBrand(digits);
  const cut = digits.slice(0, panLength(brand));
  if (brand === "amex") {
    return [cut.slice(0, 4), cut.slice(4, 10), cut.slice(10, 15)]
      .filter((part) => part.length > 0)
      .join(" ");
  }
  return cut.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function formatExpiry(raw: string): string {
  const digits = digitsOnly(raw).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function formatCvc(raw: string, brand: CardBrand): string {
  return digitsOnly(raw).slice(0, cvcLength(brand));
}

export function luhnValid(raw: string): boolean {
  const digits = digitsOnly(raw);
  if (!/^\d+$/.test(digits) || digits.length === 0) return false;
  let sum = 0;
  let alternate = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let value = digits.charCodeAt(index) - 48;
    if (alternate) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export function isPanValid(raw: string): boolean {
  const digits = digitsOnly(raw);
  const brand = detectBrand(digits);
  if (digits.length !== panLength(brand)) return false;
  return luhnValid(digits);
}

export function isExpiryValid(raw: string, now: Date): boolean {
  const match = /^(\d{2})\/(\d{2})$/.exec(raw);
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  const firstInstantAfterExpiry = new Date(year, month, 1);
  return now.getTime() < firstInstantAfterExpiry.getTime();
}

export function isCvcValid(raw: string, brand: CardBrand): boolean {
  return new RegExp(`^\\d{${cvcLength(brand)}}$`).test(raw);
}

export function isCardValid(pan: string, expiry: string, cvc: string, now: Date): boolean {
  if (!isPanValid(pan) || !isExpiryValid(expiry, now)) return false;
  return isCvcValid(cvc, detectBrand(pan));
}

export function panError(raw: string): string | null {
  const digits = digitsOnly(raw);
  if (digits.length === 0 || isPanValid(raw)) return null;
  if (digits.length < panLength(detectBrand(digits))) return "Enter the full card number.";
  return "Card number is invalid.";
}

export function expiryError(raw: string, now: Date): string | null {
  if (raw.length === 0 || isExpiryValid(raw, now)) return null;
  const match = /^(\d{2})\/(\d{2})$/.exec(raw);
  if (!match) return "Use MM/YY.";
  const month = Number(match[1]);
  if (month < 1 || month > 12) return "Enter a valid month.";
  return "Expiration date is in the past.";
}

export function cvcError(raw: string, brand: CardBrand): string | null {
  if (raw.length === 0 || isCvcValid(raw, brand)) return null;
  return brand === "amex" ? "Enter the 4-digit code." : "Enter the 3-digit code.";
}

export function tokenizeCard(raw: string): string {
  const digits = digitsOnly(raw);
  const brand = detectBrand(digits);
  const last4 = digits.slice(-4);
  const outcome = digits === "4000000000000002" ? "declined" : "ok";
  return `tok_${brand}_${last4}_${outcome}`;
}

export function brandLabel(brand: CardBrand): string | null {
  if (brand === "visa") return "Visa";
  if (brand === "mastercard") return "Mastercard";
  if (brand === "amex") return "Amex";
  if (brand === "discover") return "Discover";
  return null;
}

function isMastercard(digits: string): boolean {
  if (/^5[1-5]/.test(digits)) return true;
  if (digits.length < 4) return false;
  const bin = Number(digits.slice(0, 4));
  return bin >= 2221 && bin <= 2720;
}

function isDiscover(digits: string): boolean {
  if (digits.startsWith("6011") || digits.startsWith("65")) return true;
  if (digits.length < 3) return false;
  const prefix = Number(digits.slice(0, 3));
  return prefix >= 644 && prefix <= 649;
}
