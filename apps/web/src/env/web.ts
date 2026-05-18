import { z } from "zod";

// Vizzy fork: this app is built as a static, browser-only bundle. All
// server-only env vars (DATABASE_URL, BETTER_AUTH_SECRET, UPSTASH_*, etc.)
// are made optional with safe placeholder defaults so the schema doesn't
// throw at module-load time when those secrets are absent. Code paths
// that actually depend on them have been stubbed in src/auth, src/db,
// and the deleted src/app/api routes.
const webEnvSchema = z.object({
	NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
	ANALYZE: z.string().optional(),
	NEXT_RUNTIME: z.enum(["nodejs", "edge"]).optional(),

	NEXT_PUBLIC_SITE_URL: z.string().default("http://localhost:3000"),
	NEXT_PUBLIC_MARBLE_API_URL: z.string().default("http://localhost:0"),

	DATABASE_URL: z.string().default("postgres://stub:stub@localhost:0/stub"),
	BETTER_AUTH_SECRET: z.string().default("vizzy-stub-secret-not-used"),
	UPSTASH_REDIS_REST_URL: z.string().default("http://localhost:0"),
	UPSTASH_REDIS_REST_TOKEN: z.string().default("stub"),
	MARBLE_WORKSPACE_KEY: z.string().default("stub"),
	FREESOUND_CLIENT_ID: z.string().default("stub"),
	FREESOUND_API_KEY: z.string().default("stub"),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export const webEnv = webEnvSchema.parse(process.env);
