"use client";

// Vizzy fork: OpenCut's MobileGate uses `window.innerWidth < 1024` to
// detect mobile/iPad and prompt the user to come back on desktop. Inside
// Vizzy's Advanced Mode iframe the measurement is unreliable — during
// the iframe's initial mount the inner window can briefly report a
// narrower width than the visible overlay, and the gate never re-runs.
// Since we only mount this bundle from a desktop host, replace the gate
// with a no-op passthrough.

interface MobileGateProps {
	children: React.ReactNode;
}

export function MobileGate({ children }: MobileGateProps) {
	return <>{children}</>;
}
