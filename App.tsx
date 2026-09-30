import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { CardForm } from "./src/components/CardForm";
import { AffirmSheet } from "./src/components/AffirmSheet";
import { PaymentSheet } from "./src/components/PaymentSheet";
import { DevMenu } from "./src/dev/DevMenu";
import type { Overrides } from "./src/dev/overrides";
import { FEE_CENTS, formatUsd, MAX_QUANTITY, TICKET_CENTS } from "./src/eligibility";
import type { CheckoutPhase } from "./src/machine";
import type { PaymentMethod } from "./src/payments/contract";
import { useCheckout } from "./src/useCheckout";
import { useFocusedFieldScroll } from "./src/useFocusedFieldScroll";

const EXPRESS_LABELS: Record<Exclude<PaymentMethod, "card">, string> = {
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  affirm: "Affirm",
};

export default function App() {
  return (
    <SafeAreaProvider>
      <Checkout />
    </SafeAreaProvider>
  );
}

function Checkout() {
  const checkout = useCheckout();
  const keyboard = useFocusedFieldScroll();
  const [devOpen, setDevOpen] = useState(false);
  const simulated = simulatedLabel(checkout.overrides);
  const controlsEnabled = checkout.phase === "ready";
  const showOptionsChecking =
    checkout.methodsPending && (checkout.phase === "checking" || checkout.phase === "ready");
  const expressMethods = checkout.methods.filter(
    (method): method is Exclude<PaymentMethod, "card"> => method !== "card",
  );
  const status = statusCopy(checkout.phase);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View
        ref={keyboard.viewportRef}
        style={styles.flex}
        collapsable={false}
        onLayout={keyboard.onViewportLayout}
      >
        <ScrollView
          ref={keyboard.scrollRef}
          style={styles.flex}
          keyboardShouldPersistTaps="handled"
          onScroll={keyboard.onScroll}
          scrollEventThrottle={16}
        >
          <View
            ref={keyboard.contentRef}
            collapsable={false}
            onLayout={keyboard.onContentLayout}
            style={[
              styles.content,
              keyboard.keyboardInset > 0
                ? { paddingBottom: 32 + keyboard.keyboardInset }
                : null,
            ]}
          >
          <View style={styles.header}>
            <Text style={styles.title}>Checkout</Text>
          </View>

          {simulated ? <Text style={styles.sim}>{simulated}</Text> : null}

          {checkout.phase === "succeeded" ? (
            <View style={styles.card}>
              <Text style={styles.kicker}>Payment confirmed</Text>
              <Text style={styles.total}>
                {formatUsd(checkout.chargedCents ?? checkout.totalCents)}
              </Text>
              <Text style={styles.body}>Harbor FC vs North Metro. You're in.</Text>
              {checkout.confirmationId ? (
                <Text style={styles.meta}>Reference {checkout.confirmationId}</Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={checkout.newOrder}
                style={({ pressed }) => [styles.primary, pressed ? styles.pressed : null]}
              >
                <Text style={styles.primaryText}>New order</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.event}>Harbor FC vs North Metro</Text>
                <Text style={styles.meta}>Sat, Oct 3 · 7:30 PM</Text>
                <Text style={styles.meta}>Section 112 · Row F · Seats 8–9</Text>
                <View style={styles.line} />
                <View style={styles.summaryRow}>
                  <Text style={styles.body}>
                    {checkout.quantity} × {formatUsd(TICKET_CENTS)}
                  </Text>
                  <View style={styles.stepper}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Decrease quantity"
                      disabled={!controlsEnabled || checkout.quantity <= 1}
                      onPress={() => checkout.changeQuantity(checkout.quantity - 1)}
                      style={[styles.step, !controlsEnabled ? styles.stepDisabled : null]}
                    >
                      <Text style={styles.stepText}>−</Text>
                    </Pressable>
                    <Text style={styles.quantity}>{checkout.quantity}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Increase quantity"
                      disabled={!controlsEnabled || checkout.quantity >= MAX_QUANTITY}
                      onPress={() => checkout.changeQuantity(checkout.quantity + 1)}
                      style={[styles.step, !controlsEnabled ? styles.stepDisabled : null]}
                    >
                      <Text style={styles.stepText}>+</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.body}>Fee</Text>
                  <Text style={styles.body}>{formatUsd(FEE_CENTS)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.total}>{formatUsd(checkout.totalCents)}</Text>
                </View>
              </View>

              {checkout.notice ? <Text style={styles.notice}>{checkout.notice}</Text> : null}
              {checkout.phase === "declined" && checkout.declineMessage ? (
                <View style={styles.decline}>
                  <Text style={styles.declineText}>{checkout.declineMessage}</Text>
                  <Pressable accessibilityRole="button" onPress={checkout.retry} hitSlop={8}>
                    <Text style={styles.declineAction}>Try again</Text>
                  </Pressable>
                </View>
              ) : null}
              {status ? <Text style={styles.status}>{status}</Text> : null}

              <View style={styles.methods}>
                {showOptionsChecking ? (
                  <Text style={styles.checking}>Checking payment options</Text>
                ) : (
                  expressMethods.map((method) => (
                    <Pressable
                      key={method}
                      accessibilityRole="button"
                      accessibilityLabel={`Pay with ${EXPRESS_LABELS[method]}`}
                      disabled={!controlsEnabled}
                      onPress={() => void checkout.startExpress(method)}
                      style={({ pressed }) => [
                        styles.express,
                        method === "google_pay" ? styles.expressGoogle : null,
                        !controlsEnabled ? styles.expressDisabled : null,
                        pressed && controlsEnabled ? styles.pressed : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.expressText,
                          method === "google_pay" ? styles.expressTextDark : null,
                        ]}
                      >
                        {EXPRESS_LABELS[method]}
                      </Text>
                      {method === "affirm" ? (
                        <Text style={styles.expressSub}>Pay over time</Text>
                      ) : null}
                    </Pressable>
                  ))
                )}
                <CardForm
                  disabled={!controlsEnabled}
                  payLabel={`Pay ${formatUsd(checkout.totalCents)}`}
                  onPay={(token) => void checkout.payWithCard(token)}
                  onFieldFocus={keyboard.onFieldFocus}
                />
              </View>
            </>
          )}
          {__DEV__ ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void checkout.refreshLedger();
                setDevOpen(true);
              }}
              style={styles.toolsButton}
            >
              <Text style={styles.tools}>Review tools</Text>
            </Pressable>
          ) : null}
          </View>
        </ScrollView>
      </View>

      {checkout.phase === "authorizing" && checkout.intent?.method === "affirm" ? (
        <AffirmSheet
          amountCents={checkout.intent.amountCents}
          onApprove={() => void checkout.approveExpress()}
          onCancel={() => void checkout.cancelAuthorization()}
        />
      ) : null}
      {checkout.phase === "authorizing" &&
      checkout.intent &&
      (checkout.intent.method === "apple_pay" || checkout.intent.method === "google_pay") ? (
        <PaymentSheet
          method={checkout.intent.method}
          amountCents={checkout.intent.amountCents}
          onPay={() => void checkout.approveExpress()}
          onCancel={() => void checkout.cancelAuthorization()}
        />
      ) : null}
      {__DEV__ ? (
        <DevMenu
          visible={devOpen}
          phase={checkout.phase}
          overrides={checkout.overrides}
          pendingKey={checkout.intent?.idempotencyKey ?? null}
          ledgerCount={checkout.ledgerCount}
          onClose={() => setDevOpen(false)}
          onChange={(next) => void checkout.updateOverrides(next)}
          onClearPending={() => void checkout.clearPending()}
          onClearLedger={() => void checkout.clearLedger()}
        />
      ) : null}
    </SafeAreaView>
  );
}

