"use client";

/* ============================================================================
 * Vizzy mobile shell — compact transport strip between preview and timeline.
 *
 * Mirrors the desktop preview toolbar's playback controls but uses bigger
 * touch targets and drops everything that doesn't survive a phone width
 * (zoom shortcuts, fullscreen — they move into a kebab menu later if we
 * decide we need them on mobile).
 *
 * Wired straight to EditorCore.playback / EditorCore.command — no local
 * state, so it stays in lockstep with the timeline scrubber and keyboard
 * shortcuts.
 * ========================================================================== */

import { useEditor } from "@/editor/use-editor";
import { Button } from "@/components/ui/button";
import {
	PlayIcon,
	PauseIcon,
	UndoIcon,
	RedoIcon,
} from "@hugeicons/core-free-icons";
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
	const canUndo = useEditor((e) => e.command.canUndo());
	const canRedo = useEditor((e) => e.command.canRedo());

	const current = formatTime(mediaTimeToSeconds({ time: currentTime }));
	const total = formatTime(
		mediaTimeToSeconds({ time: totalDuration ?? ZERO_MEDIA_TIME }),
	);

	return (
		<div className="flex h-11 shrink-0 items-center gap-2 px-3 border-y bg-background">
			<Button
				size="icon"
				variant="ghost"
				className="size-9"
				disabled={!canUndo}
				onClick={() => editor.command.undo()}
				aria-label="Undo"
			>
				<HugeiconsIcon icon={UndoIcon} className="size-5" />
			</Button>
			<Button
				size="icon"
				variant="ghost"
				className="size-9"
				disabled={!canRedo}
				onClick={() => editor.command.redo()}
				aria-label="Redo"
			>
				<HugeiconsIcon icon={RedoIcon} className="size-5" />
			</Button>

			<Button
				size="icon"
				variant="default"
				className="size-11 rounded-full ml-auto mr-auto"
				onClick={() => editor.playback.toggle()}
				aria-label={isPlaying ? "Pause" : "Play"}
			>
				<HugeiconsIcon
					icon={isPlaying ? PauseIcon : PlayIcon}
					className="size-5"
				/>
			</Button>

			<div className="tabular-nums text-xs text-muted-foreground select-none whitespace-nowrap">
				<span className="text-foreground">{current}</span>
				<span className="opacity-50"> / {total}</span>
			</div>
		</div>
	);
}
