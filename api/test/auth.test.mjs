import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { build } from "esbuild";
import { options } from "../build.mjs";

// Generated on every run, in memory only. No live credentials or tokens.
const issuer = "https://clerk.repro.invalid";
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
const env = {
  NODE_ENV: "production",
  CLERK_PROXY_ENABLED: "false",
  CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from("clerk.repro.invalid$").toString("base64")}`,
  CLERK_SECRET_KEY: `sk_test_${Buffer.from("synthetic-test-only").toString("base64")}`,
  CLERK_JWT_KEY: keys.publicKey.export({ type: "spki", format: "pem" }).toString(),
  CLERK_EXPECTED_ISSUER: issuer,
  CLERK_AUTHORIZED_PARTIES: "https://client.repro.invalid",
};
const realFetch = globalThis.fetch;
const realHttpRequest = http.request;
const realHttpsRequest = https.request;
const realConnect = net.Socket.prototype.connect;
const realTlsConnect = tls.connect;
let externalAttempts = 0;
let temp, server, createApp, policy, requestProtected, formatRequestObservation;

function blocked() {
  externalAttempts++;
  throw new Error("External transport blocked by offline test");
}
function jwt(extra = {}, key = keys.privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const body = `${encode({ alg: "RS256", typ: "JWT", kid: "synthetic" })}.${encode({
    iss: issuer, sub: "user_synthetic", sid: "sess_synthetic",
    iat: now - 5, nbf: now - 5, exp: now + 300, ...extra,
  })}`;
  return `${body}.${sign("RSA-SHA256", Buffer.from(body), key).toString("base64url")}`;
}
async function request(token, origin, path = "/api/protected") {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (origin) headers.origin = origin;
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1", port: server.address().port,
      path, headers,
    }, res => {
      let body = "";
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on("error", reject);
    req.end();
  });
}
before(async () => {
  // SDK network access is forbidden. Only the local, ephemeral test server is allowed.
  globalThis.fetch = blocked;
  https.request = blocked;
  tls.connect = blocked;
  net.Socket.prototype.connect = function (...args) {
    const first = Array.isArray(args[0]) ? args[0][0] : args[0];
    const host = typeof first === "object" ? first?.host : args[1];
    if (host !== "127.0.0.1") return blocked();
    return realConnect.apply(this, args);
  };
  http.request = function (config, ...rest) {
    if (config?.hostname !== "127.0.0.1") return blocked();
    return realHttpRequest.call(this, config, ...rest);
  };
  temp = await mkdtemp(join(tmpdir(), "clerk-public-repro-test-"));
  async function load(entry, name) {
    const outfile = join(temp, `${name}.mjs`);
    await build({ ...options, entryPoints: [entry], outfile, logLevel: "silent" });
    return import(pathToFileURL(outfile).href);
  }
  ({ createApp } = await load("src/app.ts", "production-shaped-app"));
  policy = await load("src/policy.ts", "policy");
  ({ requestProtected, formatRequestObservation } = await load("../mobile/request.ts", "mobile-request"));
  server = createApp(env).listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  globalThis.fetch = realFetch;
  http.request = realHttpRequest;
  https.request = realHttpsRequest;
  net.Socket.prototype.connect = realConnect;
  tls.connect = realTlsConnect;
  if (temp) await rm(temp, { recursive: true, force: true });
});

test("no token cannot access the protected handler", async () => {
  assert.equal((await request()).status, 401);
});
test("health endpoint is unauthenticated and suitable for service warm-up", async () => {
  assert.deepEqual(await request(null, null, "/api/healthz"), {
    status: 200,
    body: { ok: true },
  });
});
test("valid synthetic native session reaches the protected endpoint without azp", async () => {
  assert.deepEqual(await request(jwt()), { status: 200, body: { ok: true } });
});
test("invalid signature cannot access the protected handler", async () => {
  assert.equal((await request(jwt({}, other.privateKey))).status, 401);
});
test("expired synthetic session cannot access the protected handler", async () => {
  assert.equal((await request(jwt({ exp: Math.floor(Date.now() / 1000) - 60 }))).status, 401);
});
test("native verified azp must match the allowlist", async () => {
  assert.equal((await request(jwt({ azp: "https://other.repro.invalid" }))).status, 401);
  assert.equal((await request(jwt({ azp: "https://client.repro.invalid" }))).status, 200);
});
test("verified issuer mismatch remains rejected", async () => {
  assert.equal((await request(jwt({ iss: "https://other.repro.invalid" }))).status, 401);
});
test("missing azp is not allowed through post-verification browser policy", () => {
  assert.equal(policy.allowedParty({}, false, ["https://client.repro.invalid"]), false);
  assert.equal(policy.nativeBearer({ origin: "https://client.repro.invalid", authorization: "Bearer synthetic" }), false);
});
test("non-allowlisted SDK categories collapse to a fixed fallback", () => {
  assert.equal(policy.safeReason("unexpected-error"), "unexpected-error");
  assert.equal(policy.safeReason("arbitrary-sensitive-diagnostic"), "unclassified");
  assert.equal(policy.safeReason({ reason: "unexpected-error" }), "unclassified");
});
test("mobile obtains a fresh token per request and attaches Bearer without Origin", async () => {
  let gets = 0, sends = 0;
  const getToken = async () => { gets++; return "synthetic-not-a-real-session"; };
  const send = async (url, options) => {
    sends++;
    assert.equal(url, "https://api.repro.invalid/api/protected");
    assert.equal(options.headers.Authorization, "Bearer synthetic-not-a-real-session");
    assert.equal(options.headers.Origin, undefined);
    return {
      status: 401,
      ok: false,
      json: async () => ({ category: "token-invalid-signature" }),
    };
  };
  const observation = await requestProtected(getToken, "api.repro.invalid", send);
  assert.equal(observation.kind, "response");
  assert.equal(observation.status, 401);
  assert.equal(observation.category, "token-invalid-signature");
  assert.match(observation.timestampUtc, /^\d{4}-\d{2}-\d{2}T.*Z$/);
  assert.equal(Number.isFinite(observation.elapsedMs), true);
  assert.match(formatRequestObservation(observation), /^HTTP 401 · token-invalid-signature · \d+ ms · .*Z$/);
  assert.equal((await requestProtected(getToken, "api.repro.invalid", send)).status, 401);
  assert.equal(gets, 2);
  assert.equal(sends, 2);
});
test("unknown response categories are reduced to a fixed fallback", async () => {
  const observation = await requestProtected(async () => "synthetic", "api.repro.invalid", async () => ({
    status: 401,
    ok: false,
    json: async () => ({
      category: "private-arbitrary-value",
      message: "must never be displayed",
      userId: "synthetic-user",
    }),
  }));
  assert.equal(observation.kind, "response");
  assert.equal(observation.status, 401);
  assert.equal(observation.category, "unclassified");
  const display = formatRequestObservation(observation);
  assert.match(display, /^HTTP 401 · unclassified · /);
  assert.equal(display.includes("private-arbitrary-value"), false);
  assert.equal(display.includes("must never be displayed"), false);
  assert.equal(display.includes("synthetic-user"), false);
});
test("malformed error bodies produce only the fixed fallback category", async () => {
  const observation = await requestProtected(async () => "synthetic", "api.repro.invalid", async () => ({
    status: 502,
    ok: false,
    json: async () => { throw new Error("Sensitive parser detail"); },
  }));
  assert.equal(observation.kind, "response");
  assert.equal(observation.status, 502);
  assert.equal(observation.category, "unclassified");
  assert.equal(formatRequestObservation(observation).includes("Sensitive parser detail"), false);
});
test("a stalled error body retains its received HTTP status", async () => {
  const observation = await requestProtected(
    async () => "synthetic",
    "api.repro.invalid",
    (_url, options) => Promise.resolve({
      status: 401,
      ok: false,
      json: () => new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(new Error("body aborted")));
      }),
    }),
    100,
    5,
  );
  assert.equal(observation.kind, "body-timeout");
  assert.equal(observation.status, 401);
  assert.equal(observation.category, null);
  assert.match(formatRequestObservation(observation), /^HTTP 401 · Error body timed out · \d+ ms · .*Z$/);
  assert.equal(formatRequestObservation(observation).includes("no HTTP response"), false);
});
test("client timeout is distinguishable from an HTTP server response", async () => {
  const observation = await requestProtected(
    async () => "synthetic",
    "api.repro.invalid",
    (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")));
    }),
    5,
  );
  assert.equal(observation.kind, "client-timeout");
  assert.equal(observation.status, null);
  assert.equal(observation.category, null);
});
test("mobile does not send when token is missing; network errors stay generic", async () => {
  const missing = await requestProtected(async () => null, "api.repro.invalid", blocked);
  assert.equal(missing.kind, "no-session-token");
  assert.equal(missing.status, null);
  assert.equal(missing.timestampUtc, null);
  assert.equal(missing.elapsedMs, null);
  const unavailable = await requestProtected(async () => {
    throw new Error("Sensitive token acquisition details");
  }, "api.repro.invalid", blocked);
  assert.equal(unavailable.kind, "session-token-unavailable");
  assert.equal(unavailable.status, null);
  assert.equal(unavailable.timestampUtc, null);
  const failed = await requestProtected(async () => "synthetic", "api.repro.invalid", async () => {
    throw new Error("Synthetic sensitive text must not reach the screen");
  });
  assert.equal(failed.kind, "network-error");
  assert.equal(failed.status, null);
});
test("API timing starts immediately before fetch after delayed token acquisition", async () => {
  const tokenDelayMs = 250;
  let tokenReadyAt;
  let fetchStartedAt;
  const observation = await requestProtected(async () => {
    await new Promise(resolve => setTimeout(resolve, tokenDelayMs));
    tokenReadyAt = Date.now();
    return "synthetic";
  }, "api.repro.invalid", async () => {
    fetchStartedAt = Date.now();
    await new Promise(resolve => setTimeout(resolve, 15));
    return { status: 200, ok: true };
  });
  assert.ok(fetchStartedAt >= tokenReadyAt);
  assert.equal(observation.kind, "response");
  const timestampAt = Date.parse(observation.timestampUtc);
  assert.ok(timestampAt <= fetchStartedAt);
  assert.ok(fetchStartedAt - timestampAt < 50);
  assert.ok(observation.elapsedMs < tokenDelayMs);
});
test("offline checks performed no external requests", () => {
  assert.equal(externalAttempts, 0);
});
