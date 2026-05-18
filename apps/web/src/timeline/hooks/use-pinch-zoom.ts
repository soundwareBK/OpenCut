"use client";

/* ============================================================================
 * Vizzy mobile shell — two-finger pinch zoom on the timeline.
 *
 * Attaches pointer-event listeners to a scroll container. Tracks active
 * pointers in a Map; when exactly two are down, computes the initial pinch
 * distance and snapshots the current zoom level. On subsequent two-pointer
 * moves, the ratio (current distance / initial distance) is applied to the
 * snapshotted zoom, with clamping handled by the zoom controller.
 *
 * Compatible with mouse-only desktop: single-pointer drags are ignored,
 * so the existing scroll/scrub behavior is untouched. Mouse wheels still
 * route through useTimelineZoom.handleWheel.
 *
 * Important: when a pinch is active, we call preventDefault on the move
 * events to keep iOS Safari from running its own page-zoom gesture. That
 * means listeners must be attached with `passive: false`, which React's
 * synthetic event system does not support — so we attach natively to the
 * element via ref + useEffect.
 * ========================================================================== */

import { useEffect, type RefObject } from "react";

interface UsePinchZoomProps {
	containerRef: RefObject<HTMLElement | null>;
	getZoomLevel: () => number;
	setZoomLevel: (zoom: number | ((prev: number) => number)) => void;
	minZoom?: number;
	maxZoom?: number;
}

export function usePinchZoom({
	containerRef,
	getZoomLevel,
	setZoomLevel,
	minZoom = 0.05,
	maxZoom = 200,
}: UsePinchZoomProps): void {
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const pointers = new Map<number, { x: number; y: number }>();
		let pinchStartDistance: number | null = null;
		let pinchStartZoom: number | null = null;

		const distance = (): number => {
			if (pointers.size < 2) return 0;
			const [a, b] = Array.from(pointers.values());
			const dx = a.x - b.x;
			const dy = a.y - b.y;
			return Math.hypot(dx, dy);
		};

		const onPointerDown = (event: PointerEvent) => {
			// Only consider touch pointers — desktop mouse with the Mac trackpad
			// reports pointerType: "touch" already, but plain mice should fall
			// through to the existing wheel-zoom path.
			if (event.pointerType !== "touch") return;
			pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
			if (pointers.size === 2) {
				pinchStartDistance = distance();
				pinchStartZoom = getZoomLevel();
			}
		};

		const onPointerMove = (event: PointerEvent) => {
			if (!pointers.has(event.pointerId)) return;
			pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
			if (
				pointers.size === 2 &&
				pinchStartDistance != null &&
				pinchStartZoom != null
			) {
				event.preventDefault();
				const ratio = distance() / pinchStartDistance;
				const next = Math.max(
					minZoom,
					Math.min(maxZoom, pinchStartZoom * ratio),
				);
				setZoomLevel(next);
			}
		};

		const onPointerUp = (event: PointerEvent) => {
			pointers.delete(event.pointerId);
			if (pointers.size < 2) {
				pinchStartDistance = null;
				pinchStartZoom = null;
			}
		};

		el.addEventListener("pointerdown", onPointerDown);
		// passive: false so we can preventDefault during a pinch and stop
		// iOS Safari from running its own pinch-to-zoom on the page.
		el.addEventListener("pointermove", onPointerMove, { passive: false });
		el.addEventListener("pointerup", onPointerUp);
		el.addEventListener("pointercancel", onPointerUp);
		el.addEventListener("pointerleave", onPointerUp);

		return () => {
			el.removeEventListener("pointerdown", onPointerDown);
			el.removeEventListener("pointermove", onPointerMove);
			el.removeEventListener("pointerup", onPointerUp);
			el.removeEventListener("pointercancel", onPointerUp);
			el.removeEventListener("pointerleave", onPointerUp);
		};
	}, [containerRef, getZoomLevel, setZoomLevel, minZoom, maxZoom]);
}
