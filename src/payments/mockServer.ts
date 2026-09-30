import {
  DECLINE_MESSAGE,
  isPaymentMethod,
  type ApiRequest,
  type PaymentMethod,
  type PaymentRequest,
} from "./contract";

export const LEDGER_KEY = "gametime.ledger.v1";

export type PaymentScenario = "normal" | "decline" | "drop";

export type Store = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

export type HandleResult =
  | { kind: "response"; status: number; body: unknown }
  | { kind: "drop" };

type StoredPayment = {
  id: string;
  status: "succeeded" | "declined";
  amountCents: number;
  method: PaymentMethod;
  idempotencyKey: string;
  fingerprint: string;
  message?: string;
};

type Ledger = {
  seq: number;
  byKey: Record<string, StoredPayment>;
};

const EXPRESS_TOKENS = new Set(["tok_apple_pay", "tok_google_pay", "tok_affirm"]);

export function createMemoryStore(): Store {
  const values = new Map<string, string>();
  return {
    async get(key) {
      return values.get(key) ?? null;
    },
    async set(key, value) {
      values.set(key, value);
    },
    async remove(key) {
      values.delete(key);
    },
  };
}

export function createMockServer(options: {
  store: Store;
  peekScenario: () => Promise<PaymentScenario>;
  consumeScenario: () => Promise<void>;
  responseDelayMs?: number;
  dropDelayMs?: number;
  ledgerKey?: string;
}) {
  const ledgerKey = options.ledgerKey ?? LEDGER_KEY;
  const responseDelayMs = options.responseDelayMs ?? 0;
  const dropDelayMs = options.dropDelayMs ?? 0;
  const exclusive = createQueue();

  async function readLedger(): Promise<Ledger> {
    const raw = await options.store.get(ledgerKey);
    if (!raw) return { seq: 0, byKey: {} };
    try {
      const parsed = JSON.parse(raw) as Ledger;
      if (!parsed || typeof parsed.seq !== "number" || !parsed.byKey) {
        return { seq: 0, byKey: {} };
      }
      return parsed;
    } catch {
      return { seq: 0, byKey: {} };
    }
  }

  async function writeLedger(ledger: Ledger): Promise<void> {
    await options.store.set(ledgerKey, JSON.stringify(ledger));
  }

  return {
    async handle(request: ApiRequest): Promise<HandleResult> {
      const result = await exclusive(() =>
        dispatch(request, {
          readLedger,
          writeLedger,
          peekScenario: options.peekScenario,
          consumeScenario: options.consumeScenario,
          responseDelayMs,
        }),
      );
      // The ledger write is already committed. Waiting outside the lock lets a
      // relaunch or a resume GET see that charge before this response is dropped.
      if (result.kind === "drop") await sleep(dropDelayMs);
      return result;
    },
    async ledgerCount(): Promise<number> {
      const ledger = await readLedger();
      return Object.keys(ledger.byKey).length;
    },
    async clearLedger(): Promise<void> {
      await exclusive(async () => {
        await writeLedger({ seq: 0, byKey: {} });
      });
    },
  };
}

async function dispatch(
  request: ApiRequest,
  deps: {
    readLedger: () => Promise<Ledger>;
    writeLedger: (ledger: Ledger) => Promise<void>;
    peekScenario: () => Promise<PaymentScenario>;
    consumeScenario: () => Promise<void>;
    responseDelayMs: number;
  },
): Promise<HandleResult> {
  const url = new URL(request.path, "http://mock.local");
  if (url.pathname !== "/v1/payments") {
    return { kind: "response", status: 404, body: { code: "not_found" } };
  }

  if (request.method === "GET") {
    const key = url.searchParams.get("idempotencyKey");
    if (!key) return { kind: "response", status: 400, body: { code: "missing_idempotency_key" } };
    const ledger = await deps.readLedger();
    const record = ledger.byKey[key];
    if (!record) return { kind: "response", status: 404, body: { code: "not_found" } };
    return { kind: "response", status: 200, body: publicRecord(record) };
  }

  if (request.method !== "POST") {
    return { kind: "response", status: 404, body: { code: "not_found" } };
  }

  const idempotencyKey = header(request.headers, "Idempotency-Key");
  if (!idempotencyKey) {
    return { kind: "response", status: 400, body: { code: "missing_idempotency_key" } };
  }

  const body = parsePayment(request.body);
  if (!body) return { kind: "response", status: 400, body: { code: "invalid_body" } };

  const fingerprint = paymentFingerprint(body);
  const ledger = await deps.readLedger();
  const existing = ledger.byKey[idempotencyKey];
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      return { kind: "response", status: 422, body: { code: "idempotency_key_reused" } };
    }
    return storedResult(existing);
  }

  const scenario = await deps.peekScenario();
  if (scenario !== "drop") await sleep(deps.responseDelayMs);

  const status = chargeStatus(body.token, scenario);
  const seq = ledger.seq + 1;
  const record: StoredPayment = {
    id: `pay_${String(seq).padStart(4, "0")}`,
    status,
    amountCents: body.amountCents,
    method: body.method,
    idempotencyKey,
    fingerprint,
    ...(status === "declined" ? { message: DECLINE_MESSAGE } : {}),
  };
  ledger.seq = seq;
  ledger.byKey[idempotencyKey] = record;
  await deps.writeLedger(ledger);
  if (scenario !== "normal") await deps.consumeScenario();

  if (scenario === "drop") return { kind: "drop" };

  return storedResult(record);
}

function storedResult(record: StoredPayment): HandleResult {
  if (record.status === "declined") {
    return {
      kind: "response",
      status: 402,
      body: {
        status: "declined",
        code: "card_declined",
        message: record.message ?? DECLINE_MESSAGE,
      },
    };
  }
  return { kind: "response", status: 200, body: publicRecord(record) };
}

function publicRecord(record: StoredPayment) {
  return {
    id: record.id,
    status: record.status,
    amountCents: record.amountCents,
    method: record.method,
    ...(record.message ? { message: record.message } : {}),
  };
}

function chargeStatus(token: string, scenario: PaymentScenario): "succeeded" | "declined" {
  if (scenario === "decline") return "declined";
  if (scenario === "drop") return "succeeded";
  if (token.endsWith("_declined")) return "declined";
  if (token.endsWith("_ok") || EXPRESS_TOKENS.has(token)) return "succeeded";
  return "declined";
}

function parsePayment(body: unknown): PaymentRequest | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  if (
    typeof value.amountCents !== "number" ||
    !Number.isInteger(value.amountCents) ||
    value.amountCents <= 0 ||
    value.currency !== "usd" ||
    !isPaymentMethod(value.method) ||
    typeof value.token !== "string" ||
    value.token.length === 0
  ) {
    return null;
  }
  return {
    amountCents: value.amountCents,
    currency: "usd",
    method: value.method,
    token: value.token,
  };
}

function paymentFingerprint(body: PaymentRequest): string {
  return JSON.stringify({
    amountCents: body.amountCents,
    currency: body.currency,
    method: body.method,
    token: body.token,
  });
}

function header(headers: Record<string, string> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted && value.trim()) return value.trim();
  }
  return undefined;
}

function createQueue() {
  let tail = Promise.resolve();
  return function exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(task, task);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
