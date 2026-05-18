/**
 * Trigger offline audio analysis on an arbitrary File, storing the
 * resulting feature curve on the bridge store so Magic Auto-Cut, the
 * snap-to-beat razor, and the timeline ruler markers all light up.
 *
 * Two entry points share this code:
 *   - The auto-importer fires it when a track arrives via the host bridge
 *     (basic-mode handoff).
 *   - The timeline element "Detect beats" context-menu item fires it on
 *     any audio asset that's already in the project (manual import).
 *
 * Idempotency: callers pass a stable `key` (fingerprint) so we won't
 * re-analyze the same file twice in one session.
 */

import { toast } from "sonner";
import { analyzeOffline } from "./offline-analyzer";
import { useVizzyBridge } from "./bridge";

const completedKeys = new Set<string>();
const inFlightKeys = new Set<string>();

export async function analyzeAndStoreCurve(
	file: File,
	options: {
		key?: string;
		beatSensitivity?: number;
		/** When true, runs the analysis even if `key` was already analyzed. */
		force?: boolean;
		/** Suppress the toast (useful for the silent auto-import path). */
		quiet?: boolean;
	} = {},
): Promise<void> {
	const key = options.key ?? `${file.name}::${file.size}`;
	if (!options.force && completedKeys.has(key)) {
		if (!options.quiet) {
			toast.info(`Already analyzed "${file.name}"`);
		}
		return;
	}
	if (inFlightKeys.has(key)) {
		if (!options.quiet) toast.info(`Already analyzing "${file.name}"…`);
		return;
	}

	const store = useVizzyBridge.getState();
	inFlightKeys.add(key);
	store.setAnalyzing(true, 0);
	try {
		console.log("[vizzy-analyze] starting offline analysis of", file.name);
		const t0 = performance.now();
		const curve = await analyzeOffline(file, {
			beatSensitivity: options.beatSensitivity,
			onProgress: (p) => useVizzyBridge.getState().setAnalyzing(true, p),
		});
		const dt = ((performance.now() - t0) / 1000).toFixed(1);
		console.log(
			"[vizzy-analyze] done in",
			dt,
			"s —",
			curve.frames.length,
			"frames,",
			curve.beats.length,
			"beats,",
			curve.drops.length,
			"drops",
		);
		store.setOffline(curve);
		store.setAnalyzing(false, 1);
		completedKeys.add(key);
		if (!options.quiet) {
			toast.success(
				`Analyzed "${curve.name}" — ${curve.beats.length} beats, ${curve.drops.length} drops`,
				{ description: "Magic Auto-Cut and snap-to-beat are ready." },
			);
		}
	} catch (err) {
		console.error("[vizzy-analyze] failed", err);
		if (!options.quiet) {
			toast.error("Couldn't analyze audio", {
				description: err instanceof Error ? err.message : "Unknown error",
			});
		}
		useVizzyBridge.getState().setAnalyzing(false, 0);
	} finally {
		inFlightKeys.delete(key);
	}
}
