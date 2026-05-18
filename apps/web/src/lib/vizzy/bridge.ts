"use client";

/**
 * Vizzy ↔ OpenCut bridge (iframe side).
 *
 * Mirror of the host-side bridge at `js/ui/advanced-bridge.js` in the Vizzy
 * repo. Listens for the host's per-frame analyzer payload, exposes the
 * latest sample through a Zustand store, and records discrete events
 * (beats, drops) for snap-to-beat features.
 *
 * Protocol (host → frame):
 *   vizzy:hello   { version }
 *   vizzy:frame   { t, audio, onsets, pulses, profile, drop, baseHue, time, duration }
 *   vizzy:media   { kind: 'audio'|'video', name, blobUrl }
 *
 * Protocol (frame → host):
 *   opencut:ready          (sent once on init)
 *   opencut:exit           (sent by the editor header's exit button)
 *   opencut:request-media  (ask host to re-send latest media)
 *
 * Hook usage:
 *   const rms = useVizzySignal('rms');     // smoothed loudness 0..1
 *   const kick = useVizzySignal('kickPulse'); // decaying kick envelope
 *
 * Mount once at the top of the editor (see `VizzyBridgeMount`) so the
 * listener is wired before any consumer hook fires.
 */

import { useEffect } from "react";
import { create } from "zustand";
import type { FeatureCurve } from "./offline-analyzer";
import { sampleCurve } from "./offline-analyzer";

export type VizzyAudio = {
	bass: number;
	mid: number;
	high: number;
	overall: number;
	rms: number;
	flux: number;
};

export type VizzyOnsets = {
	kick: boolean;
	snare: boolean;
	hihat: boolean;
	beat: boolean;
};

export type VizzyPulses = {
	kick: number;
	snare: number;
	hihat: number;
	flux: number;
	composite: number;
};

export type VizzyProfile = {
	energy: number;
	bassiness: number;
	brightness: number;
	beatDensity: number;
	intensity: number;
	tone: string;
	motion: string;
};

export type VizzyFrame = {
	t: number;
	audio: VizzyAudio;
	onsets: VizzyOnsets;
	pulses: VizzyPulses;
	profile: VizzyProfile | null;
	drop: boolean;
	baseHue: number;
	time: number;
	duration: number;
};

export type VizzyMedia = {
	kind: "audio" | "video";
	name: string;
	mime?: string;
	blobUrl: string;
};

/** Single entry inside a vizzy:media-queue snapshot. */
export type VizzyQueueItem =
	| { kind: "blob"; name: string; mime: string; blobUrl: string }
	| { kind: "youtube"; name: string; youtubeId: string; startSeconds: number }
	| { kind: "remote"; name: string; url: string };

export type VizzySignalChannel =
	| "rms"
	| "bass"
	| "mid"
	| "high"
	| "overall"
	| "flux"
	| "kickPulse"
	| "snarePulse"
	| "hihatPulse"
	| "fluxPulse"
	| "pulse"
	| "beatDensity"
	| "energy"
	| "bassiness"
	| "brightness";

type BridgeState = {
	/** True once we've received vizzy:hello after announcing opencut:ready. */
	connected: boolean;
	/** Latest per-frame payload from the host (null until first message). */
	lastFrame: VizzyFrame | null;
	/** Total vizzy:frame messages received since mount (debug counter). */
	frameCount: number;
	/** Latest audio handoff (set once the host has decoded a track). */
	audioMedia: VizzyMedia | null;
	/** Most recent video queue snapshot from the host. */
	videoQueue: VizzyQueueItem[];
	/** Timestamps (song time, seconds) of detected beats. Append-only (live). */
	beats: number[];
	/** Timestamps (song time, seconds) of detected drops. Append-only (live). */
	drops: number[];

	/** Offline-analyzed feature curve for the imported audio track. Populated
	 * by triggerOfflineAnalysis() once OpenCut has the audio file decoded.
	 * `analyzing` indicates a pass is in flight. */
	offline: FeatureCurve | null;
	analyzing: boolean;
	analyzeProgress: number;

	/** When true, the split/razor actions snap their cut point to the
	 * nearest beat from `offline.beats` (within `snapWindowSec`). */
	snapToBeat: boolean;
	snapWindowSec: number;

	/** User-supplied BPM override. When non-null, `useVizzyBpm` returns
	 * this instead of the auto-detected value. Lets users correct the
	 * analyzer when it picks the wrong tempo octave (common in dnb / trap /
	 * songs with strong off-beat snares) or enter a known BPM from the
	 * track's metadata. */
	userBpmOverride: number | null;

	setConnected: (connected: boolean) => void;
	setFrame: (frame: VizzyFrame) => void;
	setAudioMedia: (media: VizzyMedia | null) => void;
	setVideoQueue: (items: VizzyQueueItem[]) => void;
	pushBeat: (t: number) => void;
	pushDrop: (t: number) => void;
	resetEvents: () => void;
	setOffline: (curve: FeatureCurve | null) => void;
	setAnalyzing: (analyzing: boolean, progress?: number) => void;
	toggleSnapToBeat: () => void;
	setSnapWindow: (sec: number) => void;
	setUserBpmOverride: (bpm: number | null) => void;
};

