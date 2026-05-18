"use client";

/* ============================================================================
 * Vizzy mobile shell — landscape-phone rotation hint.
 *
 * The vertical-stack layout doesn't work well at 393×850 in landscape: the
 * preview ends up <150px tall and the timeline can't fit a useful number
 * of tracks. CapCut / InShot solve this with a dedicated landscape-phone
 * layout; for now we ask the user to rotate.
 *
 * Renders only when:
 *   - viewport is phone-sized AND in landscape orientation
 *   - the user hasn't dismissed it this session
 *
 * Dismissal is sessionStorage-scoped so it returns after a fresh load —
 * the hint matters enough that a per-session reminder is acceptable.
 * ========================================================================== */

import { useEffect, useState } from "react";
import { useViewport } from "@/hooks/use-viewport";

const DISMISS_KEY = "vizzy:rotation-hint:dismissed";

export function MobileRotationHint() {
	const { isPhoneLandscape } = useViewport();
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		try {
			setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
		} catch (_e) {
			/* private mode etc — start un-dismissed */
		}
	}, []);

	if (!isPhoneLandscape || dismissed) return null;

	return (
		<div
			role="alertdialog"
			aria-modal="true"
			aria-label="Rotation recommended"
			className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm p-6 text-center"
		>
			<RotateIcon />
			<h2 className="mt-4 text-lg font-semibold">Rotate to portrait</h2>
			<p className="mt-2 max-w-xs text-sm text-muted-foreground">
				The mobile editor works best in portrait. Landscape phone support
				is coming soon.
			</p>
			<button
				type="button"
				className="mt-6 rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-accent"
				onClick={() => {
					try {
						sessionStorage.setItem(DISMISS_KEY, "1");
					} catch (_e) {
						/* ignore */
					}
					setDismissed(true);
				}}
			>
				Continue anyway
			</button>
		</div>
	);
}

function RotateIcon() {
	return (
		<svg
			width="48"
			height="48"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
		>
			<rect x="5" y="3" width="14" height="18" rx="2" />
			<path d="M9 17h6" />
			<path d="M2 8 L4 6 L6 8" />
			<path d="M4 6 A6 6 0 0 1 12 6" />
		</svg>
	);
}
