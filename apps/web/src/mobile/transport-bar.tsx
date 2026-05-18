"use client";

/* ============================================================================
 * Vizzy mobile shell — compact transport strip between preview and timeline.
 *
 * Single-focus layout: a large centered play button flanked by the current
 * time on the left and total duration on the right. Optical-centered
 * triangle (slight right nudge) so the play icon doesn't look off-balance
 * inside the circle.
 *
 * Undo/redo intentionally NOT here — CapCut/InShot mobile transports keep
 * play as the only affordance in this row to make it unmistakable, and
 * undo/redo are rarely used on phone. They'll come back in a kebab menu
 * if we ever decide we need them mobile-side.
 *
 * Wired straight to EditorCore.playback — no local state, so it stays in
 * lockstep with the timeline scrubber and keyboard shortcuts.
 * ========================================================================== */

import { useEditor } from "@/editor/use-editor";
import { PlayIcon, PauseIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { mediaTimeToSeconds, ZERO_MEDIA_TIME } from "@/wasm";

function formatTime(seconds: number): string {
	const safe = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
	const m = Math.floor(safe / 60);
	const s = Math.floor(safe % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MobileTransportBar() {
	const editor = useEditor();
	const isPlaying = useEditor((e) => e.playback.getIsPlaying());
	const currentTime = useEditor((e) => e.playback.getCurrentTime());
	const totalDuration = useEditor((e) => e.timeline.getTotalDuration());

	const current = formatTime(mediaTimeToSeconds({ time: currentTime }));
	const total = formatTime(
		mediaTimeToSeconds({ time: totalDuration ?? ZERO_MEDIA_TIME }),
	);

	return (
		<div className="flex h-14 shrink-0 items-center gap-3 px-4 border-y border-border bg-background">
			{/* Fixed-width time readouts so the play button stays anchored
			    even as digits roll over. tabular-nums prevents the digits
			    themselves from jittering. */}
			<span className="w-14 font-mono text-[11px] tracking-wider tabular-nums text-foreground select-none">
				{current}
			</span>

			<div className="flex flex-1 items-center justify-center">
				<button
					type="button"
					onClick={() => editor.playback.toggle()}
					aria-label={isPlaying ? "Pause" : "Play"}
					className="flex size-12 items-center justify-center rounded-full bg-white text-black shadow-md transition-transform duration-150 hover:scale-[1.04] active:scale-95"
				>
					<HugeiconsIcon
						icon={isPlaying ? PauseIcon : PlayIcon}
						className="size-5"
						// Optical centering — a play triangle reads as
						// right-heavy, so nudge it 1px left of geometric
						// center to look balanced. Pause (two bars) is
						// already balanced, no nudge.
						style={!isPlaying ? { marginLeft: 1 } : undefined}
					/>
				</button>
			</div>

			<span className="w-14 text-right font-mono text-[11px] tracking-wider tabular-nums text-muted-foreground select-none">
				{total}
			</span>
		</div>
	);
}
