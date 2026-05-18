import type { Metadata } from "next";
import { SITE_INFO, SITE_URL } from "@/site/brand";

export const baseMetaData: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: SITE_INFO.title,
	description: SITE_INFO.description,
	openGraph: {
		title: SITE_INFO.title,
		description: SITE_INFO.description,
		url: SITE_URL,
		siteName: SITE_INFO.title,
		locale: "en_US",
		type: "website",
		images: [
			{
				url: SITE_INFO.openGraphImage,
				width: 1200,
				height: 630,
				alt: "OpenCut Wordmark",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: SITE_INFO.title,
		description: SITE_INFO.description,
		creator: "@opencutapp",
		images: [SITE_INFO.twitterImage],
	},
	pinterest: {
		richPin: false,
	},
	robots: {
		index: true,
		follow: true,
	},
	// Vizzy fork: Next.js doesn't prefix metadata `icons` / `manifest` /
	// `msapplication-config` paths with basePath, so the `/opencut-dist`
	// prefix is hard-coded here. Otherwise these absolute paths would
	// 404 against the Vizzy host (which has no favicon at root).
	icons: {
		icon: [
			{ url: "/opencut-dist/favicon.ico" },
			{ url: "/opencut-dist/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
			{ url: "/opencut-dist/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
			{ url: "/opencut-dist/icons/favicon-96x96.png", sizes: "96x96", type: "image/png" },
		],
		apple: [
			{ url: "/opencut-dist/icons/apple-icon-57x57.png", sizes: "57x57", type: "image/png" },
			{ url: "/opencut-dist/icons/apple-icon-60x60.png", sizes: "60x60", type: "image/png" },
			{ url: "/opencut-dist/icons/apple-icon-72x72.png", sizes: "72x72", type: "image/png" },
			{ url: "/opencut-dist/icons/apple-icon-76x76.png", sizes: "76x76", type: "image/png" },
			{ url: "/opencut-dist/icons/apple-icon-114x114.png", sizes: "114x114", type: "image/png" },
			{ url: "/opencut-dist/icons/apple-icon-120x120.png", sizes: "120x120", type: "image/png" },
			{ url: "/opencut-dist/icons/apple-icon-144x144.png", sizes: "144x144", type: "image/png" },
			{ url: "/opencut-dist/icons/apple-icon-152x152.png", sizes: "152x152", type: "image/png" },
			{ url: "/opencut-dist/icons/apple-icon-180x180.png", sizes: "180x180", type: "image/png" },
		],
		shortcut: ["/opencut-dist/favicon.ico"],
	},
	appleWebApp: {
		capable: true,
		title: SITE_INFO.title,
	},
	manifest: "/opencut-dist/manifest.json",
	other: {
		"msapplication-config": "/opencut-dist/browserconfig.xml",
	},
};
