"use client";

/**
 * Vizzy live-visualizer preview inside the OpenCut editor.
 *
 * Pulls a `MediaStream` of Vizzy's composite canvas from the host page
 * (`window.parent.vizzy.getLivePreviewStream()`), pipes it into a
 * `<video srcObject>`, and renders a draggable Picture-in-Picture-style
 * floating tile so the user can see the basic-mode visualizer reacting
 * while they edit clips on the timeline.
 *
 * Industry-standard PiP conventions used here:
 *   - Default bottom-right (Chrome/Firefox/Safari PiP, OBS preview)
 *   - Snap to nearest of 4 corners on drag end
 *   - Insets clear known UI chrome: 56px from top (header), 196px from
 *     bottom (timeline/toolbar), 16px horizontal
 *   - Minimized chip stays in the same corner as the panel was — never
 *     stranded mid-UI
 *   - Position, size, minimized state persisted to localStorage
 *
 * "Capture to clip": records `durationSec` seconds of the live composite
 * via host-side MediaRecorder, returns a Blob, runs it through OpenCut's
 * canonical `processMediaAssets` + `addMediaAsset` pipeline — lands in
 * the Assets panel like any drag-and-dropped clip.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useEditor } from "@/editor/use-editor";
import { processMediaAssets } from "@/media/processing";

type HostVizzyApi = {
	getLivePreviewStream?: () => MediaStream | null;
	pingLivePreview?: () => void;
	isLivePreviewActive?: () => boolean;
	captureClip?: (opts: { durationSec: number }) => Promise<{
		blobUrl: string;
		mime: string;
		durationSec: number;
	}>;
};

function getHostApi(): HostVizzyApi | null {
	if (typeof window === "undefined") return null;
	if (window.parent === window) return null;
	try {
		const api = (window.parent as Window & { vizzy?: HostVizzyApi }).vizzy;
		return api ?? null;
	} catch (_e) {
		return null;
	}
}

// Industry-standard PiP defaults. The "safe insets" keep us clear of the
// editor's known chrome regions so the panel never lands on top of the
// header, the timeline toolbar, or the timeline tracks at first paint.
//
// Top inset is small because Vizzy's unified header lives OUTSIDE the
// iframe — the iframe's coordinate origin (0,0) already sits below the
// host header, so we only need a few px of breathing room from the
// iframe edge. Top-right is reserved for the floating Export button, so
// "tr" is excluded from the corner snap targets below.
const SAFE_INSET = {
	top: 12,
	bottom: 200, // timeline toolbar + ~3 visible tracks
	left: 16,
	right: 16,
};
const DEFAULT_W = 280;
const DEFAULT_H = 158;
const MIN_W = 200;
const SNAP_THRESHOLD = 80; // distance from a corner to trigger snap

// Top-right is owned by the iframe's Export button (export-button.tsx),
// so we omit "tr" from the allowed corners. Snap + default always land
// somewhere that won't fight the Export affordance.
type Corner = "tl" | "bl" | "br";
const ALLOWED_CORNERS: Corner[] = ["tl", "bl", "br"];

type PersistedPrefs = {
	corner: Corner;
	w: number;
	h: number;
	hidden: boolean;
};

const STORAGE_KEY = "vizzy:live-preview:prefs";

function readPrefs(): PersistedPrefs | null {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as PersistedPrefs & { corner: string };
		if (
			typeof parsed.w === "number" &&
			typeof parsed.h === "number" &&
			typeof parsed.hidden === "boolean"
		) {
			// Migrate any persisted "tr" (no longer allowed — Export owns that
			// corner now) to "br" so old users don't get a stranded chip.
			const corner: Corner = ALLOWED_CORNERS.includes(parsed.corner as Corner)
				? (parsed.corner as Corner)
				: "br";
			return { ...parsed, corner };
		}
	} catch (_e) {
		/* ignore */
	}
	return null;
}

function writePrefs(prefs: PersistedPrefs) {
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
	} catch (_e) {
		/* quota / safari-private — non-fatal */
	}
}

/** Position the panel's top-left so it sits anchored to `corner` with
 *  the configured safe insets. Used both for the default and after
 *  snap-to-corner on drag end. */