function statusCopy(phase: CheckoutPhase): string | null {
  if (phase === "processing") return "Processing payment";
  if (phase === "reconciling") return "Checking your payment";
  return null;
}

function simulatedLabel(overrides: Overrides): string | null {
  if (overrides.platform === "auto" && overrides.wallet === "auto") return null;
  const platform =
    overrides.platform === "auto"
      ? "this device"
      : overrides.platform === "ios"
        ? "iOS"
        : "Android";
  const wallet =
    overrides.wallet === "auto"
      ? "wallet automatic"
      : overrides.wallet === "yes"
        ? "wallet provisioned"
        : "wallet not provisioned";
  return `Simulated environment: ${platform}, ${wallet}`;
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#F3F0E8",
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 20,
    paddingBottom: 32,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    color: "#161513",
    fontSize: 28,
    fontWeight: "700",
  },
  toolsButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  tools: {
    color: "#161513",
    fontSize: 15,
    fontWeight: "600",
  },
  sim: {
    backgroundColor: "#F4E7C8",
    borderRadius: 10,
    color: "#5C4B2A",
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    gap: 8,
    padding: 16,
  },
  event: {
    color: "#161513",
    fontSize: 18,
    fontWeight: "700",
  },
  meta: {
    color: "#6B655C",
    fontSize: 14,
  },
  body: {
    color: "#161513",
    fontSize: 16,
  },
  line: {
    backgroundColor: "#E6E0D4",
    height: 1,
    marginVertical: 4,
  },
  summaryRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stepper: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  step: {
    alignItems: "center",
    borderColor: "#D9D3C7",
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  stepDisabled: {
    opacity: 0.4,
  },
  stepText: {
    color: "#161513",
    fontSize: 20,
  },
  quantity: {
    color: "#161513",
    fontSize: 16,
    fontWeight: "600",
    minWidth: 16,
    textAlign: "center",
  },
  totalLabel: {
    color: "#161513",
    fontSize: 16,
    fontWeight: "700",
  },
  total: {
    color: "#161513",
    fontSize: 28,
    fontWeight: "700",
  },
  kicker: {
    color: "#6B655C",
    fontSize: 14,
    fontWeight: "600",
  },
  notice: {
    backgroundColor: "#EFE8D6",
    borderRadius: 10,
    color: "#5C4B2A",
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  decline: {
    alignItems: "center",
    backgroundColor: "#F8E8E4",
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  declineText: {
    color: "#8C2F2F",
    flex: 1,
    fontSize: 15,
  },
  declineAction: {
    color: "#8C2F2F",
    fontSize: 15,
    fontWeight: "700",
  },
  status: {
    color: "#161513",
    fontSize: 16,
    fontWeight: "600",
  },
  methods: {
    gap: 10,
  },
  checking: {
    color: "#6B655C",
    fontSize: 15,
  },
  express: {
    backgroundColor: "#161513",
    borderRadius: 12,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  expressGoogle: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D9D3C7",
    borderWidth: 1,
  },
  expressDisabled: {
    opacity: 0.45,
  },
  expressText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  expressTextDark: {
    color: "#161513",
  },
  expressSub: {
    color: "#D9D3C7",
    fontSize: 13,
    marginTop: 2,
    textAlign: "center",
  },
  primary: {
    alignItems: "center",
    backgroundColor: "#161513",
    borderRadius: 12,
    marginTop: 8,
    minHeight: 52,
    justifyContent: "center",
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.85,
  },
});
