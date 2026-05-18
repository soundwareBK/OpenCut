// Vizzy fork: client-side auth is stubbed. The static, browser-only
// editor build doesn't need accounts — every visitor is treated as the
// local user. Anything calling useSession() gets a stable "signed-in"
// shape so gated UI renders without flicker.

type StubUser = { id: string; name: string; email: string };
type StubSession = { user: StubUser };

const LOCAL_USER: StubUser = {
	id: "local",
	name: "You",
	email: "local@vizzy",
};

const LOCAL_SESSION: StubSession = { user: LOCAL_USER };

export function useSession(): {
	data: StubSession | null;
	isPending: boolean;
	error: null;
} {
	return { data: LOCAL_SESSION, isPending: false, error: null };
}

export async function signIn(): Promise<{ data: StubSession; error: null }> {
	return { data: LOCAL_SESSION, error: null };
}

export async function signUp(): Promise<{ data: StubSession; error: null }> {
	return { data: LOCAL_SESSION, error: null };
}

export async function signOut(): Promise<{ error: null }> {
	return { error: null };
}