function cornerToXY(corner: Corner, w: number, h: number) {
	const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
	const vh = typeof window !== "undefined" ? window.innerHeight : 800;
	switch (corner) {
		case "tl":
			return { x: SAFE_INSET.left, y: SAFE_INSET.top };
		case "bl":
			return { x: SAFE_INSET.left, y: vh - h - SAFE_INSET.bottom };
		case "br":
			return { x: vw - w - SAFE_INSET.right, y: vh - h - SAFE_INSET.bottom };
	}
}

function nearestCorner(x: number, y: number, w: number, h: number): Corner {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	// "tr" omitted on purpose — that real estate belongs to the iframe's
	// Export button, so a drag that ends near top-right snaps to "tl"
	// instead, the closest legal target.
	const corners: Array<{ c: Corner; cx: number; cy: number }> = [
		{ c: "tl", cx: SAFE_INSET.left, cy: SAFE_INSET.top },
		{ c: "bl", cx: SAFE_INSET.left, cy: vh - h - SAFE_INSET.bottom },
		{ c: "br", cx: vw - w - SAFE_INSET.right, cy: vh - h - SAFE_INSET.bottom },
	];
	let best: Corner = "br";
	let bestDist = Number.POSITIVE_INFINITY;
	for (const corner of corners) {
		const dx = corner.cx - x;
		const dy = corner.cy - y;
		const d = Math.hypot(dx, dy);
		if (d < bestDist) {
			bestDist = d;
			best = corner.c;
		}
	}
	return best;
}

