"use client";

/**
 * Small floating panel that shows the live state of the Vizzy ↔ OpenCut
 * bridge. Used during Phase 2 to verify signals are reaching the editor
 * before the full "Vizzy Signals" panel + bindable params ship in Phase 3.
 *
 * Position: bottom-left, above the timeline. Compact so it doesn't fight
 * the existing UI. Auto-hides when the bridge isn't connected.
 */

import { requestResync, useVizzyBridge, useVizzySignal } from "./bridge";
import { useViewport } from "@/hooks/use-viewport";

export function VizzySignalIndicator() {
	// All hooks must run unconditionally on every render — React's Rules of
	// Hooks. Any early return MUST come after the last hook call below.
	const { isCompact } = useViewport();
	const connected = useVizzyBridge((s) => s.connected);
	const audioName = useVizzyBridge((s) => s.audioMedia?.name);
	const beatCount = useVizzyBridge((s) => s.beats.length);
	const dropCount = useVizzyBridge((s) => s.drops.length);
	const frameCount = useVizzyBridge((s) => s.frameCount);
	const analyzing = useVizzyBridge((s) => s.analyzing);
	const analyzeProgress = useVizzyBridge((s) => s.analyzeProgress);
	const offlineBeats = useVizzyBridge((s) => s.offline?.beats.length ?? 0);
	const offlineDrops = useVizzyBridge((s) => s.offline?.drops.length ?? 0);

	const rms = useVizzySignal("rms");
	const bass = useVizzySignal("bass");
	const kickPulse = useVizzySignal("kickPulse");

	// Mobile shell anchors a bottom tab bar at the same screen edge this
	// indicator floats above. Hide it on compact viewports — it's a dev /
	// diagnostic widget (Phase 2 of the bridge work), the real Signals
	// panel lives in the assets drawer once Phase 3 ships.
	if (isCompact) return null;

	if (!connected) {
		return (
			<div
				style={{
					position: "fixed",
					left: 12,
					bottom: 12,
					zIndex: 9999,
					background: "rgba(20,20,20,0.92)",
					color: "rgba(255,255,255,0.55)",
					padding: "6px 10px",
					borderRadius: 6,
					font: "11px ui-monospace, monospace",
					border: "1px solid rgba(255,255,255,0.08)",
					letterSpacing: 0.3,
					pointerEvents: "none",
				}}
			>
				<span style={{ color: "rgba(255,180,80,0.9)" }}>● </span>
				Vizzy bridge waiting for host…
			</div>
		);
	}

	const hasMedia = !!audioName || beatCount > 0 || frameCount > 0;

	return (
		<div
			style={{
				position: "fixed",
				left: 12,
				bottom: 12,
				zIndex: 9999,
				background: "rgba(20,20,20,0.92)",
				color: "rgba(255,255,255,0.85)",
				padding: "6px 10px",
				borderRadius: 6,
				font: "11px ui-monospace, monospace",
				border: "1px solid rgba(255,255,255,0.08)",
				display: "flex",
				gap: 12,
				alignItems: "center",
				letterSpacing: 0.3,
				// The container itself ignores pointer events so it doesn't
				// block the editor underneath; individual interactive children
				// (the Re-sync button) re-enable pointer events for themselves.
				pointerEvents: "none",
				minWidth: 220,
			}}
		>
			<span style={{ color: "rgba(120,220,140,0.95)" }}>●</span>
			<Meter label="rms" value={rms} />
			<Meter label="bass" value={bass} />
			<Meter label="kick" value={kickPulse} />
			<span style={{ opacity: 0.65 }}>
				f <b style={{ color: "rgba(255,255,255,0.9)" }}>{frameCount}</b>
			</span>
			<span style={{ opacity: 0.65 }} title="live beats">
				live <b style={{ color: "rgba(255,255,255,0.9)" }}>{beatCount}/{dropCount}</b>
			</span>
			<span
				style={{ opacity: 0.65 }}
				title="offline-analyzed beats/drops for whole track"
			>
				{analyzing
					? <>analyzing <b style={{ color: "rgba(200,180,80,0.95)" }}>{Math.round(analyzeProgress * 100)}%</b></>
					: <>offline <b style={{ color: "rgba(120,220,140,0.95)" }}>{offlineBeats}/{offlineDrops}</b></>
				}
			</span>
			{audioName ? (
				<span style={{ opacity: 0.5, marginLeft: "auto", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
					♪ {audioName}
				</span>
			) : null}
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					requestResync();
				}}
				title="Re-pull audio + clips from Vizzy"
				style={{
					marginLeft: audioName ? 8 : "auto",
					pointerEvents: "auto",
					background: "rgba(255,255,255,0.08)",
					border: "1px solid rgba(255,255,255,0.14)",
					color: "rgba(255,255,255,0.85)",
					font: "10px ui-monospace, monospace",
					padding: "3px 8px",
					borderRadius: 4,
					cursor: "pointer",
					letterSpacing: 0.3,
				}}
			>
				{hasMedia ? "Re-sync" : "Sync now"}
			</button>
		</div>
	);
}

function Meter({ label, value }: { label: string; value: number }) {
	const pct = Math.max(0, Math.min(1, value)) * 100;
	return (
		<span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
			<span style={{ opacity: 0.55, width: 26, display: "inline-block" }}>{label}</span>
			<span
				style={{
					display: "inline-block",
					width: 30,
					height: 6,
					background: "rgba(255,255,255,0.08)",
					borderRadius: 3,
					overflow: "hidden",
				}}
			>
				<span
					style={{
						display: "block",
						height: "100%",
						width: `${pct}%`,
						background: "rgba(120,220,140,0.85)",
						transition: "width 60ms linear",
					}}
				/>
			</span>
		</span>
	);
}
