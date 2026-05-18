// Vizzy fork: server-side auth is disabled in the static browser-only
// build. The original Better Auth + Drizzle + Upstash Redis wiring is
// replaced with a stub that exposes the same surface used elsewhere in
// the source tree (just enough to satisfy imports during static export).
//
// At runtime no caller hits this — the API routes that used it have been
// deleted, and the editor itself never imports from here.

type StubHandler = (req: Request) => Promise<Response>;

const handler: StubHandler = async () =>
	new Response(
		JSON.stringify({ error: "Auth disabled in static build" }),
		{ status: 501, headers: { "content-type": "application/json" } },
	);

export const auth = {
	handler,
	api: {} as Record<string, never>,
};

export type Auth = typeof auth;
