import fp from "fastify-plugin";

// navigator.sendBeacon often sends JSON as text/plain (string body) or
// application/octet-stream (Blob). Fastify only JSON-parses application/json by
// default, so we add parsers that JSON-parse those content types too, making the
// public /v1/track and /v1/submit endpoints beacon-tolerant.
function parseJsonBody(
  _req: unknown,
  body: string,
  done: (err: Error | null, value?: unknown) => void,
): void {
  if (!body) {
    done(null, {});
    return;
  }
  try {
    done(null, JSON.parse(body));
  } catch (err) {
    done(err as Error);
  }
}

export default fp(async (app) => {
  // Override the built-in text/plain parser (which returns the raw string).
  app.removeContentTypeParser("text/plain");
  app.addContentTypeParser("text/plain", { parseAs: "string" }, parseJsonBody);
  app.addContentTypeParser("application/octet-stream", { parseAs: "string" }, parseJsonBody);
});
