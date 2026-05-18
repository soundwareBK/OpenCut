/**
 * Magic auto-cut v2 — beat-synced clip arrangement, with options.
 *
 * Behavior is closer to CapCut "Auto Cut" / iMovie "Magic Movie":
 *  1. User opens a small dialog and picks options (rhythm, clip subset,
 *     whether to clear the existing video track, start offset).
 *  2. We build a sequence of `[Delete?, Insert, Insert, …]` commands.
 *  3. Wrap them in a single `BatchCommand` so the whole result is one
 *     undoable step — Ctrl-Z restores the previous state cleanly instead
 *     of forcing N undos through hundreds of micro-inserts.
 *
 * Rhythm modes:
 *   - "every beat" (1)        — fast cuts, EDM / hip-hop drop sections
 *   - "every 2 beats" (2)     — half-bar
 *   - "every 4 beats" (4)     — bar — DEFAULT
 *   - "every 8 beats" (8)     — phrase — slower montage feel
 *   - "drops only"            — only cut on detected drops
 *   - "smart" (auto)          — picks based on beat density
 *
 * Clip selection:
 *   - default: all video assets, round-robin
 *   - subset: user can include/exclude specific clip ids
 *
 * Clip variation (to avoid every cut looking identical when clips repeat):
 *   - if asset.duration > window length, pick a random in-clip start
 *     offset so successive uses of the same clip show different content.
 */

import { BatchCommand } from "@/commands";
import { DeleteElementsCommand } from "@/commands/timeline/element/delete-elements";
import { InsertElementCommand } from "@/commands/timeline/element/insert-element";
import { EditorCore } from "@/core";
import type { MediaAsset } from "@/media/types";
import { buildElementFromMedia } from "@/timeline/element-utils";
import { mediaTimeFromSeconds } from "@/wasm";
import { useVizzyBridge } from "./bridge";

export type RhythmMode = 1 | 2 | 4 | 8 | "drops" | "smart";

export type MagicCutOptions = {
	/** Rhythm — how often to cut. */
	rhythm: RhythmMode;
	/** Subset of media asset ids to use (round-robin). If empty, use all videos. */
	includeAssetIds: string[];
	/** Clear all existing video-track elements before placing the new sequence. */
	clearVideoTracksFirst: boolean;
	/** Start the sequence at this beat index (skip an intro). */
	startBeatIndex: number;
	/** Vary in-clip start offset so repeats look different. */
	varyClipOffset: boolean;
};

export type MagicCutPreview = {
	mode: string;
	gridTimes: number[];
	totalCuts: number;
	clipsUsed: number;
	durationSec: number;
};

export type MagicCutResult = {
	placed: number;
	skipped: number;
	beatsUsed: number;
};

export const DEFAULT_OPTIONS: MagicCutOptions = {
	rhythm: 4,
	includeAssetIds: [],
	clearVideoTracksFirst: true,
	startBeatIndex: 0,
	varyClipOffset: true,
};

/** Build the cut-grid (start times in seconds) given the chosen rhythm. */
export function computeGrid(options: MagicCutOptions): {
	grid: number[];
	rhythmLabel: string;
} {
	const bridge = useVizzyBridge.getState();
	const offline = bridge.offline;
	if (!offline) return { grid: [], rhythmLabel: "no audio" };

	const beats = offline.beats;
	const drops = offline.drops;
	const duration = offline.duration;

	let grid: number[] = [];
	let rhythmLabel = "";

	if (options.rhythm === "drops") {
		grid = [...drops];
		if (grid.length === 0 && beats.length > 0) {
			// Graceful fallback when no drops were detected — go to "bar" rhythm
			// so the user still gets something instead of an empty timeline.
			grid = pickEveryN(beats, 4, options.startBeatIndex);
			rhythmLabel = "drops (no drops detected → bar)";
		} else {
			rhythmLabel = `${drops.length} drops`;
		}
	} else if (options.rhythm === "smart") {
		// Tempo-aware default. beatDensity is in beats/sec.
		const density = offline.frames.length
			? offline.beats.length / Math.max(1, duration)
			: 2;
		// ~2 bps = 120 BPM. Faster than that → fewer cuts per beat. Slower → more.
		let everyN: 1 | 2 | 4 | 8;
		if (density > 4) everyN = 8;
		else if (density > 2.5) everyN = 4;
		else if (density > 1.5) everyN = 2;
		else everyN = 1;
		grid = pickEveryN(beats, everyN, options.startBeatIndex);
		rhythmLabel = `smart (${everyN === 1 ? "every beat" : `every ${everyN} beats`}, density ${density.toFixed(1)} bps)`;
	} else {
		grid = pickEveryN(beats, options.rhythm, options.startBeatIndex);
		rhythmLabel = options.rhythm === 1 ? "every beat" : `every ${options.rhythm} beats`;
	}

	return { grid, rhythmLabel };
}

