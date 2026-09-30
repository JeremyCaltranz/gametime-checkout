import { useRef } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatUsd } from "../eligibility";
import type { PaymentMethod } from "../payments/contract";

const TITLES: Record<"apple_pay" | "google_pay", string> = {
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
};

export function PaymentSheet({
  method,
  amountCents,
  onPay,
  onCancel,
}: {
  method: Extract<PaymentMethod, "apple_pay" | "google_pay">;
  amountCents: number;
  onPay: () => void;
  onCancel: () => void;
}) {
  const settled = useRef(false);
  const insets = useSafeAreaInsets();

  function finish(action: "pay" | "cancel") {
    if (settled.current) return;
    settled.current = true;
    if (action === "pay") onPay();
    else onCancel();
  }

  return (
    <Modal
      transparent
      animationType="fade"
      statusBarTranslucent
      visible
      onRequestClose={() => finish("cancel")}
    >
      <View style={[styles.backdrop, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.sheet}>
          <Text style={styles.kicker}>{TITLES[method]}</Text>
          <Text style={styles.amount}>{formatUsd(amountCents)}</Text>
          <Text style={styles.copy}>
            Simulated wallet sheet. Pay confirms this purchase. Cancel returns to checkout with
            no charge.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => finish("pay")}
            style={({ pressed }) => [styles.primary, pressed ? styles.pressed : null]}
          >
            <Text style={styles.primaryText}>Pay</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => finish("cancel")}
            style={({ pressed }) => [styles.secondary, pressed ? styles.pressed : null]}
          >
            <Text style={styles.secondaryText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(22, 21, 19, 0.45)",
    flex: 1,
    justifyContent: "flex-end",
    padding: 16,
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    gap: 12,
    padding: 20,
  },
  kicker: {
    color: "#6B655C",
    fontSize: 14,
    fontWeight: "600",
  },
  amount: {
    color: "#161513",
    fontSize: 32,
    fontWeight: "700",
  },
  copy: {
    color: "#5C564E",
    fontSize: 15,
    lineHeight: 21,
  },
  primary: {
    alignItems: "center",
    backgroundColor: "#161513",
    borderRadius: 12,
    minHeight: 52,
    justifyContent: "center",
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  secondary: {
    alignItems: "center",
    borderColor: "#D9D3C7",
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 52,
    justifyContent: "center",
  },
  secondaryText: {
    color: "#161513",
    fontSize: 17,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.85,
  },
});
