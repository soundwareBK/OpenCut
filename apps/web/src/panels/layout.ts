export const PANEL_CONFIG = {
	panels: {
		tools: 25,
		preview: 50,
		properties: 25,
		mainContent: 50,
		timeline: 50,
		// Vizzy mobile shell: preview's share of the vertical stack (%). The
		// timeline takes the remainder. Persisted separately from desktop
		// sizes so a user who tunes panels on desktop doesn't see the same
		// ratio applied when they reopen on phone or tablet.
		mobileSplit: 45,
	},
} as const;
