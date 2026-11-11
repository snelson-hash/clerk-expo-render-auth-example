export function nativeBearer(headers: { authorization?: string; origin?: string }) {
  // This only selects policy; it does not authenticate a request.
  return !headers.origin && /^Bearer\s+\S+$/i.test(headers.authorization ?? "");
}

export function parties(raw: string | undefined) {
  const list = [...new Set(raw?.split(",").map(s => s.trim()).filter(Boolean) ?? [])];
  return list.length ? list : undefined;
}

export function allowedParty(
  claims: Record<string, unknown> | null,
  native: boolean,
  allowed: string[] | undefined,
) {
  // Same post-verification policy as the source server.
  if (!allowed?.length) return true;
  const azp = claims?.azp;
  if (azp === undefined || azp === null) return native;
  return typeof azp === "string" && allowed.includes(azp);
}

const reasons = new Set([
  "unexpected-error", "token-invalid-signature", "token-expired",
  "token-not-active-yet", "token-invalid", "token-missing",
  "token-invalid-authorized-parties", "jwk-remote-failed-to-load",
  "jwk-failed-to-resolve", "jwk-kid-mismatch", "jwk-local-missing",
]);
export function safeReason(value: unknown) {
  return typeof value === "string" && reasons.has(value) ? value : "unclassified";
}
