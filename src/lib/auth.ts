import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "./env";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// onRequest hook for admin-only routes: requires `Authorization: Bearer <ADMIN_API_KEY>`.
// Uses a constant-time comparison to avoid leaking the key via timing.
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization;
  const expected = `Bearer ${env.ADMIN_API_KEY}`;
  if (!header || !safeEqual(header, expected)) {
    await reply.code(401).send({
      error: "Unauthorized",
      message: "A valid admin bearer token is required",
    });
  }
}
