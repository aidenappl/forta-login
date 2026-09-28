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

Never put the email, password, Google `id_token`, `oauth_request_token`, `code`, `state` or a full
redirect URL in an event — report a host (`hostOf`) or a boolean instead.

| Event | Level | Source |
|-------|-------|--------|
| `client.error.uncaught` / `client.error.unhandled_rejection` | error | SDK window handlers |
| `client.error.boundary` / `client.error.global` | error | `app/error.tsx` / `app/global-error.tsx` |
| `api.request.server_error` / `client_error` / `network_error` | error / warn (info for 401/403 on sign-in and session calls) / error | `attachMonitor` in `monitor.service.ts` (not the SDK's `attachAxiosMonitor`): `method`, `url` (no query), `status_code`, `error`, `error_message`, numeric `error_code`, `attempts`, `duration_ms`, `request_id` (the API's `X-Request-ID` echo, else the one sent), `trace_id`. Never a body |
| `auth.refresh.failed` | info (401/403) / warn (other 4xx) / error (5xx, no response) | `doRefresh` in `api.service.ts`, once per refresh after its retry, with the refresh call's own `X-Request-ID` |
| `session.bootstrap.failed` | same mapping (`sessionFailureLevel`) | `StoreProvider` when `reqGetSelf` fails while the `forta-logged-in` marker is `1` |
| `auth.login.failed` | info (401/403) / warn (other 4xx) / error (5xx, network) | `LoginForm`: `method` (`local`/`google`), `status_code`, `error_code`, `request_id` only |
| `oauth.complete.failed` | same mapping | `LoginForm`: `status_code`, `error_code`, `request_id`, `auto` (already-signed-in auto-complete vs after sign-in) |
| `login.redirect_untrusted` | warn | A redirect target failed `isTrustedRedirect` and the default was used: `host`, `source` |
| `auth.logout.failed` | warn | `/logout` when `reqLogout` fails (local sign-out still happens) |
| `auth.oauth_logout` | info | `/oauth/logout`: `destination_host` |
| `login.google.unconfigured` | warn, once per load | No Google client id: neither a build-time `NEXT_PUBLIC_GOOGLE_CLIENT_ID` nor the container's runtime `NEXT_FORTA_PUBLIC_GOOGLE_CLIENT_ID` (served by `/api/config`, `lib/google-client-id.ts`). Only the Forta-specific runtime key is read — the plain `NEXT_PUBLIC_GOOGLE_CLIENT_ID` Keyring key is shared with another app, and a different client id makes forta-api's `idtoken.Validate` reject every Google sign-in |
| `login.google.script_failed` / `login.google.prompt_unavailable` | warn | The GSI script failed to load / the Google button was pressed with `window.google` unset |
| `client.error.caught` | error | `reportCaught(feature, err)` — an exception a handler caught; `feature` is also copied to `source_func` |
| `server.request.error` | error | `onRequestError` (Node runtime), with `release` |
| `client.page.load` / `client.navigation` | info | Path only |

Every browser event carries `route` (the pathname), `release` (`NEXT_PUBLIC_APP_VERSION`: the short
SHA CI builds with, `"dev"` locally) and `oauth_flow` (whether `oauth_request_token` is **present**
in the query — never its value), merged by `FortaMonitor.emit`. `user_id` (the numeric Forta user
id, matching forta-api's attribution) is set on bootstrap success and after sign-in, and cleared on
logout or a failed bootstrap.

**Request ids.** A request interceptor in `api.service.ts` sends `X-Request-ID` (a UUID) on every
call and keeps it on `config.meta`; `/auth/refresh` gets its own. forta-api's CORS
`AllowedHeaders` must list `X-Request-ID`, or every preflight fails and sign-in breaks — **deploy
forta-api with that header allowed before deploying this app**.

**401 handling.** A 401 from `/auth/self` or any other call triggers one shared `/auth/refresh`
(concurrent 401s share it) and a retry on the renewed cookies, with no `Authorization` header — the
refresh is cookie-based and its body has no `data.token`. A 401 from `/auth/login`, `/auth/google`,
`/auth/refresh`, `/auth/logout` or `/oauth/complete` is an answer, not an expired token, and is
returned as-is.

Tests: `npm test` (Vitest, jsdom; `src/**/*.test.ts`).
