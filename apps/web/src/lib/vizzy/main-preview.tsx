"use client";

/**
 * Full-cover Vizzy live preview that sits inside OpenCut's main PreviewPanel,
 * overlaying the rendered scene canvas. Default ON — when Advanced Mode is
 * opened, the user sees their live Basic-mode visualizer as the main preview,
 * with everything they change in Basic (scenes, filters, effects, lyrics)
 * reflecting in real time.
 *
 * Position is driven by the scene rect from usePreviewViewport() so it tracks
 * zoom/pan exactly like the underlying canvas. A toggle button in the corner
 * flips between "Live Vizzy" and "Timeline render" so the user can preview
 * their cuts/effects when needed.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePreviewViewport } from "@/preview/components/preview-viewport";

type HostVizzyApi = {
	getLivePreviewStream?: () => MediaStream | null;
	pingLivePreview?: () => void;
};

function getHostApi(): HostVizzyApi | null {
	if (typeof window === "undefined") return null;
	if (window.parent === window) return null;
	try {
		return (
			(window.parent as Window & { vizzy?: HostVizzyApi }).vizzy ?? null
		);
	} catch (_e) {
		return null;
	}
}

const STORAGE_KEY = "vizzy:main-preview:visible";

function readVisible(): boolean {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		return raw === null ? true : raw === "1";
	} catch (_e) {
		return true;
	}
}
function writeVisible(v: boolean): void {
	try {
		window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
	} catch (_e) {}
}

export function VizzyMainPreview() {
	const { sceneLeft, sceneTop, sceneWidth, sceneHeight } = usePreviewViewport();
	const videoRef = useRef<HTMLVideoElement>(null);
	const [attached, setAttached] = useState(false);
	const [visible, setVisible] = useState(true);

	// Hydrate persisted visibility AFTER first render so SSR matches.
	useLayoutEffect(() => {
		setVisible(readVisible());
	}, []);

	// Attach the host MediaStream once available. Retry briefly on iframe
	// boot races — window.parent.vizzy may not exist yet at first paint.
	useEffect(() => {
		if (!visible) return;
		let cancelled = false;
		let attempts = 0;
		let pingTimer: number | null = null;

		const tryAttach = () => {
			if (cancelled) return;
			const host = getHostApi();
			const stream = host?.getLivePreviewStream?.() ?? null;
			if (stream && videoRef.current) {
				videoRef.current.srcObject = stream;
				videoRef.current.play().catch(() => {
					/* autoplay blocked; user click resumes */
				});
				setAttached(true);
				// Keep-alive ping so the host doesn't time the composite RAF out.
				pingTimer = window.setInterval(() => {
					getHostApi()?.pingLivePreview?.();
				}, 2000);
				return;
			}
			attempts++;
			if (attempts < 40) window.setTimeout(tryAttach, 250);
		};
		tryAttach();

		return () => {
			cancelled = true;
			if (pingTimer !== null) window.clearInterval(pingTimer);
		};
	}, [visible]);

	const onToggle = () => {
		const next = !visible;
		setVisible(next);
		writeVisible(next);
	};

	// Floating toggle chip when hidden — small button in the TOP-LEFT of the
	// preview area to bring the Vizzy live feed back. Top-right is reserved
	// for the iframe-level Export button (export-button.tsx); placing chrome
	// there causes a visual collision with Export's chip.
	if (!visible) {
		return (
			<button
				type="button"
				onClick={onToggle}
				title="Show live Vizzy visualizer in preview"
				style={{
					position: "absolute",
					top: 8,
					left: 8,
					zIndex: 30,
					background: "rgba(20,20,20,0.92)",
					color: "rgba(255,255,255,0.9)",
					border: "1px solid rgba(255,255,255,0.16)",
					borderRadius: 6,
					padding: "5px 10px",
					font: "11px ui-monospace, monospace",
					letterSpacing: 0.4,
					cursor: "pointer",
					backdropFilter: "blur(8px)",
					WebkitBackdropFilter: "blur(8px)",
					display: "flex",
					alignItems: "center",
					gap: 6,
				}}
			>
				<span
					style={{
						width: 6,
						height: 6,
						borderRadius: "50%",
						background: "rgba(120,220,140,0.95)",
					}}
				/>
				LIVE VIZZY
			</button>
		);
	}

	return (
		<>
			{/* Full-cover video matching the scene rect exactly. pointer-events:none
			    so the user can still drag/select timeline elements through it
			    (the click-through area corresponds to the canvas region). */}
			<video
				ref={videoRef}
				autoPlay
				muted
				playsInline
				style={{
					position: "absolute",
					left: sceneLeft,
					top: sceneTop,
					width: sceneWidth,
					height: sceneHeight,
					objectFit: "cover",
					background: "#0a0a0a",
					zIndex: 5,
					pointerEvents: "none",
				}}
			/>
			{/* Status pill + hide button, TOP-LEFT of preview area. Export
			    button at top-right is owned by the iframe shell, so source
			    indicators live opposite. */}
			<div
				style={{
					position: "absolute",
					top: 8,
					left: 8,
					zIndex: 30,
					display: "flex",
					gap: 6,
				}}
			>
				<div
					style={{
						background: "rgba(20,20,20,0.85)",
						color: "rgba(255,255,255,0.85)",
						border: "1px solid rgba(255,255,255,0.14)",
						borderRadius: 6,
						padding: "5px 10px",
						font: "11px ui-monospace, monospace",
						letterSpacing: 0.4,
						display: "flex",
						alignItems: "center",
						gap: 6,
						backdropFilter: "blur(8px)",
						WebkitBackdropFilter: "blur(8px)",
					}}
				>
					<span
						style={{
							width: 6,
							height: 6,
							borderRadius: "50%",
							background: attached
								? "rgba(120,220,140,0.95)"
								: "rgba(255,180,80,0.9)",
						}}
					/>
					LIVE VIZZY
				</div>
				<button
					type="button"
					onClick={onToggle}
					title="Show timeline render instead of live Vizzy"
					style={{
						background: "rgba(20,20,20,0.85)",
						color: "rgba(255,255,255,0.85)",
						border: "1px solid rgba(255,255,255,0.14)",
						borderRadius: 6,
						padding: "5px 10px",
						font: "11px ui-monospace, monospace",
						letterSpacing: 0.4,
						cursor: "pointer",
						backdropFilter: "blur(8px)",
						WebkitBackdropFilter: "blur(8px)",
					}}
				>
					HIDE
				</button>
			</div>
		</>
	);
}
