/**
 * Scrubbing for browser events on their way through the /api/monitor relay.
 *
 * This app's pages are reached with credentials in the URL
 * (?oauth_request_token=…&redirect_uri=…), and a sign-in page handles emails,
 * passwords and Google id_tokens. The client never puts those in events on
 * purpose; this is the backstop for anything that slips through — an SDK
 * error whose message quotes a URL, a future event that spreads a request
 * body — applied server-side before the event leaves for Monitor.
 */

const REDACTED = "[redacted]";

/** Keys whose values are credentials or personal data, whole-key and case-insensitive. */
const SENSITIVE_KEYS = new Set([
    "email",
    "password",
    "token",
    "code",
    "state",
    "id_token",
    "credential",
    "client_secret",
    "redirect_uri",
    "oauth_request_token",
]);

/**
 * Keys ending in one of these words (access_token, new_password, …). Matched
 * by word, not substring, so status_code and error_code are kept.
 */
const SENSITIVE_SUFFIX = /(^|[_-])(email|password|token|secret|credential)s?$/i;

/** Keys whose string values are URLs or paths. */
const URL_KEYS = new Set(["url", "path", "from", "href"]);

/** An absolute URL inside free text, up to its query/fragment and the rest of that URL. */
const EMBEDDED_URL_QUERY = /(https?:\/\/[^\s?#"'<>]*)[?#][^\s"'<>]*/gi;

export const isSensitiveKey = (key: string): boolean =>
    SENSITIVE_KEYS.has(key.toLowerCase()) || SENSITIVE_SUFFIX.test(key);

const stripQuery = (s: string): string => {
    const i = s.search(/[?#]/);
    return i === -1 ? s : s.slice(0, i);
};

const scrubString = (key: string | undefined, value: string): string => {
    if (
        (key !== undefined && URL_KEYS.has(key.toLowerCase())) ||
        /^https?:\/\//i.test(value) ||
        value.startsWith("/")
    ) {
        return stripQuery(value);
    }
    // Messages and stacks that quote a URL lose its query string.
    return value.replace(EMBEDDED_URL_QUERY, "$1");
};

const scrubValue = (key: string | undefined, value: unknown): unknown => {
    if (key !== undefined && isSensitiveKey(key) && value !== null && value !== undefined && value !== "") {
        return REDACTED;
    }
    if (typeof value === "string") return scrubString(key, value);
    if (Array.isArray(value)) return value.map((v) => scrubValue(undefined, v));
    if (typeof value === "object" && value !== null) {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) out[k] = scrubValue(k, v);
        return out;
    }
    return value;
};

/**
 * One event with every URL- or path-like string cut at its query/fragment and
 * every sensitive key's value replaced by "[redacted]", at any depth. The
 * event's own envelope fields (name, level, ids, timestamp) are plain values
 * none of this touches.
 */
export const scrubEvent = (event: Record<string, unknown>): Record<string, unknown> =>
    scrubValue(undefined, event) as Record<string, unknown>;
