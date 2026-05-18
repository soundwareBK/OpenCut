import type { NextConfig } from "next";
import { withContentCollections } from "@content-collections/next";

// Vizzy fork: this OpenCut tree is built as a fully static, browser-only
// bundle for embedding inside Vizzy Visualizer's Advanced Mode iframe. We
// disable the server-only paths (botid, image optimization, ratelimit,
// auth, db, analytics) so `next build` produces an `out/` directory that
// can be served as plain static files alongside Vizzy's vanilla HTML host.
const nextConfig: NextConfig = {
	compiler: {
		removeConsole: process.env.NODE_ENV === "production",
	},
	reactStrictMode: true,
	productionBrowserSourceMaps: true,

	// Static export — produces `out/` with index.html + assets. No Node server.
	output: "export",

	// Output URLs like /editor/default/index.html instead of /editor/default.
	// Lets us point an <iframe src="opencut-dist/editor/default/index.html">
	// at the editor entry directly from a plain static file server.
	trailingSlash: true,

	// Vizzy serves this bundle as a subpath alongside its own static files
	// (host index.html at /, bundle at /opencut-dist/). basePath rewrites
	// every absolute asset URL (`/_next/...`, `/manifest.json`, …) to that
	// prefix so loading the iframe at <iframe src="opencut-dist/editor/
	// default/index.html"> resolves all chunks/fonts correctly.
	basePath: "/opencut-dist",

	// Same fix for raw asset prefixes (favicons, og images, fonts in CSS)
	// that don't go through next.basePath but use `next/image` or `next/font`.
	assetPrefix: "/opencut-dist",

	// Static export doesn't run Next.js's image optimizer, so all <Image>s
	// must skip optimization and use their original URLs/paths.
	images: {
		unoptimized: true,
	},

	// Skip TypeScript and ESLint errors during the static build — we are
	// stripping a Next.js monorepo down to its editor, and stale type errors
	// in deleted-but-unreferenced files would otherwise block the build.
	typescript: {
		ignoreBuildErrors: true,
	},
	eslint: {
		ignoreDuringBuilds: true,
	},
};

export default withContentCollections(nextConfig);
