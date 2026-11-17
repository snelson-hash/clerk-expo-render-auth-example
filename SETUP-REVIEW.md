# Separate iPhone and Render setup proposal

**Status:** local review only. This overlay is based on public
`main` at `7127d6f12436d1d72ea0931952c611ae21a3e579`. Nothing has been pushed,
built, deployed, or added to the active Easlie workspace.

## iPhone development client

- Proposed bundle ID: `com.easlie.clerkbearerrepro`. This is a candidate, not
  checked for availability or registered with Apple. Verify it under the
  Assist Books LLC Apple Developer team before building. Do not reuse Easlie's
  app record or bundle ID.
- The Expo config already has the `clerkbearerrepro` URL scheme and includes
  `expo-dev-client`; those are retained. This overlay adds only the iOS bundle
  ID and a development distribution profile.
- `mobile/eas.json` selects an internal, physical-iPhone development client.
  `mobile/` is the Expo app root because it contains `app.json`; run any later
  Expo/EAS project or build operation with the working directory set to
  `mobile/`. This profile does not create or link an Expo project, register the
  Apple identifier, create signing credentials, or start a build. The separate
  project's Expo/EAS project ID remains unset until the owner selects or
  creates an example-only project.
- The user needs an Expo account with access to the separate example project
  and an Apple Developer team role that can register identifiers and create
  signing credentials/profiles. The owner previously reported being an Owner
  of `kelnsteffs-team`; that historical account fact does not verify current
  access or authorize reusing the existing Easlie EAS project.
- Replit's documented mobile preview is Expo Go, and its guided Launch flow is
  for App Store Connect/TestFlight distribution. This `.replit` workflow is
  an isolated Metro workflow, not a Replit-produced development-client binary.
  Replit's documented flow does not establish a supported custom development
  build path for this standalone repo. The Expo development profile is ready
  for a separate Expo Build process, but project linking, credentials, and the
  actual build must be approved and completed separately.

### Separate Replit workflow

The proposed workflow file belongs only in a newly created/imported Replit
project for this support example. It is not the workspace's `.replit` file and
has not been activated. It defines one Expo development-client Metro workflow
on port 3001; it does not start a local API or database. The workflow does not
assume Easlie's special Expo session/domain variables or a `create-launch`
command. Replit's import documentation describes the general `REPLIT_DEV_DOMAIN`
but does not promise `REPLIT_EXPO_SESSION_SECRET`,
`REPLIT_EXPO_DEV_DOMAIN`, or `create-launch` for a newly imported standalone
project.

The supported standalone fallback in this proposal is Expo CLI tunnel mode.
The example now pins the Expo-compatible `@expo/ngrok` package; the startup
script checks that tunnel support resolves and stops with an actionable error
instead of silently falling back to a phone-inaccessible localhost server. If
the tunnel cannot be used, run Metro from a machine the iPhone can reach
directly on the same LAN. Replit's documented **Open in Expo Go** preview is an
option only for Expo Go-compatible apps; it is not a replacement for the
custom development client required by this test. Replit's guided Launch flow
targets App Store Connect/TestFlight, not this local Metro development
session.

In that separate Replit project, add:

