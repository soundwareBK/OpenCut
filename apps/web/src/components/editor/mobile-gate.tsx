"use client";

// Vizzy fork: OpenCut's MobileGate uses `window.innerWidth < 1024` to
// prompt mobile/iPad users to come back on desktop. Vizzy now ships a
// dedicated mobile/tablet editor shell (see src/mobile/) that's chosen
// by useViewport() in editor-shell.tsx, so we never want the gate to
// block the editor. Keep as a passthrough.

interface MobileGateProps {
	children: React.ReactNode;
}

export function MobileGate({ children }: MobileGateProps) {
	return <>{children}</>;
}
