import "server-only";
import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.url(),
  API_KEY: z.string().min(16, "API_KEY must be at least 16 characters"),
  API_BASE_URL: z.url(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/**
 * Validated server environment. Read lazily so `next build` doesn't need
 * production secrets, but the first request fails loudly if any are missing.
 */
export function env(): Env {
  if (!cached) {
    const parsed = EnvSchema.safeParse({
      ...process.env,
      // On Vercel, default to the project's public production domain (set by the
      // platform). Unlike per-deployment URLs it isn't behind Deployment Protection.
      API_BASE_URL:
        process.env.API_BASE_URL ||
        (process.env.VERCEL_PROJECT_PRODUCTION_URL &&
          `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`),
    });
    if (!parsed.success) {
      const problems = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw new Error(`Invalid environment configuration: ${problems}`);
    }
    cached = parsed.data;
  }
  return cached;
}
