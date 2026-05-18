"use client";

import { useEffect, useState } from "react";

/* ============================================================================
 * Vizzy fork: viewport classification for the mobile/tablet editor shells.
 *
 * Breakpoints match CapCut / InShot industry layouts:
 *   phone   < 768   → vertical stack + bottom-drawer tools
 *   tablet  < 1024  → vertical stack with wider drawers
 *   desktop ≥ 1024  → existing ResizablePanelGroup layout
 *
 * isCompact = phone || tablet; the mobile shell renders for both.
 * isTouch comes from `(pointer: coarse)` so iPad-with-keyboard still upsizes
 * hit areas alongside touch tablets — matches CapCut's behavior.
 *
 * Returns `undefined` for `size` on the first render so SSR/static-export
 * builds don't mismatch the client (Next will hydrate to the right value).
 * ========================================================================== */

export type ViewportSize = "phone" | "tablet" | "desktop";
export type ViewportOrientation = "portrait" | "landscape";

const PHONE_MAX = 767;
const TABLET_MAX = 1023;

export interface ViewportInfo {
	size: ViewportSize;
	orientation: ViewportOrientation;
	isCompact: boolean;
	isTouch: boolean;
	isPhoneLandscape: boolean;
}

function classify(width: number): ViewportSize {
	if (width <= PHONE_MAX) return "phone";
	if (width <= TABLET_MAX) return "tablet";
	return "desktop";
}

function read(): ViewportInfo {
	if (typeof window === "undefined") {
		return {
			size: "desktop",
			orientation: "landscape",
			isCompact: false,
			isTouch: false,
			isPhoneLandscape: false,
		};
	}
	const size = classify(window.innerWidth);
	const orientation: ViewportOrientation =
		window.innerWidth >= window.innerHeight ? "landscape" : "portrait";
	const isTouch =
		typeof window.matchMedia === "function" &&
		window.matchMedia("(pointer: coarse)").matches;
	return {
		size,
		orientation,
		isCompact: size !== "desktop",
		isTouch,
		isPhoneLandscape: size === "phone" && orientation === "landscape",
	};
}

export function useViewport(): ViewportInfo {
	// Start with a desktop-sized default so the desktop shell renders during
	// SSR / static prerender. The first effect tick corrects it; React's
	// reconciler swaps shells without unmounting providers underneath.
	const [info, setInfo] = useState<ViewportInfo>(() => ({
		size: "desktop",
		orientation: "landscape",
		isCompact: false,
		isTouch: false,
		isPhoneLandscape: false,
	}));

	useEffect(() => {
		const update = () => setInfo(read());
		update();

		const phoneQuery = window.matchMedia(`(max-width: ${PHONE_MAX}px)`);
		const tabletQuery = window.matchMedia(`(max-width: ${TABLET_MAX}px)`);
		const orientationQuery = window.matchMedia("(orientation: portrait)");
		const pointerQuery = window.matchMedia("(pointer: coarse)");

		phoneQuery.addEventListener("change", update);
		tabletQuery.addEventListener("change", update);
		orientationQuery.addEventListener("change", update);
		pointerQuery.addEventListener("change", update);
		window.addEventListener("resize", update);

		return () => {
			phoneQuery.removeEventListener("change", update);
			tabletQuery.removeEventListener("change", update);
			orientationQuery.removeEventListener("change", update);
			pointerQuery.removeEventListener("change", update);
			window.removeEventListener("resize", update);
		};
	}, []);

	return info;
}