// Minimum gap between beat timestamps we record (seconds). Onset detection
// can fire on adjacent frames at peak energy; collapsing them keeps the
// snap-to-beat marker list useful instead of jittery.
const MIN_BEAT_GAP_SEC = 0.08;

export const useVizzyBridge = create<BridgeState>((set, get) => ({
	connected: false,
	lastFrame: null,
	frameCount: 0,
	audioMedia: null,
	videoQueue: [],
	beats: [],
	drops: [],
	offline: null,
	analyzing: false,
	analyzeProgress: 0,
	snapToBeat: false,
	snapWindowSec: 0.5,
	userBpmOverride: null,

	setConnected: (connected) => set({ connected }),
	setFrame: (frame) =>
		set((state) => ({ lastFrame: frame, frameCount: state.frameCount + 1 })),
	setAudioMedia: (media) => set({ audioMedia: media }),
	setVideoQueue: (items) => set({ videoQueue: items }),
	setOffline: (curve) => set({ offline: curve }),
	setAnalyzing: (analyzing, progress) =>
		set({ analyzing, analyzeProgress: progress ?? (analyzing ? 0 : 1) }),
	toggleSnapToBeat: () => set((s) => ({ snapToBeat: !s.snapToBeat })),
	setSnapWindow: (sec) => set({ snapWindowSec: Math.max(0.05, sec) }),
	setUserBpmOverride: (bpm) => {
		if (bpm === null) {
			set({ userBpmOverride: null });
			return;
		}
		if (!Number.isFinite(bpm) || bpm <= 0) return;
		// Clamp to a sane musical range — most material lives in [40, 300].
		const clamped = Math.max(20, Math.min(400, bpm));
		set({ userBpmOverride: clamped });
	},

	pushBeat: (t) => {
		const beats = get().beats;
		const last = beats.length ? beats[beats.length - 1] : -Infinity;
		if (t - last < MIN_BEAT_GAP_SEC) return;
		set({ beats: [...beats, t] });
	},
	pushDrop: (t) => set({ drops: [...get().drops, t] }),
	resetEvents: () => set({ beats: [], drops: [] }),
}));

let listenerInstalled = false;
let helloAnnounced = false;

/**
 * Install the message listener and announce readiness to the parent.
 * Idempotent — safe to call from multiple mount points (we install once).
 */
export function initVizzyBridge() {
	if (typeof window === "undefined") return;
	if (listenerInstalled) {
		// Re-announce ready in case the host missed the first one (e.g. iframe
		// remounted faster than the host's message handler attached).
		if (window.parent !== window && !helloAnnounced) {
			window.parent.postMessage({ type: "opencut:ready" }, "*");
		}
		return;
	}
	listenerInstalled = true;

	const onMessage = (e: MessageEvent) => {
		const msg = e.data;
		if (!msg || typeof msg !== "object") return;
		const store = useVizzyBridge.getState();

		switch (msg.type) {
			case "vizzy:hello":
				console.log("[vizzy-bridge] hello received from host, version", msg.version);
				store.setConnected(true);
				break;
			case "vizzy:frame": {
				const frame = msg as VizzyFrame & { type: string };
				if (store.frameCount === 0) {
					console.log("[vizzy-bridge] first frame received:", frame);
				}
				store.setFrame(frame);
				if (frame.onsets?.beat) store.pushBeat(frame.time);
				if (frame.drop) store.pushDrop(frame.time);
				break;
			}
			case "vizzy:media":
				if (msg.kind === "audio" || msg.kind === "video") {
					console.log("[vizzy-bridge] media handoff:", msg.kind, msg.name);
					store.setAudioMedia({
						kind: msg.kind,
						name: String(msg.name ?? "untitled"),
						mime: typeof msg.mime === "string" ? msg.mime : undefined,
						blobUrl: String(msg.blobUrl ?? ""),
					});
				}
				break;
			case "vizzy:media-queue":
				if (Array.isArray(msg.items)) {
					console.log("[vizzy-bridge] video queue snapshot:", msg.items.length, "items");
					store.setVideoQueue(msg.items as VizzyQueueItem[]);
				}
				break;
		}
	};

	window.addEventListener("message", onMessage);

	if (window.parent !== window) {
		console.log("[vizzy-bridge] announcing opencut:ready to host");
		window.parent.postMessage({ type: "opencut:ready" }, "*");
		helloAnnounced = true;

		// Self-heal: if no media has arrived within 1.5s after connecting,
		// politely ask the host to re-send everything. Stops after we see
		// either audio OR a non-empty video queue arrive (or after 5 retries
		// to avoid runaway requests if the host genuinely has no media).
		let retryCount = 0;
		const retry = window.setInterval(() => {
			const st = useVizzyBridge.getState();
			const haveMedia = !!st.audioMedia || st.videoQueue.length > 0;
			if (haveMedia || retryCount >= 5) {
				window.clearInterval(retry);
				if (haveMedia) {
					console.log("[vizzy-bridge] media handoff complete after", retryCount, "retries");
				} else {
					console.log("[vizzy-bridge] host has no media after 5 retries — giving up auto-resync");
				}
				return;
			}
			retryCount++;
			console.log("[vizzy-bridge] no media yet, requesting resync (attempt", retryCount, ")");
			window.parent.postMessage({ type: "opencut:request-media", kind: "all" }, "*");
		}, 1500);
	} else {
		console.warn("[vizzy-bridge] no parent window detected — running standalone?");
	}

	// Dev-only debug handle: `__vizzyLatest()` in the iframe console returns
	// the most recent frame. Useful for confirming the bridge is alive
	// without rendering anything to the DOM.
	(window as Window & { __vizzyLatest?: () => VizzyFrame | null }).__vizzyLatest =
		() => useVizzyBridge.getState().lastFrame;
}

