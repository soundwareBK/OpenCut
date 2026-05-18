// Vizzy fork: rebranded from upstream OpenCut for the Advanced Mode embed.
export const SITE_URL = "https://vizzy.app";

export const SITE_INFO = {
	title: "Vizzy — Advanced Mode",
	description:
		"Timeline editor for orchestrating music-reactive videos. Cut to the beat, bind effects to the song's energy.",
	url: SITE_URL,
	openGraphImage: "/open-graph/default.jpg",
	twitterImage: "/open-graph/default.jpg",
	favicon: "/favicon.ico",
};

// Vizzy fork: prefixed with /opencut-dist for raw <img> tags that don't
// route through next/image (next/image would auto-rewrite, raw <img> not).
export const DEFAULT_LOGO_URL = "/opencut-dist/logos/opencut/svg/logo.svg";
