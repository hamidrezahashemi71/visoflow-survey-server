// A session is considered "abandoned" (derived, never stored) when it is still
// IN_PROGRESS, has no submission, and its lastSeenAt is older than this.
export const ABANDON_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

// Body-size caps for the public ingestion endpoints.
export const TRACK_BODY_LIMIT = 64 * 1024; // 64 KB
export const SUBMIT_BODY_LIMIT = 256 * 1024; // 256 KB

// Per-IP rate limits (tight on /track, stricter on /submit).
export const TRACK_RATE_LIMIT = { max: 60, timeWindow: "1 minute" } as const;
export const SUBMIT_RATE_LIMIT = { max: 10, timeWindow: "1 minute" } as const;

// Hard cap on rows returned by the CSV export (avoids unbounded memory use).
export const CSV_EXPORT_MAX = 50_000;