/**
 * Read a single named signal off the latest frame. Returns 0 when no frame
 * has arrived yet (rather than null) so callers can use the value directly
 * in CSS / math without null-checks.
 */
export function useVizzySignal(channel: VizzySignalChannel): number {
	const frame = useVizzyBridge((s) => s.lastFrame);
	if (!frame) return 0;
	switch (channel) {
		case "rms":
			return frame.audio.rms;
		case "bass":
			return frame.audio.bass;
		case "mid":
			return frame.audio.mid;
		case "high":
			return frame.audio.high;
		case "overall":
			return frame.audio.overall;
		case "flux":
			return frame.audio.flux;
		case "kickPulse":
			return frame.pulses.kick;
		case "snarePulse":
			return frame.pulses.snare;
		case "hihatPulse":
			return frame.pulses.hihat;
		case "fluxPulse":
			return frame.pulses.flux;
		case "pulse":
			return frame.pulses.composite;
		case "beatDensity":
			return frame.profile?.beatDensity ?? 0;
		case "energy":
			return frame.profile?.energy ?? 0;
		case "bassiness":
			return frame.profile?.bassiness ?? 0;
		case "brightness":
			return frame.profile?.brightness ?? 0;
	}
}

/**
 * Sample the offline feature curve at an arbitrary timeline time. Used by
 * bindable parameters in the editor — when the playhead is at `time`, what
 * was the song's RMS / kick energy / bass / etc. at that moment?
 *
 * Falls back to the live `lastFrame` value when no offline curve has been
 * computed yet (e.g. analysis still in flight or audio not imported).
 */
export function useVizzyOfflineSignal(
	channel: VizzySignalChannel,
	time: number,
): number {
	const offline = useVizzyBridge((s) => s.offline);
	const lastFrame = useVizzyBridge((s) => s.lastFrame);

	if (offline) {
		// Channel name → offline frame field. Most map directly; pulses and
		// profile-derived channels don't exist offline, so fall back.
		switch (channel) {
			case "rms":
			case "bass":
			case "mid":
			case "high":
			case "overall":
			case "flux":
				return sampleCurve(offline, time, channel);
			default:
				break;
		}
	}

	// Fallback to live frame for channels not represented offline (pulses,
	// profile fields) or when offline is unavailable.
	if (!lastFrame) return 0;
	switch (channel) {
		case "rms": return lastFrame.audio.rms;
		case "bass": return lastFrame.audio.bass;
		case "mid": return lastFrame.audio.mid;
		case "high": return lastFrame.audio.high;
		case "overall": return lastFrame.audio.overall;
		case "flux": return lastFrame.audio.flux;
		case "kickPulse": return lastFrame.pulses.kick;
		case "snarePulse": return lastFrame.pulses.snare;
		case "hihatPulse": return lastFrame.pulses.hihat;
		case "fluxPulse": return lastFrame.pulses.flux;
		case "pulse": return lastFrame.pulses.composite;
		case "beatDensity": return lastFrame.profile?.beatDensity ?? 0;
		case "energy": return lastFrame.profile?.energy ?? 0;
		case "bassiness": return lastFrame.profile?.bassiness ?? 0;
		case "brightness": return lastFrame.profile?.brightness ?? 0;
	}
}

