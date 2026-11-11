# Clerk native Bearer verification: minimal investigation example

**Offline checks pass. The reported live iPhone/Render failure has not been reproduced in this example.**

This standalone Expo + Express example contains password sign-in, secure session
token caching, `getToken()` with no template, one HTTPS Bearer request, and one
Clerk-protected endpoint. It has no database, app screens, brand assets, account
mapping, provider integrations, or application history.

## Context and evidence limits

In the original application, an iPhone native Bearer request reached a
production Node API, but Clerk returned `unexpected-error` without verified
session claims, resulting in HTTP 401. A subsequent restricted diagnostic
classified an unrecognized `TypeError`. The unverified token issuer hostname
matched the configured instance. This does not establish a key or network cause.
No real hostname, instance identifier, user identifier, token, exception, or log
is included in this repository.

The original API reported measured Node 24.22.1 during that investigation.
The selected packages below reflect local installed evidence from the reviewed
server checkout and active mobile checkout, **not** `npm ls` from the running
hosting service. Deployed dependency output was unavailable. Backend 3.16.12 was
used in an earlier stage; this example targets the later reviewed SDK versions.

| Dependency | Pinned version |
| --- | --- |
| Node selected for comparison | 24.22.1 |
| Expo | 57.0.24 |
| React Native | 0.86.3 |
| React | 19.2.3 |
| @clerk/expo | 4.0.0 |
| @clerk/express | 2.1.86 |
| @clerk/backend (server) | 3.26.5 |
| @clerk/shared (server) | 4.43.1 |
| esbuild | 0.27.3 |

All direct versions are exact pins. `pnpm-workspace.yaml` fixes the server Clerk
dependency edges, including Backend's Shared dependency. React DOM is pinned
alongside React for Clerk's peer dependency graph; this does not claim browser
sign-in support.

Standalone validation used Node 24.22.1 and pnpm 10.26.1, a fresh folder outside
the original Git repository, an empty separate package store, a separate HOME,
and an environment without application credentials or NODE_PATH. No original
node_modules, dependency links, or package caches were copied.

The independent install initially exposed a newer transitive Expo tooling peer
requirement incompatible with the pinned expo-constants version. The example
now pins @expo/cli 57.0.26 and its @expo/router-server 57.0.10 dependency, matching
the original local tooling evidence. No native SDK or app dependency was upgraded.
Strict peer checks were kept enabled, not suppressed.

The included `pnpm-lock.yaml` records the independent install. A frozen-lockfile
reinstall, both typechecks, all 11 offline tests and the production build passed.
Dependency links and resolved paths were audited: all stayed inside the separate
example folder. The lockfile contains no original application paths, private
registry URLs, embedded credentials or local-file dependencies. Its only
workspace links are the example's own api/mobile packages.

Install scripts were disabled. The installed optional esbuild platform binary
was sufficient for the successful builds; native compilation was not tested.
The install reported the deprecated transitive crypto-js 4.2.0 package. This is
not a full vulnerability audit or a claim that all dependencies are risk-free.
None of these local checks establish remote key retrieval or reproduce the
reported live failure.

## Setup in a completely separate checkout

1. Use a separate folder on your own machine. Select Node 24.22.1 (`nvm use`
   reads `.nvmrc` if nvm is installed) and pnpm 10.26.1. At the repository root,
   run `pnpm install --frozen-lockfile --ignore-scripts --strict-peer-dependencies`.
   Use the included pnpm lockfile, not an unlocked npm install. No registry
   credentials or private package registry are required.
2. Copy `api/.env.example` to `api/.env` and `mobile/.env.example` to
   `mobile/.env`. Fill placeholders **locally**, using a Clerk Development
   instance you control, preferably a disposable support-only instance.
   Never paste credentials into an issue, README, command argument, or log.
3. Use the same instance's publishable key in both files; its secret key belongs
   only in `api/.env`. Set its exact issuer in `CLERK_EXPECTED_ISSUER`.
   The issuer is not trusted from a decoded token.
4. Keep `CLERK_PROXY_ENABLED=false`. For baseline, leave `CLERK_JWT_KEY`,
   `CLERK_API_URL`, and `CLERK_API_VERSION` entirely unset in the shell and
   service environment too. No proxy or private-key configuration is needed.
5. Configure `CLERK_AUTHORIZED_PARTIES` with your actual client-origin/verified
   `azp` allowlist, not a guessed API hostname. A native Bearer request with no
   Origin omits Clerk middleware's authorizedParties option; the protected
   handler still enforces any verified `azp` against this allowlist. Missing
   `azp` is accepted only for native Bearer requests when an allowlist is set.
   Browser requests keep Clerk's normal check. This does not bypass signature,
   session, expiry, or issuer verification.
6. Run `pnpm run typecheck`, `pnpm test`, `pnpm run build:api`, and
   `pnpm run check:public`.