- `CLERK_PUBLISHABLE_KEY`: the example Development instance's publishable key.
  The startup script maps this to `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, which is
  embedded in the client bundle and is not a server secret.
- `EXPO_PUBLIC_DOMAIN`: only the hostname assigned to the separate Render
  service, without scheme, port, or path. The startup script fails clearly if
  either required variable is missing or the domain is not hostname-only.

The generic `REPLIT_DEV_DOMAIN` may be available, but this tunnel-based
workflow does not depend on it. No Expo session secret or Replit-specific Expo
hostname is required. The Clerk secret key is never placed in Replit's mobile
environment, the Expo bundle, this repository, or chat; it belongs only in the
Render service's private environment.

## Example-only Render service

Create this later in the Render dashboard, not in Easlie's existing service:

| Render field | Proposed value |
| --- | --- |
| Service type | Web Service |
| Repository | `snelson-hash/clerk-expo-render-auth-example` |
| Branch | `main` |
| Root directory | blank (repository root) |
| Runtime | Node |
| Node version | 24.22.1 (already pinned in `.nvmrc`; do not override) |
| Build command | `pnpm install --frozen-lockfile --ignore-scripts --strict-peer-dependencies && pnpm run build:api` |
| Start command | `pnpm run start:api` |
| Health check path | `/api/healthz` |
| Initial compute | Free, only if you approve its sleep and quota limits |

Render supplies `PORT`; do not set a fixed `PORT` environment value. The
repository has no database, so do not provision one.

Enter these values directly in the **new service's** private Environment
settings; never add them to Git or the Expo client:

| Environment name | Value source / handling |
| --- | --- |
| `CLERK_PUBLISHABLE_KEY` | Publishable key from the same Clerk Development instance used by the phone client |
| `CLERK_SECRET_KEY` | Secret key from that same Development instance; private Render setting only |
| `CLERK_EXPECTED_ISSUER` | Exact issuer URL for that Development instance |
| `CLERK_AUTHORIZED_PARTIES` | The exact approved client-origin/`azp` allowlist; do not guess or use the API host |
| `CLERK_PROXY_ENABLED` | Literal `false` |

For the baseline comparison, leave `CLERK_JWT_KEY`, `CLERK_API_URL`, and
`CLERK_API_VERSION` absent. Do not enable comparison or diagnostic settings.
Do not reuse production credentials. The `.env.example` files contain
placeholders only; do not upload `.env` files.

After the service is created, copy its generated `onrender.com` hostname into
the separate Replit project's `EXPO_PUBLIC_DOMAIN`. No custom domain or DNS
change is needed. Verify `GET /api/healthz` returns HTTP 200, then sign in only
with a test account in the matching Development instance and call
`GET /api/protected`.

For each Free-plan measurement, request `/api/healthz` first and wait for HTTP
200 before the protected call. This warms the sleeping service; record the
actual protected response separately. The route returns no Clerk data.

## Costs and account access

- Render Free Web Service: $0/month while within workspace quotas, but it
  sleeps after 15 minutes without inbound traffic and may take about a minute
  to wake. The Hobby workspace currently includes 750 free instance-hours,
  5 GB monthly bandwidth, and 500 build-pipeline minutes. Current published
  overages are $0.15/GB bandwidth and $5 per 1,000 build minutes; without a
  payment method, exhausted included usage can suspend services/builds instead
  of charging. Check the dashboard's current usage and spend controls first.
- If you later want the API always on, the current smallest paid web compute is
  listed at $7/month (512 MB). Do not select it without explicit approval.
- No Render database is needed. Expo currently lists a Free plan with 15 iOS
  builds/month; higher usage or a paid plan is optional and not approved here.
- The Apple Developer membership was previously reported active for Assist
  Books LLC. No additional membership purchase is expected if it remains
  active, but current team access and identifier availability are not verified.
- No Apple, Expo, or Render dashboard integration is available in this
  workspace. GitHub read access to the public repository was verified; the
  connected account's access to the new Render service, separate Expo project,
  and Apple identifier/signing screens still requires owner action.
- A separate Replit project/workflow would use the account's existing Replit
  plan and resource limits. Its incremental cost cannot be confirmed from this
  workspace; review Replit usage before starting it.

## Remaining owner decisions

1. Approve or replace `com.easlie.clerkbearerrepro` after checking the Apple
   Developer identifier registry.
2. Confirm you can use your Apple Developer team to register that ID and create
   an iPhone development provisioning profile.
3. Choose a separate Expo project (do not reuse `finance-project`) and confirm
   the account/team that should own it.
4. Approve creating the Render Free Web Service. It can sleep; the $7/month
   always-on option is not selected.
5. Approve creating a separate Replit project from this repository before its
   `.replit` workflow is activated.
6. Supply the Clerk Development values through the corresponding private
   dashboards only. No values are requested in chat.

## Official references

- Render Node version selection: https://render.com/docs/node-version
- Render web service creation and fields: https://render.com/docs/your-first-deploy
- Render Free limitations and quotas: https://render.com/docs/free
- Render current compute pricing: https://render.com/pricing
- Expo development-build profile: https://docs.expo.dev/build/eas-json/
- Expo physical iPhone development build prerequisites:
  https://docs.expo.dev/develop/development-builds/create-a-build/
- Replit mobile preview and publishing model:
  https://docs.replit.com/features/artifact-types/building-mobile-apps
- Replit mobile preview/testing:
  https://docs.replit.com/build/mobile-preview-testing
- Replit development URLs:
  https://docs.replit.com/core-concepts/project-editor/app-setup/development-urls