/**
 * Estimate the song's BPM from the offline beat grid. Uses the median
 * inter-beat interval — robust to outliers (occasional missed kicks or
 * spurious snare-as-beat hits) compared to the mean.
 *
 * Returns 0 when no offline curve or fewer than 4 beats (not enough
 * intervals to make a confident estimate). Callers should treat a 0 BPM
 * as "no analysis yet" and disable BPM-dependent UI accordingly.
 *
 * Production analyzers (Ableton, Logic) use tempogram autocorrelation
 * for higher accuracy across complex tempo curves — that's out of scope
 * here. For most modern music with steady tempo the median-interval
 * estimate is within ±1 BPM of the true tempo.
 */
export function getEstimatedBpm(): number {
	const offline = useVizzyBridge.getState().offline;
	if (!offline || offline.beats.length < 4) return 0;
	const intervals: number[] = [];
	for (let i = 1; i < offline.beats.length; i++) {
		intervals.push(offline.beats[i] - offline.beats[i - 1]);
	}
	intervals.sort((a, b) => a - b);
	const median = intervals[Math.floor(intervals.length / 2)];
	if (!median || !Number.isFinite(median)) return 0;
	return 60 / median;
}

/**
 * React hook: returns the user-supplied BPM override if set, otherwise
 * the auto-detected value from the offline beat grid. Returns 0 only
 * when neither source has a value (no analysis yet AND no manual entry).
 */
export function useVizzyBpm(): number {
	const offline = useVizzyBridge((s) => s.offline);
	const userBpm = useVizzyBridge((s) => s.userBpmOverride);
	if (userBpm && userBpm > 0) return userBpm;
	if (!offline || offline.beats.length < 4) return 0;
	const intervals: number[] = [];
	for (let i = 1; i < offline.beats.length; i++) {
		intervals.push(offline.beats[i] - offline.beats[i - 1]);
	}
	intervals.sort((a, b) => a - b);
	const median = intervals[Math.floor(intervals.length / 2)];
	if (!median || !Number.isFinite(median)) return 0;
	return 60 / median;
}

/** Returns the auto-detected BPM (ignores any user override). Used by
 *  the speed-tab UI to show "auto: 124.5" alongside the editable input. */
export function useVizzyAutoBpm(): number {
	const offline = useVizzyBridge((s) => s.offline);
	if (!offline || offline.beats.length < 4) return 0;
	const intervals: number[] = [];
	for (let i = 1; i < offline.beats.length; i++) {
		intervals.push(offline.beats[i] - offline.beats[i - 1]);
	}
	intervals.sort((a, b) => a - b);
	const median = intervals[Math.floor(intervals.length / 2)];
	if (!median || !Number.isFinite(median)) return 0;
	return 60 / median;
}

/**
 * Optionally snap a time value to the nearest detected beat. Used by the
 * split / razor / cut actions so a single toggle ("snap to beat") makes
 * every cut land on the kick. Returns the input time unchanged when:
 *   - the user hasn't enabled snap-to-beat
 *   - offline analysis hasn't produced a beat list yet
 *   - no beat falls within `snapWindowSec` of the input time
 */
export function maybeSnapToBeat(time: number): number {
	const { snapToBeat, snapWindowSec, offline } = useVizzyBridge.getState();
	if (!snapToBeat || !offline || offline.beats.length === 0) return time;

	// Binary search for nearest beat (offline.beats is sorted ascending).
	const beats = offline.beats;
	let lo = 0, hi = beats.length - 1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (beats[mid] < time) lo = mid + 1; else hi = mid - 1;
	}
	const candidates: number[] = [];
	if (lo - 1 >= 0) candidates.push(beats[lo - 1]);
	if (lo < beats.length) candidates.push(beats[lo]);
	let best: number | null = null;
	for (const c of candidates) {
		if (Math.abs(c - time) <= snapWindowSec) {
			if (best === null || Math.abs(c - time) < Math.abs(best - time)) best = c;
		}
	}
	return best ?? time;
}

/** Ask the host to re-send all current media. Used by the "Re-sync from
 * Vizzy" button in the editor UI and the auto-retry on initial connect. */
export function requestResync() {
	if (typeof window === "undefined") return;
	if (window.parent === window) return;
	console.log("[vizzy-bridge] requesting resync (manual)");
	window.parent.postMessage({ type: "opencut:request-media", kind: "all" }, "*");
}

/**
 * Mount component — drop this once at the top of the editor tree to wire
 * the message listener and announce readiness to the host. Renders nothing.
 */
export function VizzyBridgeMount() {
	useEffect(() => {
		initVizzyBridge();
	}, []);
	return null;
}
