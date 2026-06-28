import { createHash } from "node:crypto";
import { env } from "./env";

// Privacy: we never store raw IPs. We keep a salted SHA-256 hash so the same
// respondent can be recognized within a campaign without the IP being readable.
export function hashIp(ip: string | undefined | null): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${env.IP_HASH_SALT}:${ip}`).digest("hex");
}
