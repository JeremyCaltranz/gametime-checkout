import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getEligibleMethods, MAX_QUANTITY, orderTotalCents } from "./eligibility";
import {
  checkoutReducer,
  initialCheckoutState,
  type CheckoutEvent,
  type PaymentIntent,
} from "./machine";
import { effectivePlatform, probeWallet } from "./payments/capabilities";
import { createPaymentsClient } from "./payments/client";
import { clearIntent, loadIntent, saveIntent } from "./payments/intent";
import { createMockServer, type Store } from "./payments/mockServer";
import type { PaymentMethod } from "./payments/contract";
import { defaultOverrides, loadOverrides, saveOverrides, type Overrides } from "./dev/overrides";

const RESPONSE_DELAY_MS = 400;
const DROP_DELAY_MS = 1600;

const storage: Store = {
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
  remove: (key) => AsyncStorage.removeItem(key),
};

let backend: ReturnType<typeof createBackend> | null = null;

function createBackend() {
  const server = createMockServer({
    store: storage,
    responseDelayMs: RESPONSE_DELAY_MS,
    dropDelayMs: DROP_DELAY_MS,
    peekScenario: async () => (await loadOverrides()).nextPayment,
    consumeScenario: async () => {
      const current = await loadOverrides();
      if (current.nextPayment === "normal") return;
      await saveOverrides({ ...current, nextPayment: "normal" });
    },
  });
  const client = createPaymentsClient(async (request) => {
    const result = await server.handle(request);
    if (result.kind === "drop") {
      throw new Error("response_dropped");
    }
    return { status: result.status, body: result.body };
  });
  return { server, client };
}

function getBackend() {
  if (!backend) backend = createBackend();
  return backend;
}

function expressToken(method: PaymentMethod): string {
  if (method === "apple_pay") return "tok_apple_pay";
  if (method === "google_pay") return "tok_google_pay";
  if (method === "affirm") return "tok_affirm";
  throw new Error("Card payments are tokenized in the form.");
}

