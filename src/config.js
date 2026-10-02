import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  QUOTE_TTL_SECONDS: z.coerce.number().int().min(1).default(10),
  FUNDAMENTALS_TTL_SECONDS: z.coerce.number().int().min(60).default(6 * 60 * 60),
});

export function loadConfig(env = process.env) {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${problems}`);
  }

  const values = parsed.data;
  return Object.freeze({
    port: values.PORT,
    isProduction: values.NODE_ENV === 'production',
    supabase: { url: values.SUPABASE_URL, anonKey: values.SUPABASE_ANON_KEY },
    quoteTtlMs: values.QUOTE_TTL_SECONDS * 1000,
    fundamentalsTtlMs: values.FUNDAMENTALS_TTL_SECONDS * 1000,
  });
}
