// Vizzy fork: rate-limiting is a server-only concern that doesn't apply
// to the static, browser-only build. Stubbed to always allow.

export const baseRateLimit = {
	limit: async () => ({ success: true }),
};

export async function checkRateLimit(_args: { request: Request }) {
	return { success: true, limited: false };
}
