<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Telemetry → Monitor

Service `forta-login`. The browser posts to this app's own `/api/monitor`
(`src/app/api/monitor/route.ts`), which checks the request is same-origin, caps it (512 KiB,
500 events), **scrubs every event** (`src/lib/monitor-scrub.ts`: query strings/fragments cut from
`url`/`path`/`from`/`href` and any `http(s)://` or `/`-prefixed string, including URLs quoted in
messages; values of `email`, `password`, `token`, `code`, `state`, `id_token`, `credential`,
`client_secret`, `redirect_uri`, `oauth_request_token` and `*_token`/`*_password`/`*_secret` keys
redacted at any depth), forces `service`, adds `MONITOR_API_KEY` and forwards. This app's URLs
carry `oauth_request_token` and `redirect_uri`, so the scrub is not optional.

Never put the email, password, `oauth_request_token`, `code`, `state` or a full
redirect URL in an event — report a host (`hostOf`) or a boolean instead.

| Event | Level | Source |
|-------|-------|--------|
| `client.error.uncaught` / `client.error.unhandled_rejection` | error | SDK window handlers |
| `client.error.boundary` / `client.error.global` | error | `app/error.tsx` / `app/global-error.tsx` |
| `api.request.server_error` / `client_error` / `network_error` | error / warn (info for 401/403 on sign-in and session calls) / error | `attachMonitor` in `monitor.service.ts` (not the SDK's `attachAxiosMonitor`): `method`, `url` (no query), `status_code`, `error`, `error_message`, numeric `error_code`, `attempts`, `duration_ms`, `request_id` (the API's `X-Request-ID` echo, else the one sent), `trace_id`. Never a body |
| `auth.refresh.failed` | info (401/403) / warn (other 4xx) / error (5xx, no response) | `doRefresh` in `api.service.ts`, once per refresh after its retry, with the refresh call's own `X-Request-ID` |
| `session.bootstrap.failed` | same mapping (`sessionFailureLevel`) | `StoreProvider` when `reqGetSelf` fails while the `forta-logged-in` marker is `1` |
| `auth.login.failed` | info (401/403) / warn (other 4xx) / error (5xx, network) | `LoginForm`: `method` (`local`), `status_code`, `error_code`, `request_id` only. Google failures are logged by forta-api, which owns that flow |
| `oauth.complete.failed` | same mapping | `LoginForm`: `status_code`, `error_code`, `request_id`, `auto` (already-signed-in auto-complete vs after sign-in) |
| `login.redirect_untrusted` | warn | A redirect target failed `isTrustedRedirect` and the default was used: `host`, `source` |
| `auth.logout.failed` | warn | `/logout` when `reqLogout` fails (local sign-out still happens) |
| `auth.oauth_logout` | info | `/oauth/logout`: `destination_host` |
| `auth.login.google_started` | info | `GoogleButton` click, before navigating to forta-api's `/auth/google/start` |
| `client.error.caught` | error | `reportCaught(feature, err)` — an exception a handler caught; `feature` is also copied to `source_func` |
| `server.request.error` | error | `onRequestError` (Node runtime), with `release` |
| `client.page.load` / `client.navigation` | info | Path only |

Every browser event carries `route` (the pathname), `release` (`NEXT_PUBLIC_APP_VERSION`: the short
SHA CI builds with, `"dev"` locally) and `oauth_flow` (whether `oauth_request_token` is **present**
in the query — never its value), merged by `FortaMonitor.emit`. `user_id` (the numeric Forta user
id, matching forta-api's attribution) is set on bootstrap success and after sign-in, and cleared on
logout or a failed bootstrap.

**Google sign-in** is a plain link into forta-api's server-side authorization-code flow
(`components/GoogleButton.tsx` → `GET <api>/auth/google/start?return_to=<this page>`). No Google
script runs on this page, so the button is ours — same size, radius and states as the rest of the
form, with Google's standard four-colour mark and light/dark button colours per its branding
guidelines. `return_to` is the current URL (minus any `google_error`), so the
`oauth_request_token` survives the round trip: after Google, forta-api sets the Forta session
cookies and redirects back here, the page loads signed in, and it completes the relying party's
authorization like any other sign-in. Failures come back as `?google_error=<code>`
(`cancelled`, `expired`, `forbidden`, `unverified_account`, `unavailable`, `failed`), shown via
`GOOGLE_ERRORS` in `LoginForm.tsx`. There is no Google client id in this app any more.

**`prompt=login`.** forta-api adds `&prompt=login` to the login URL when a relying party asked
for a fresh sign-in (OIDC `prompt=login` / `select_account`). `LoginForm` then does **not**
auto-complete for an already signed-in visitor; it shows the form. Every other authorize request
from a signed-in browser is answered by forta-api directly and never reaches this page.

**Request ids.** A request interceptor in `api.service.ts` sends `X-Request-ID` (a UUID) on every
call and keeps it on `config.meta`; `/auth/refresh` gets its own. forta-api's CORS
`AllowedHeaders` must list `X-Request-ID`, or every preflight fails and sign-in breaks — **deploy
forta-api with that header allowed before deploying this app**.

**401 handling.** A 401 from `/auth/self` or any other call triggers one shared `/auth/refresh`
(concurrent 401s share it) and a retry on the renewed cookies, with no `Authorization` header — the
refresh is cookie-based and its body has no `data.token`. A 401 from `/auth/login`,
`/auth/refresh`, `/auth/logout` or `/oauth/complete` is an answer, not an expired token, and is
returned as-is.

Tests: `npm test` (Vitest, jsdom; `src/**/*.test.ts`).