export function useCheckout() {
  const [state, reactDispatch] = useReducer(checkoutReducer, initialCheckoutState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [overrides, setOverrides] = useState<Overrides>(defaultOverrides);
  const [quantity, setQuantity] = useState(1);
  const [walletReady, setWalletReady] = useState<boolean | null>(null);
  const [ledgerCount, setLedgerCount] = useState(0);
  const bootRef = useRef<"clear" | "reconciled" | null>(null);
  const mountedRef = useRef(true);
  const totalCents = orderTotalCents(quantity);
  const platform = effectivePlatform(Platform.OS, overrides.platform);
  const methods =
    walletReady === null ? [] : getEligibleMethods({ platform, walletReady, totalCents });
  const totalRef = useRef(totalCents);
  const methodsRef = useRef(methods);
  const walletRef = useRef(walletReady);
  totalRef.current = totalCents;
  methodsRef.current = methods;
  walletRef.current = walletReady;

  const commit = useCallback((event: CheckoutEvent) => {
    stateRef.current = checkoutReducer(stateRef.current, event);
    reactDispatch(event);
  }, []);

  const refreshLedger = useCallback(async () => {
    setLedgerCount(await getBackend().server.ledgerCount());
  }, []);

  const refreshOverrides = useCallback(async () => {
    setOverrides(await loadOverrides());
  }, []);

  const resolveLookupRef = useRef<
    (key: string, allowMissing: boolean) => Promise<void>
  >(async () => {});

  resolveLookupRef.current = async (key, allowMissing) => {
    let lookup;
    try {
      lookup = await getBackend().client.getPayment(key);
    } catch {
      return;
    }
    if (!mountedRef.current) return;
    if (stateRef.current.intent?.idempotencyKey !== key) return;
    const phase = stateRef.current.phase;
    if (phase !== "processing" && phase !== "reconciling") return;
    if (!lookup.found) {
      if (!allowMissing) return;
      await clearIntent();
      if (!mountedRef.current) return;
      commit({ type: "reconcile_missing" });
      return;
    }
    await clearIntent();
    await refreshOverrides();
    if (!mountedRef.current) return;
    if (lookup.status === "succeeded") {
      commit({ type: "payment_succeeded", id: lookup.id, amountCents: lookup.amountCents });
    } else {
      commit({
        type: "payment_declined",
        message: lookup.message ?? "Payment was declined.",
      });
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setWalletReady(null);
    void probeWallet(platform, overrides.wallet).then((ready) => {
      if (!cancelled) setWalletReady(ready);
    });
    return () => {
      cancelled = true;
    };
  }, [platform, overrides.wallet]);

  useEffect(() => {
    if (walletReady === null) return;
    if (bootRef.current === "clear" && stateRef.current.phase === "checking") {
      commit({ type: "capabilities_ready" });
    }
  }, [walletReady, commit]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [saved, intent] = await Promise.all([loadOverrides(), loadIntent()]);
      if (cancelled) return;
      setOverrides(saved);
      if (intent) {
        bootRef.current = "reconciled";
        commit({ type: "hydrate_pending", intent });
        await resolveLookupRef.current(intent.idempotencyKey, true);
        return;
      }
      bootRef.current = "clear";
      if (walletRef.current !== null && stateRef.current.phase === "checking") {
        commit({ type: "capabilities_ready" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [commit]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      // iOS reports "inactive" for a biometric prompt. Ignore it.
      // A return to "active" during processing only adopts a charge the
      // server already stored. A miss stays on processing.
      if (next !== "active") return;
      const current = stateRef.current;
      if (current.phase !== "processing" || !current.intent) return;
      void resolveLookupRef.current(current.intent.idempotencyKey, false);
    });
    return () => subscription.remove();
  }, []);

  async function submit(intent: PaymentIntent, token: string) {
    try {
      const result = await getBackend().client.postPayment(
        {
          amountCents: intent.amountCents,
          currency: "usd",
          method: intent.method,
          token,
        },
        intent.idempotencyKey,
      );
      if (!mountedRef.current) return;
      if (stateRef.current.intent?.idempotencyKey !== intent.idempotencyKey) return;
      await clearIntent();
      await refreshOverrides();
      if (!mountedRef.current) return;
      if (result.status === "succeeded") {
        commit({
          type: "payment_succeeded",
          id: result.id,
          amountCents: result.amountCents,
        });
      } else {
        commit({ type: "payment_declined", message: result.message });
      }
    } catch {
      if (!mountedRef.current) return;
      if (stateRef.current.intent?.idempotencyKey !== intent.idempotencyKey) return;
      await refreshOverrides();
      if (stateRef.current.phase === "processing") {
        commit({ type: "request_failed" });
      }
      await resolveLookupRef.current(intent.idempotencyKey, true);
    } finally {
      if (mountedRef.current) void refreshLedger();
    }
  }

  async function startExpress(method: Extract<PaymentMethod, "apple_pay" | "google_pay" | "affirm">) {
    if (stateRef.current.phase !== "ready") return;
    if (!methodsRef.current.includes(method)) return;
    const intent: PaymentIntent = {
      idempotencyKey: Crypto.randomUUID(),
      amountCents: totalRef.current,
      method,
    };
    await saveIntent(intent);
    if (stateRef.current.phase !== "ready") {
      await clearIntent();
      return;
    }
    commit({ type: "start_express", intent });
  }

  async function payWithCard(token: string) {
    if (stateRef.current.phase !== "ready") return;
    const intent: PaymentIntent = {
      idempotencyKey: Crypto.randomUUID(),
      amountCents: totalRef.current,
      method: "card",
    };
    await saveIntent(intent);
    if (stateRef.current.phase !== "ready") {
      await clearIntent();
      return;
    }
    commit({ type: "start_card", intent });
    await submit(intent, token);
  }

  async function approveExpress() {
    const current = stateRef.current;
    if (current.phase !== "authorizing" || !current.intent) return;
    const intent = current.intent;
    commit({ type: "approved" });
    await submit(intent, expressToken(intent.method));
  }

  async function cancelAuthorization() {
    if (stateRef.current.phase !== "authorizing") return;
    await clearIntent();
    commit({ type: "cancel_authorization" });
  }

  function retry() {
    if (stateRef.current.phase !== "declined") return;
    commit({ type: "retry" });
  }

  function newOrder() {
    if (stateRef.current.phase !== "succeeded") return;
    setQuantity(1);
    commit({ type: "new_order" });
  }

  function changeQuantity(next: number) {
    if (stateRef.current.phase !== "ready") return;
    if (next < 1 || next > MAX_QUANTITY) return;
    setQuantity(next);
  }

  async function updateOverrides(next: Overrides) {
    setOverrides(next);
    await saveOverrides(next);
  }

  async function clearPending() {
    await clearIntent();
    commit({ type: "dev_reset" });
  }

  async function clearLedger() {
    await getBackend().server.clearLedger();
    await refreshLedger();
  }

  return {
    phase: state.phase,
    notice: state.notice,
    declineMessage: state.declineMessage,
    confirmationId: state.confirmationId,
    chargedCents: state.chargedCents,
    intent: state.intent,
    quantity,
    totalCents,
    methods,
    methodsPending: walletReady === null,
    overrides,
    ledgerCount,
    changeQuantity,
    updateOverrides,
    startExpress,
    payWithCard,
    approveExpress,
    cancelAuthorization,
    retry,
    newOrder,
    refreshLedger,
    clearPending,
    clearLedger,
  };
}