export function VizzyLivePreview() {
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActive());
	const videoRef = useRef<HTMLVideoElement>(null);
	const [streamAttached, setStreamAttached] = useState(false);

	// Anchor model: we store which corner the panel is "docked" to plus a
	// size, and derive (x, y) from those. Free-form dragging temporarily
	// uses (x, y) directly until the drag ends and we snap back to a corner.
	const [corner, setCorner] = useState<Corner>("br");
	const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H });
	// Default hidden: the main preview area now shows the full Vizzy live feed
	// (VizzyMainPreview), so the corner PiP is redundant on first open. The
	// "Vizzy" chip in the corner restores it if the user wants a second view
	// alongside an active timeline-render preview.
	const [hidden, setHidden] = useState(true);
	const [freePos, setFreePos] = useState<{ x: number; y: number } | null>(null);
	const [capturing, setCapturing] = useState<null | { secLeft: number; total: number }>(null);
	const captureDurationsRef = useRef<number>(8);
	const dragRef = useRef<{
		active: boolean;
		mode: "move" | "resize";
		sx: number;
		sy: number;
		ox: number;
		oy: number;
	} | null>(null);

	// Hydrate persisted prefs on mount. useLayoutEffect so we don't flash
	// the default position before reading localStorage.
	useLayoutEffect(() => {
		const prefs = readPrefs();
		if (prefs) {
			setCorner(prefs.corner);
			setSize({ w: prefs.w, h: prefs.h });
			setHidden(prefs.hidden);
		}
	}, []);

	// Persist prefs whenever they change.
	useEffect(() => {
		writePrefs({ corner, w: size.w, h: size.h, hidden });
	}, [corner, size.w, size.h, hidden]);

	// Reposition on viewport resize so the panel stays anchored to its
	// corner instead of drifting off-screen.
	useEffect(() => {
		const onResize = () => setFreePos(null);
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	// Wire up MediaStream from host. Retry briefly if window.vizzy isn't
	// ready yet (race on iframe boot).
	useEffect(() => {
		let cancelled = false;
		let attempts = 0;
		let stopPing: number | null = null;

		const tryAttach = () => {
			if (cancelled) return;
			const host = getHostApi();
			const stream = host?.getLivePreviewStream?.() ?? null;
			if (stream && videoRef.current) {
				videoRef.current.srcObject = stream;
				videoRef.current.play().catch(() => {
					/* autoplay blocked; user can click to start */
				});
				setStreamAttached(true);
				stopPing = window.setInterval(() => {
					getHostApi()?.pingLivePreview?.();
				}, 2000);
				return;
			}
			attempts++;
			if (attempts < 20) window.setTimeout(tryAttach, 250);
		};
		tryAttach();

		return () => {
			cancelled = true;
			if (stopPing !== null) window.clearInterval(stopPing);
		};
	}, []);

	const onMoveDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			const start = cornerToXY(corner, size.w, size.h);
			const origin = freePos ?? start;
			dragRef.current = {
				active: true,
				mode: "move",
				sx: e.clientX,
				sy: e.clientY,
				ox: origin.x,
				oy: origin.y,
			};
			window.addEventListener("mousemove", onMouseMove);
			window.addEventListener("mouseup", onMouseUp);
		},
		// onMouseMove / onMouseUp are stable closures referencing the same
		// dragRef so we don't need them in deps.
		[corner, size.w, size.h, freePos],
	);

	function onResizeDown(e: React.MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragRef.current = {
			active: true,
			mode: "resize",
			sx: e.clientX,
			sy: e.clientY,
			ox: size.w,
			oy: size.h,
		};
		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mouseup", onMouseUp);
	}

	function onMouseMove(e: MouseEvent) {
		const d = dragRef.current;
		if (!d?.active) return;
		const dx = e.clientX - d.sx;
		const dy = e.clientY - d.sy;
		if (d.mode === "move") {
			setFreePos({
				x: Math.max(0, d.ox + dx),
				y: Math.max(0, d.oy + dy),
			});
		} else {
			const newW = Math.max(MIN_W, d.ox + dx);
			const newH = Math.round((newW * 9) / 16);
			setSize({ w: newW, h: newH });
		}
	}

	function onMouseUp() {
		const d = dragRef.current;
		if (!d) return;
		const wasMove = d.mode === "move";
		d.active = false;
		window.removeEventListener("mousemove", onMouseMove);
		window.removeEventListener("mouseup", onMouseUp);

		if (wasMove && freePos) {
			// Snap to nearest corner. Always snap — chrome / OBS / Resolve all
			// dock floating panels rather than leaving them mid-canvas, which
			// otherwise inevitably overlaps editor chrome.
			const next = nearestCorner(freePos.x, freePos.y, size.w, size.h);
			setCorner(next);
			setFreePos(null);
		}
	}

	async function captureToClip() {
		if (capturing) return;
		const host = getHostApi();
		if (!host?.captureClip) {
			toast.error("Vizzy capture API unavailable");
			return;
		}
		if (!activeProject) {
			toast.error("No active project");
			return;
		}
		const durationSec = captureDurationsRef.current;
		setCapturing({ secLeft: durationSec, total: durationSec });
		const t0 = performance.now();
		const tick = window.setInterval(() => {
			const elapsed = (performance.now() - t0) / 1000;
			setCapturing({ secLeft: Math.max(0, durationSec - elapsed), total: durationSec });
		}, 250);
		try {
			const { blobUrl, mime } = await host.captureClip({ durationSec });
			const resp = await fetch(blobUrl);
			const blob = await resp.blob();
			const file = new File(
				[blob],
				`vizzy-capture-${new Date().toISOString().replace(/[:.]/g, "-")}.${mime.includes("mp4") ? "mp4" : "webm"}`,
				{ type: mime },
			);
			const processed = await processMediaAssets({ files: [file], onProgress: () => {} });
			for (const asset of processed) {
				await editor.media.addMediaAsset({
					projectId: activeProject.metadata.id,
					asset,
				});
			}
			toast.success(`Captured ${durationSec}s of Vizzy visual into your assets`);
		} catch (err) {
			console.error("[vizzy-capture] failed", err);
			toast.error("Capture failed", {
				description: err instanceof Error ? err.message : "Unknown error",
			});
		} finally {
			window.clearInterval(tick);
			setCapturing(null);
		}
	}

	// Compute the panel's current position. During free drag we honor the
	// raw (x, y); otherwise we anchor to the docked corner.
	const xy = freePos ?? cornerToXY(corner, size.w, size.h);

	// Minimized chip — sits in the same corner the panel was docked to so
	// it never strands mid-UI on top of editor chrome.
	if (hidden) {
		const chipW = 84;
		const chipH = 28;
		const chipXY = cornerToXY(corner, chipW, chipH);
		return (
			<button
				type="button"
				onClick={() => setHidden(false)}
				title="Show Vizzy live preview"
				style={{
					position: "fixed",
					left: chipXY.x,
					top: chipXY.y,
					width: chipW,
					height: chipH,
					zIndex: 40,
					background: "rgba(20,20,20,0.92)",
					color: "rgba(255,255,255,0.85)",
					border: "1px solid rgba(255,255,255,0.14)",
					borderRadius: 6,
					cursor: "pointer",
					font: "11px ui-monospace, monospace",
					letterSpacing: 0.3,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					gap: 6,
					backdropFilter: "blur(8px)",
					WebkitBackdropFilter: "blur(8px)",
					boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
				}}
			>
				<span
					style={{
						width: 6,
						height: 6,
						borderRadius: "50%",
						background: streamAttached
							? "rgba(120,220,140,0.95)"
							: "rgba(255,180,80,0.9)",
					}}
				/>
				Vizzy
			</button>
		);
	}

	return (
		<div
			style={{
				position: "fixed",
				left: xy.x,
				top: xy.y,
				width: size.w,
				zIndex: 50,
				background: "rgba(10,10,10,0.96)",
				border: "1px solid rgba(255,255,255,0.14)",
				borderRadius: 8,
				overflow: "hidden",
				boxShadow: "0 10px 30px rgba(0,0,0,0.55)",
				font: "11px ui-monospace, monospace",
				color: "rgba(255,255,255,0.85)",
				userSelect: "none",
				backdropFilter: "blur(8px)",
				WebkitBackdropFilter: "blur(8px)",
				transition: freePos ? "none" : "left 0.18s ease, top 0.18s ease",
			}}
		>
			<div
				onMouseDown={onMoveDown}
				style={{
					display: "flex",
					alignItems: "center",
					gap: 8,
					padding: "5px 8px",
					background: "rgba(0,0,0,0.7)",
					borderBottom: "1px solid rgba(255,255,255,0.08)",
					cursor: "move",
					letterSpacing: 0.3,
				}}
			>
				<span
					style={{
						width: 6,
						height: 6,
						borderRadius: "50%",
						background: streamAttached
							? "rgba(120,220,140,0.95)"
							: "rgba(255,180,80,0.9)",
					}}
				/>
				<span style={{ flex: 1, opacity: 0.7 }}>
					{streamAttached ? "VIZZY LIVE" : "WAITING…"}
				</span>
				<button
					type="button"
					onClick={() => setHidden(true)}
					title="Minimize"
					style={{
						background: "transparent",
						border: 0,
						color: "rgba(255,255,255,0.5)",
						cursor: "pointer",
						padding: 0,
						font: "12px ui-monospace, monospace",
					}}
				>
					−
				</button>
			</div>
			<video
				ref={videoRef}
				autoPlay
				muted
				playsInline
				style={{
					display: "block",
					width: "100%",
					height: size.h,
					background: "#000",
					objectFit: "contain",
				}}
			/>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 6,
					padding: "5px 8px",
					background: "rgba(0,0,0,0.6)",
					borderTop: "1px solid rgba(255,255,255,0.08)",
				}}
			>
				<select
					defaultValue="8"
					onChange={(e) => {
						captureDurationsRef.current = Math.max(1, parseInt(e.target.value, 10) || 8);
					}}
					disabled={!!capturing}
					style={{
						background: "rgba(255,255,255,0.08)",
						border: "1px solid rgba(255,255,255,0.14)",
						color: "rgba(255,255,255,0.85)",
						borderRadius: 4,
						padding: "3px 6px",
						font: "10px ui-monospace, monospace",
					}}
					title="Capture length"
				>
					<option value="4">4s</option>
					<option value="8">8s</option>
					<option value="15">15s</option>
					<option value="30">30s</option>
					<option value="60">60s</option>
				</select>
				<button
					type="button"
					onClick={captureToClip}
					disabled={!streamAttached || !!capturing}
					style={{
						flex: 1,
						background: capturing
							? "rgba(220,80,80,0.85)"
							: "rgba(120,220,140,0.18)",
						border: `1px solid ${capturing ? "rgba(220,80,80,0.85)" : "rgba(120,220,140,0.4)"}`,
						color: capturing ? "#fff" : "rgba(255,255,255,0.9)",
						borderRadius: 4,
						padding: "4px 8px",
						font: "10px ui-monospace, monospace",
						letterSpacing: 0.3,
						cursor: capturing ? "default" : "pointer",
					}}
				>
					{capturing
						? `● Recording… ${capturing.secLeft.toFixed(1)}s`
						: "● Capture to clip"}
				</button>
			</div>
			<div
				onMouseDown={onResizeDown}
				title="Resize"
				style={{
					position: "absolute",
					right: 0,
					bottom: 0,
					width: 14,
					height: 14,
					cursor: "nwse-resize",
					background: "rgba(255,255,255,0.12)",
					clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
				}}
			/>
		</div>
	);
}

