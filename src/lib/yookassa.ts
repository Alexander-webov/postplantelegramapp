import 'server-only';

/**
 * YooKassa API client (https://yookassa.ru/developers/api).
 *
 * We use the Payments API — create payment, redirect user to confirmation URL,
 * receive webhook on status change, optionally fetch payment status by id.
 *
 * Auth: HTTP Basic with shop_id:secret_key.
 */

const YOOKASSA_API = 'https://api.yookassa.ru/v3';

function getAuth(): string {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) {
    throw new Error(
      'YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY не заданы в .env. См. BILLING.md'
    );
  }
  return 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64');
}

export interface CreatePaymentParams {
  amountRub: number;
  description: string;
  /** Where to redirect after the user pays (or cancels) */
  returnUrl: string;
  /** Idempotence key — UUID. Repeated calls with the same key return the same payment. */
  idempotenceKey: string;
  /** Optional metadata stored on the YooKassa payment object — gets echoed back in webhook */
  metadata?: Record<string, string>;
  /** Optional customer email — required for fiscal receipt (54-FZ) */
  customerEmail?: string;
}

export interface YooKassaPayment {
  id: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
  amount: { value: string; currency: string };
  description?: string;
  paid: boolean;
  refundable: boolean;
  created_at: string;
  confirmation?: {
    type: 'redirect';
    confirmation_url: string;
  };
  payment_method?: {
    type: string;
    id: string;
    saved: boolean;
  };
  cancellation_details?: {
    party: string;
    reason: string;
  };
  metadata?: Record<string, string>;
}

/**
 * Create a new payment. The user must be redirected to confirmation_url to pay.
 * After payment, YooKassa sends a webhook to our /api/yookassa/webhook endpoint.
 */
export async function createYooKassaPayment(
  params: CreatePaymentParams
): Promise<YooKassaPayment> {
  const body: Record<string, unknown> = {
    amount: {
      value: params.amountRub.toFixed(2),
      currency: 'RUB',
    },
    capture: true, // auto-capture once user pays — no two-step
    description: params.description,
    confirmation: {
      type: 'redirect',
      return_url: params.returnUrl,
    },
    metadata: params.metadata ?? {},
  };

  // 54-FZ requires a fiscal receipt for digital services in RU.
  // We attach a minimal receipt with the user's email.
  if (params.customerEmail) {
    body.receipt = {
      customer: { email: params.customerEmail },
      items: [
        {
          description: params.description.slice(0, 128),
          quantity: '1.00',
          amount: {
            value: params.amountRub.toFixed(2),
            currency: 'RUB',
          },
          vat_code: 1, // НДС не облагается (для УСН/самозанятого)
          payment_subject: 'service',
          payment_mode: 'full_payment',
        },
      ],
    };
  }

  const res = await fetch(`${YOOKASSA_API}/payments`, {
    method: 'POST',
    headers: {
      Authorization: getAuth(),
      'Idempotence-Key': params.idempotenceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`YooKassa createPayment ${res.status}: ${errBody}`);
  }

  return (await res.json()) as YooKassaPayment;
}

/** Fetch a payment by id — for verification / sync. */
export async function getYooKassaPayment(paymentId: string): Promise<YooKassaPayment> {
  const res = await fetch(`${YOOKASSA_API}/payments/${paymentId}`, {
    headers: { Authorization: getAuth() },
    cache: 'no-store',
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`YooKassa getPayment ${res.status}: ${errBody}`);
  }
  return (await res.json()) as YooKassaPayment;
}

/**
 * Verify that an incoming webhook request is actually from YooKassa.
 *
 * YooKassa supports two auth methods for webhooks:
 *   1. IP whitelist (185.71.76.0/27 etc.) — we'd need to read the request's IP
 *   2. HTTP Basic auth on the URL itself — we configure a username:password pair
 *      in the YooKassa dashboard, and they include it in the Authorization header.
 *
 * We use option 2 because it works behind any proxy / Vercel / Cloudflare.
 *
 * Configure in YooKassa dashboard: webhook URL like
 *   https://USER:PASS@postplan.app/api/yookassa/webhook
 * Then set WEBHOOK_BASIC_AUTH=USER:PASS in .env.
 */
export function verifyWebhookAuth(authorizationHeader: string | null): boolean {
  const expected = process.env.YOOKASSA_WEBHOOK_BASIC_AUTH;
  if (!expected) {
    // If no auth configured, refuse — fail closed.
    console.error('YOOKASSA_WEBHOOK_BASIC_AUTH not set — refusing webhook for safety');
    return false;
  }
  if (!authorizationHeader) return false;

  const expectedHeader = 'Basic ' + Buffer.from(expected).toString('base64');
  // Constant-time compare to avoid timing leaks
  if (authorizationHeader.length !== expectedHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < authorizationHeader.length; i++) {
    diff |= authorizationHeader.charCodeAt(i) ^ expectedHeader.charCodeAt(i);
  }
  return diff === 0;
}
