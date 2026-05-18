"use client";

/* ============================================================================
 * Vizzy mobile editor shell — CapCut-style vertical stack.
 *
 * The parent (editor-shell.tsx) already renders EditorHeader above; this
 * component owns the area below it.
 *
 *   ┌──────────────────────────────────┐
 *   │  PreviewPanel                    │  flex: mobileSplit %
 *   ├══════════════════════════════════┤  drag grip
 *   │  MobileTransportBar              │  flex 0
 *   ├──────────────────────────────────┤
 *   │  Timeline                        │  flex: 100 - mobileSplit %
 *   ├──────────────────────────────────┤
 *   │  MobileToolbar (bottom tabs)     │  flex 0 (safe area)
 *   └──────────────────────────────────┘
 *
 * AssetsDrawer + PropertiesSheet are portal-rendered Sheets so they overlay
 * the entire stack without being part of the flex calculation.
 *
 * The preview/timeline split is dragged via the transport bar acting as a
 * grip — touching it and dragging vertically reflows the two panels. Sizes
 * persist via panel-store.mobileSplit (clamped 25..75%).
 * ========================================================================== */

import { useCallback, useEffect, useRef, useState } from "react";
import { Timeline } from "@/timeline/components";
import { PreviewPanel } from "@/preview/components";
import { usePanelStore } from "@/editor/panel-store";
import type {
	PreviewOverlayControl,
	PreviewOverlayInstance,
} from "@/preview/overlays";
import { MobileTransportBar } from "./transport-bar";
import { MobileToolbar } from "./toolbar";
import { MobileAssetsDrawer } from "./assets-drawer";
import { MobilePropertiesSheet } from "./properties-sheet";
import { MobileRotationHint } from "./rotation-hint";

const MIN_PREVIEW_PCT = 25;
const MAX_PREVIEW_PCT = 75;

interface MobileEditorShellProps {
	previewProps: {
		overlayControls: PreviewOverlayControl[];
		overlayInstances: PreviewOverlayInstance[];
		onOverlayVisibilityChange: (params: {
			overlayId: string;
			isVisible: boolean;
		}) => void;
	};
}

export function MobileEditorShell({ previewProps }: MobileEditorShellProps) {
	const { panels, setPanel } = usePanelStore();
	const previewPct = clamp(panels.mobileSplit, MIN_PREVIEW_PCT, MAX_PREVIEW_PCT);

	const containerRef = useRef<HTMLDivElement>(null);
	const [isDragging, setIsDragging] = useState(false);
	const dragState = useRef<{
		startY: number;
		startPct: number;
		containerHeight: number;
	} | null>(null);

	const onPointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			// Only grip drags from the transport bar's bare strip — not from
			// the actual buttons. The grip is the 6px tall handle above it.
			if ((e.target as HTMLElement).closest("button")) return;
			const container = containerRef.current;
			if (!container) return;
			dragState.current = {
				startY: e.clientY,
				startPct: previewPct,
				containerHeight: container.getBoundingClientRect().height,
			};
			setIsDragging(true);
			(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
		},
		[previewPct],
	);

	const onPointerMove = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const state = dragState.current;
			if (!state || !isDragging) return;
			const dy = e.clientY - state.startY;
			const dPct = (dy / state.containerHeight) * 100;
			const next = clamp(
				state.startPct + dPct,
				MIN_PREVIEW_PCT,
				MAX_PREVIEW_PCT,
			);
			setPanel({ panel: "mobileSplit", size: next });
		},
		[isDragging, setPanel],
	);

	const onPointerUp = useCallback(() => {
		dragState.current = null;
		setIsDragging(false);
	}, []);

	// Prevent iOS Safari rubber-band scroll on the shell — the timeline and
	// drawers manage their own internal scrolling.
	useEffect(() => {
		const prev = document.body.style.overscrollBehavior;
		document.body.style.overscrollBehavior = "none";
		return () => {
			document.body.style.overscrollBehavior = prev;
		};
	}, []);

	return (
		<>
			<div
				ref={containerRef}
				className="flex h-full w-full flex-col overflow-hidden"
				style={{ height: "100%" }}
			>
				<div
					className="min-h-0 w-full overflow-hidden"
					style={{ flex: `${previewPct} 1 0` }}
				>
					<PreviewPanel {...previewProps} />
				</div>

				<div
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={onPointerUp}
					onPointerCancel={onPointerUp}
					className="touch-none select-none"
					style={{ cursor: isDragging ? "row-resize" : "ns-resize" }}
					aria-label="Resize preview / timeline split"
					role="separator"
				>
					<div className="flex h-1.5 items-center justify-center">
						<div className="h-0.5 w-10 rounded-full bg-muted-foreground/40" />
					</div>
					<MobileTransportBar />
				</div>

				<div
					className="min-h-0 w-full overflow-hidden"
					style={{ flex: `${100 - previewPct} 1 0` }}
				>
					<Timeline />
				</div>

				<MobileToolbar />
			</div>

			<MobileAssetsDrawer />
			<MobilePropertiesSheet />
			<MobileRotationHint />
		</>
	);
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
