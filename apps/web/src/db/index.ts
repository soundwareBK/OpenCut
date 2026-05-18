// Vizzy fork: the static, browser-only build doesn't ship a database.
// The Drizzle/postgres client is replaced with a Proxy that throws on
// any property access — guaranteeing a loud failure if some surviving
// code path still tries to query at runtime (none should: the API
// routes that used the real `db` have been deleted).
//
// `schema.ts` is re-exported as-is because it's pure table metadata
// (no runtime connection), and other modules may still reference its
// type exports.

const stub = new Proxy(
	{},
	{
		get(_target, prop) {
			throw new Error(
				`@/db: database is disabled in the static Vizzy build (attempted ${String(prop)})`,
			);
		},
	},
);

// Cast through unknown so callers' types still line up even though the
// runtime is intentionally inert.
export const db = stub as unknown as typeof import("./schema") &
	Record<string, never>;

export * from "./schema";
