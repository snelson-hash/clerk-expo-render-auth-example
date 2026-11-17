// No token template, manual Origin header, cookies, retries, or logging.
const responseCategories = new Set([
  "unexpected-error",
  "token-invalid-signature",
  "token-expired",
  "token-not-active-yet",
  "token-invalid",
  "token-missing",
  "token-invalid-authorized-parties",
  "jwk-remote-failed-to-load",
  "jwk-failed-to-resolve",
  "jwk-kid-mismatch",
  "jwk-local-missing",
  "authorized-party-mismatch",
  "issuer-mismatch",
  "unclassified",
]);

export type RequestObservation = {
  kind: "response" | "client-timeout" | "body-timeout" | "network-error" | "session-token-unavailable" | "no-session-token";
  timestampUtc: string | null;
  elapsedMs: number | null;
  status: number | null;
  category: string | null;
};

function safeResponseCategory(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const category = (value as { category?: unknown }).category;
  return typeof category === "string" && responseCategories.has(category)
    ? category
    : "unclassified";
}

export async function requestProtected(
  getToken: () => Promise<string | null>,
  domain: string,
  send: typeof fetch = fetch,
  timeoutMs = 15_000,
  bodyTimeoutMs = 5_000,
): Promise<RequestObservation> {
  const withoutApiRequest = (kind: "session-token-unavailable" | "no-session-token"): RequestObservation => ({
    kind,
    timestampUtc: null,
    elapsedMs: null,
    status: null,
    category: null,
  });

  let token: string | null;
  try {
    token = await getToken();
  } catch {
    return withoutApiRequest("session-token-unavailable");
  }
  if (!token) return withoutApiRequest("no-session-token");

  const controller = new AbortController();
  let fetchTimeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let fetchTimedOut = false;
  const fetchTimeoutMarker = Symbol("client-timeout");
  let response: Response;
  const result = (
    kind: RequestObservation["kind"],
    status: number | null = null,
    category: string | null = null,
  ): RequestObservation => ({
    kind,
    timestampUtc,
    elapsedMs: Math.max(0, Date.now() - startedAt),
    status,
    category,
  });
  // Capture the request timestamp immediately before invoking fetch; token
  // acquisition latency is intentionally outside this measurement.
  const startedAt = Date.now();
  const timestampUtc = new Date(startedAt).toISOString();
  try {
    const responsePromise = send(`https://${domain}/api/protected`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      fetchTimeoutHandle = setTimeout(() => {
        fetchTimedOut = true;
        controller.abort();
        reject(fetchTimeoutMarker);
      }, timeoutMs);
    });
    response = await Promise.race([responsePromise, timeoutPromise]);
  } catch {
    return result(fetchTimedOut ? "client-timeout" : "network-error");
  } finally {
    if (fetchTimeoutHandle) clearTimeout(fetchTimeoutHandle);
  }

  if (response.ok) return result("response", response.status);

  // Keep parsing an error body bounded separately: headers may have arrived,
  // so a body timeout retains the actual HTTP status.
  let bodyTimeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let bodyTimedOut = false;
  const bodyTimeoutMarker = Symbol("body-timeout");
  try {
    const bodyTimeoutPromise = new Promise<never>((_resolve, reject) => {
      bodyTimeoutHandle = setTimeout(() => {
        bodyTimedOut = true;
        controller.abort();
        reject(bodyTimeoutMarker);
      }, bodyTimeoutMs);
    });
    const body = await Promise.race([response.json(), bodyTimeoutPromise]);
    return result("response", response.status, safeResponseCategory(body));
  } catch {
    if (bodyTimedOut) return result("body-timeout", response.status);
    return result("response", response.status, "unclassified");
  } finally {
    if (bodyTimeoutHandle) clearTimeout(bodyTimeoutHandle);
  }
}

export function formatRequestObservation(observation: RequestObservation) {
  const timing = observation.timestampUtc && observation.elapsedMs !== null
    ? `${observation.elapsedMs} ms · ${observation.timestampUtc}`
    : "";
  if (observation.kind === "response") {
    const category = observation.category ? ` · ${observation.category}` : "";
    return `HTTP ${observation.status}${category} · ${timing}`;
  }
  if (observation.kind === "body-timeout") {
    return `HTTP ${observation.status} · Error body timed out · ${timing}`;
  }
  if (observation.kind === "client-timeout") {
    return `Client timeout (no HTTP response) · ${timing}`;
  }
  if (observation.kind === "network-error") {
    return `Network error (no HTTP response) · ${timing}`;
  }
  if (observation.kind === "session-token-unavailable") {
    return "Session token unavailable (no API request)";
  }
  return "No session token (no API request)";
}