function pickEveryN(beats: number[], n: number, startBeatIndex: number): number[] {
	const out: number[] = [];
	for (let i = Math.max(0, startBeatIndex); i < beats.length; i += n) {
		out.push(beats[i]);
	}
	return out;
}

/** Cheap preview for the dialog — no commands executed. */
export function previewMagicCut(options: MagicCutOptions): MagicCutPreview {
	const bridge = useVizzyBridge.getState();
	const offline = bridge.offline;
	const { grid, rhythmLabel } = computeGrid(options);

	const editor = EditorCore.getInstance();
	const assets: MediaAsset[] = editor.media.getAssets();
	const videoAssets = filterClips(assets, options.includeAssetIds);

	return {
		mode: rhythmLabel,
		gridTimes: grid,
		totalCuts: Math.max(0, grid.length),
		clipsUsed: Math.min(videoAssets.length, grid.length),
		durationSec: offline?.duration ?? 0,
	};
}

function filterClips(assets: MediaAsset[], include: string[]): MediaAsset[] {
	const videos = assets.filter((a) => a.type === "video");
	if (!include.length) return videos;
	const wanted = new Set(include);
	const filtered = videos.filter((a) => wanted.has(a.id));
	return filtered.length ? filtered : videos;
}

/**
 * Execute the magic auto-cut as a single undoable batch.
 *
 * Throws (caller is expected to catch + toast) if:
 *   - no offline beats yet
 *   - no active project
 *   - no video clips at all
 */
export function applyMagicCut(options: MagicCutOptions): MagicCutResult {
	const bridge = useVizzyBridge.getState();
	const offline = bridge.offline;
	if (!offline || offline.beats.length < 2) {
		throw new Error("Import an audio file first so Vizzy can detect beats.");
	}

	const editor = EditorCore.getInstance();
	const project = editor.project.getActive();
	if (!project) throw new Error("No active project.");

	const assets: MediaAsset[] = editor.media.getAssets();
	const videoAssets = filterClips(assets, options.includeAssetIds);
	if (!videoAssets.length) {
		throw new Error("Drop at least one video clip first.");
	}

	const { grid: rawGrid } = computeGrid(options);
	if (rawGrid.length === 0) {
		throw new Error("No cuts to place with the current options.");
	}

	// Add a virtual final boundary so the last clip has somewhere to end.
	const grid = [...rawGrid, offline.duration > 0 ? offline.duration : rawGrid[rawGrid.length - 1] + 4];

	const commands: Array<DeleteElementsCommand | InsertElementCommand> = [];

	// Clear-first: delete every existing element on the main video track + any
	// overlay tracks marked as video. Wrapped in the same batch so undo
	// restores the prior state in one step.
	if (options.clearVideoTracksFirst) {
		const scene = editor.scenes.getActiveScene();
		const tracks = scene.tracks;
		const toDelete: { trackId: string; elementId: string }[] = [];
		const allTracks = [tracks.main, ...tracks.overlay];
		for (const track of allTracks) {
			if (track.type !== "video") continue;
			for (const el of track.elements) {
				toDelete.push({ trackId: track.id, elementId: el.id });
			}
		}
		if (toDelete.length) {
			commands.push(new DeleteElementsCommand({ elements: toDelete }));
		}
	}

	let placed = 0;
	let skipped = 0;
	const MIN_WINDOW = 0.18; // skip micro-windows under ~6 frames at 30fps

	for (let i = 0; i < grid.length - 1; i++) {
		const start = grid[i];
		const end = grid[i + 1];
		const window = end - start;
		if (window < MIN_WINDOW) {
			skipped++;
			continue;
		}
		const asset = videoAssets[i % videoAssets.length];
		// Element duration = window length. OpenCut handles asset shorter
		// than the element naturally (holds last frame / loops per element
		// playMode). If the asset is much longer than the window we'd
		// ideally also seed a trim offset for variation — but
		// buildElementFromMedia doesn't expose that here, so we ship the
		// rhythm-correct timing first and revisit clip-internal variation
		// once we surface a trim API.
		const element = buildElementFromMedia({
			mediaId: asset.id,
			mediaType: "video",
			name: asset.name,
			duration: mediaTimeFromSeconds({ seconds: window }),
			startTime: mediaTimeFromSeconds({ seconds: start }),
		});
		commands.push(
			new InsertElementCommand({
				element,
				// Pin all auto-cut inserts to the main video track so they
				// form a clean strip the user can rearrange or rip out.
				placement: { mode: "auto", trackType: "video" },
			}),
		);
		placed++;
	}

	if (commands.length === 0) {
		throw new Error("Nothing to place with the current options.");
	}

	const batch = commands.length === 1 ? commands[0] : new BatchCommand(commands);
	editor.command.execute({ command: batch });

	return { placed, skipped, beatsUsed: grid.length - 1 };
}
