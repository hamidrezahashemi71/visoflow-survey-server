import { buildApp } from "./app";
import { prisma } from "./lib/db";
import { env } from "./lib/env";

const app = await buildApp();

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.error(err);
  await prisma.$disconnect();
  process.exit(1);
}

// Clean shutdown so the database connection pool closes properly.
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info(`Received ${signal}, shutting down...`);
  try {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => void shutdown(signal));
}