7. To run **this separate reproduction API only**, use `pnpm run start:api`.
   The script sets production mode, loads `api/.env`, and runs the ESM bundle
   with source maps. A hosting service must use its private environment settings
   instead of committing `.env`. For a separate hosted instance: root build
   command `pnpm install --frozen-lockfile --ignore-scripts --strict-peer-dependencies && pnpm run build:api`,
   start `pnpm run start:api`,
   with the host's `PORT`. Do not point this at the original app's service.
8. Give the phone an HTTPS endpoint for this API using your separately approved
   hosting/tunnel setup. Set **hostname only** in mobile `EXPO_PUBLIC_DOMAIN`.
   Nothing in this package provisions hosting or a tunnel.
9. Open `mobile/` in your authorized, independent Expo development environment
   and use a compatible **SDK 57 custom development client**. No existing app
   identifier, Apple signing information, Expo account, EAS project, or native
   build is included. Choose/register any needed identifiers separately.
   Current stock Expo Go can be SDK-incompatible. Do not attach the original
   application's development server or change its launch mode.
10. Sign in with an account from the reproduction Development instance. Use
    “Call protected API.” Expected baseline is `HTTP 200`. If it returns 401,
    record only the status and locally allowlisted category, without exporting
    the Bearer token or arbitrary response data.

The password form also supports the source client's email-based client-trust
step. Other MFA factors, sign-up, password reset, SSO and OAuth are intentionally
omitted. If another factor is required, stop and coordinate a minimal supported
sign-in adjustment with Clerk; do not disable account protections to force it.

## What is preserved / simplified

- Preserved: SDK versions, secure token cache, fresh untemplated `getToken()`,
  native request without a manually added Origin, HTTPS API construction,
  production Node ESM bundling of Clerk dependencies, linked source maps,
  CommonJS compatibility banner, proxy-disabled operation, authoritative
  Clerk middleware and subsequent verified authorized-party/issuer checks.
- Simplified: a single screen and endpoint, direct fetch instead of a generated
  fetch wrapper. There are no query caches, router, cookies, browser CORS
  configuration, database checks, household ownership, identity links, or jobs.
  The original identity mapping operates after Clerk verifies a session; this
  example intentionally cannot access or change application data.
- The server uses the publishable key directly because proxying is disabled,
  rather than the original proxy-host helper. Secret-key loading is explicit.
- Omitted: Pino logging/worker build plugin and unrelated native modules. The
  bundle retains Clerk itself and the relevant ESM banner/source-map options.
  A clean result here therefore does not rule out the original application's
  broader dependency/build graph.
- No temporary verification/comparison probe, decoded-token diagnostics, raw
  exception logging, public PEM configuration, or claim response is included.
  The only response diagnostic is a fixed allowlisted reason category.
- The API does not log requests, errors, tokens, headers, keys or claims.
  Treat hosting access/debug logs as private; disable any external header/body
  capture and never attach unreviewed logs to the public repository.

## Offline checks versus an actual reproduction

Tests generate RSA keys and short-lived synthetic JWTs in memory, exercise
Clerk in the minimal API's production-shaped bundle, and use only an ephemeral
loopback HTTP server. External fetch/HTTP/TLS requests are blocked. They cover
authentication rejection, invalid/expired signatures, verified issuer and `azp`
checks, and the mobile request helper. They use a synthetic `jwtKey`, **not**
secret-key remote JWKS retrieval. No live login, iPhone build, native sign-in,
remote API, or actual network-failure reproduction is claimed.

For a true comparison, an authorized operator must run the separate app with
their own test instance, capture only safe outcome facts, and have Clerk review
any private evidence through its support channel. Do not add live keys or token
fixtures to make a public repository “reproducible.”

## Publication safeguards

1. Review every file listed in `PUBLIC-CONTENTS.txt` and the review report.
2. In a fresh folder **outside the original repository**, extract only those
   files. Do not copy `.git`, node_modules, symlinks, generated bundles, `.env`,
   caches, test output, logs, credentials, public PEM values or user data.
3. The standalone install and lockfile validation are complete. Reuse the
   included reviewed lockfile and exact package-manager/runtime versions.
   If changing any dependency or lockfile, repeat validation and content review.
4. Re-run a credential/PII review over the entire proposed file set and Git
   staging area. `.gitignore` is not proof of safe contents.
5. Only after explicit owner approval, create a **new** Git repository with one
   initial commit containing only the reviewed files. Inspect `git diff --cached`
   and `git ls-files` before pushing to a newly approved public repository.
   No original app Git history or remote settings should be copied.
6. Share the repository URL with Clerk Support. Label whether an actual native
   run reproduced 401; do not claim success/failure from synthetic tests alone.
   Do not publish private environment files, issue attachments or CI logs.
