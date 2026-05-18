/**
 * Offline audio analyzer — port of Vizzy's realtime analyzer math.
 *
 * Runs once when an audio file is imported into the editor. Produces dense
 * feature curves (energy bands, spectral flux, kick/snare/hihat onsets,
 * drop events) for the entire track so the editor can:
 *
 *   - Snap razor cuts to detected beats / drops (Phase 3b)
 *   - Drive bindable clip parameters when scrubbing the timeline (i.e.
 *     when audio isn't actively playing through the host)
 *   - Pre-arrange clips along a beat grid (magic auto-cut, Phase 3d)
 *
 * Algorithm parity with `js/audio/analysis.js` and `js/fx/drop-detect.js`:
 *   - fftSize 2048 (1024 bins), smoothingTimeConstant 0.8 — identical
 *   - bass = bins 0..7, mid = bins 8..79, high = bins 80..end
 *   - kick band = bins 1..7, snare = bins 12..49, hihat = bins 100..399
 *   - Adaptive onset threshold: rolling mean of last 43 frames of band flux
 *   - Drop: 90-frame energy window, recent/past ratio > 1.7 + recent > 0.32
 *
 * Uses OfflineAudioContext + AnalyserNode with the suspend/resume pattern:
 * the offline context schedules suspends at each sample time, we read the
 * analyser's current state, then resume. Faster than realtime.
 */

const SAMPLE_HZ = 30;
const SAMPLE_DT = 1 / SAMPLE_HZ;

const FFT_SIZE = 2048;
const SMOOTHING = 0.8;
const HISTORY_LEN = 43;

const BAND_BASS_END = 8;
const BAND_MID_END = 80;

const ONSET_BANDS = {
	kick: { lo: 1, hi: 8, cooldownMs: 75, fluxThresh: 1.45, minFlux: 3, minE: 10 },
	snare: { lo: 12, hi: 50, cooldownMs: 95, fluxThresh: 1.5, minFlux: 2, minE: 7 },
	hihat: { lo: 100, hi: 400, cooldownMs: 40, fluxThresh: 1.4, minFlux: 1.5, minE: 4 },
} as const;

type OnsetBandName = keyof typeof ONSET_BANDS;

export type FeatureFrame = {
	t: number;
	bass: number;
	mid: number;
	high: number;
	overall: number;
	rms: number;
	flux: number;
	kickE: number;
	snareE: number;
	hihatE: number;
};

export type FeatureCurve = {
	/** Stable identity — derived from file size + name + duration. */
	fingerprint: string;
	/** Source filename for diagnostics. */
	name: string;
	/** Total duration in seconds. */
	duration: number;
	/** Sampling rate of the dense per-frame curve (Hz). */
	sampleRateHz: number;
	/** Dense per-frame features, sampled at SAMPLE_HZ. */
	frames: FeatureFrame[];
	/** Times (seconds) where kick OR snare fired (the "beat" signal). */
	beats: number[];
	/** Per-band onset times for advanced snapping. */
	kicks: number[];
	snares: number[];
	hihats: number[];
	/** Detected drop times. */
	drops: number[];
	/** Beat sensitivity multiplier used at analysis time (default 1.15). */
	beatSensitivity: number;
};

export type AnalyzeProgress = (frac: number) => void;

/**
 * Run the analyzer end-to-end on a File. Decodes audio, samples features at
 * 30 Hz over the offline render, runs onset + drop detection, returns a
 * dense feature curve.
 *
 * Beat sensitivity defaults to 1.15 to match Vizzy's default slider.
 */
export async function analyzeOffline(
	file: File,
	options: { beatSensitivity?: number; onProgress?: AnalyzeProgress } = {},
): Promise<FeatureCurve> {
	const beatSensitivity = options.beatSensitivity ?? 1.15;
	const onProgress = options.onProgress;

	// 1. Decode to an AudioBuffer using a one-off realtime AudioContext (the
	//    most reliable way to invoke the browser's audio decoders). We close
	//    the context immediately after — we only needed it for decode.
	const decodeCtx: AudioContext =
		typeof window !== "undefined" && (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
			? new ((window as Window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
			: new AudioContext();
	const arrayBuffer = await file.arrayBuffer();
	const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
	try { await decodeCtx.close(); } catch { /* no-op */ }

	const duration = audioBuffer.duration;
	const sampleRate = audioBuffer.sampleRate;
	const channelCount = Math.min(audioBuffer.numberOfChannels, 2);

	// 2. Build the offline context. Length is in *frames*, not seconds.
	const offline = new OfflineAudioContext(
		channelCount,
		Math.ceil(duration * sampleRate),
		sampleRate,
	);
	const source = offline.createBufferSource();
	source.buffer = audioBuffer;
	const analyser = offline.createAnalyser();
	analyser.fftSize = FFT_SIZE;
	analyser.smoothingTimeConstant = SMOOTHING;
	source.connect(analyser);
	analyser.connect(offline.destination);
	source.start(0);

	const binCount = analyser.frequencyBinCount; // FFT_SIZE / 2 = 1024
	const tdLen = analyser.fftSize;

	const frames: FeatureFrame[] = [];
	const totalSamples = Math.floor(duration * SAMPLE_HZ);

	// 3. Schedule a suspend at every sample point BEFORE startRendering. Each
	//    handler reads the analyser and pushes a FeatureFrame. We compute
	//    spectral flux relative to the previous frame's frequency bins.
	let prevFreq = new Uint8Array(binCount);
	let isFirstFrame = true;

	for (let i = 0; i < totalSamples; i++) {
		const t = i * SAMPLE_DT;
		// `t` must be < duration AND aligned to a render block boundary or
		// suspend may reject. Slight safety margin (1ms) on the upper bound.
		if (t >= duration - 0.001) break;

		offline.suspend(t).then(() => {
			const freq = new Uint8Array(binCount);
			const time = new Uint8Array(tdLen);
			analyser.getByteFrequencyData(freq);
			analyser.getByteTimeDomainData(time);

			const frame = computeFrame(t, freq, time, isFirstFrame ? freq : prevFreq);
			frames.push(frame);
			prevFreq = freq;
			isFirstFrame = false;

			if (onProgress && (i & 31) === 0) onProgress(i / totalSamples);
			offline.resume();
		});
	}

	// 4. Kick off the render. Returns when the entire audio has been processed.
	await offline.startRendering();
	if (onProgress) onProgress(1);

	// 5. Onset + drop detection (post-pass on the dense frames array).
	const { beats, kicks, snares, hihats } = detectOnsets(frames, beatSensitivity);
	const drops = detectDrops(frames);

	const fingerprint = `${file.name}::${file.size}::${duration.toFixed(3)}`;

	return {
		fingerprint,
		name: file.name,
		duration,
		sampleRateHz: SAMPLE_HZ,
		frames,
		beats,
		kicks,
		snares,
		hihats,
		drops,
		beatSensitivity,
	};
}

function computeFrame(
	t: number,
	freq: Uint8Array,
	time: Uint8Array,
	prev: Uint8Array,
): FeatureFrame {
	// Time-domain RMS (true loudness, matches Vizzy line 47-53).
	let timeSq = 0;
	for (let i = 0; i < time.length; i++) {
		const v = (time[i] - 128) / 128;
		timeSq += v * v;
	}
	const rms = Math.sqrt(timeSq / time.length);

	// Frequency-band RMS + global spectral flux.
	const total = freq.length;
	let bassSq = 0,
		midSq = 0,
		highSq = 0,
		allSq = 0,
		gFlux = 0;
	for (let i = 0; i < total; i++) {
		const v = freq[i];
		const sq = v * v;
		allSq += sq;
		if (i < BAND_BASS_END) bassSq += sq;
		else if (i < BAND_MID_END) midSq += sq;
		else highSq += sq;
		const d = v - prev[i];
		if (d > 0) gFlux += d;
	}

	// Per-band RMS energy (for onset gating — flux alone false-fires).
	let kickSq = 0,
		snareSq = 0,
		hihatSq = 0;
	const kb = ONSET_BANDS.kick;
	const sb = ONSET_BANDS.snare;
	const hb = ONSET_BANDS.hihat;
	for (let i = kb.lo; i < kb.hi && i < total; i++) kickSq += freq[i] * freq[i];
	for (let i = sb.lo; i < sb.hi && i < total; i++) snareSq += freq[i] * freq[i];
	for (let i = hb.lo; i < hb.hi && i < total; i++) hihatSq += freq[i] * freq[i];
	const kickE = Math.sqrt(kickSq / (kb.hi - kb.lo)) / 255;
	const snareE = Math.sqrt(snareSq / (sb.hi - sb.lo)) / 255;
	const hihatE = Math.sqrt(hihatSq / (hb.hi - hb.lo)) / 255;

	return {
		t,
		bass: Math.sqrt(bassSq / BAND_BASS_END) / 255,
		mid: Math.sqrt(midSq / (BAND_MID_END - BAND_BASS_END)) / 255,
		high: Math.sqrt(highSq / (total - BAND_MID_END)) / 255,
		overall: Math.sqrt(allSq / total) / 255,
		rms,
		flux: Math.min(gFlux / total / 16, 1),
		kickE,
		snareE,
		hihatE,
	};
}

/**
 * Detect per-band onsets using the same adaptive-threshold rule as Vizzy's
 * realtime analyzer (rolling mean of last HISTORY_LEN frames of band flux,
 * gated by RMS energy + cooldown). Returns beat/kick/snare/hihat time
 * arrays.
 */
function detectOnsets(
	frames: FeatureFrame[],
	beatSensitivity: number,
): {
	beats: number[];
	kicks: number[];
	snares: number[];
	hihats: number[];
} {
	const sensMul = beatSensitivity / 1.35;
	const beats: number[] = [];
	const kicks: number[] = [];
	const snares: number[] = [];
	const hihats: number[] = [];

	// Per-band sliding state — replicates `onsetBands[*].{history, lastHit}`.
	const bandState: Record<
		OnsetBandName,
		{ history: number[]; lastHitMs: number; fluxSeries: number[] }
	> = {
		kick: { history: [], lastHitMs: -Infinity, fluxSeries: [] },
		snare: { history: [], lastHitMs: -Infinity, fluxSeries: [] },
		hihat: { history: [], lastHitMs: -Infinity, fluxSeries: [] },
	};

	// We need per-frame band-flux deltas. The realtime code derives those
	// from prev vs current frequency bins. We don't have raw bins here, but
	// we have the dense per-band E series — we can approximate band flux as
	// the positive delta of band energy frame-to-frame (good correlate).
	// For higher fidelity in the future, we could also store raw bin diffs
	// during the offline pass; this approximation is solid for snap-to-beat
	// where the timestamps just need to be close, not pixel-perfect.
	let prev: FeatureFrame | null = null;
	for (const f of frames) {
		const tMs = f.t * 1000;

		const bandFluxes: Record<OnsetBandName, number> = {
			kick: prev ? Math.max(0, f.kickE - prev.kickE) * 255 : 0,
			snare: prev ? Math.max(0, f.snareE - prev.snareE) * 255 : 0,
			hihat: prev ? Math.max(0, f.hihatE - prev.hihatE) * 255 : 0,
		};

		const bandEnergies: Record<OnsetBandName, number> = {
			kick: f.kickE * 255,
			snare: f.snareE * 255,
			hihat: f.hihatE * 255,
		};

		for (const name of Object.keys(ONSET_BANDS) as OnsetBandName[]) {
			const b = ONSET_BANDS[name];
			const state = bandState[name];
			const flux = bandFluxes[name];

			state.history.push(flux);
			if (state.history.length > HISTORY_LEN) state.history.shift();
			const avg = state.history.length
				? state.history.reduce((a, c) => a + c, 0) / state.history.length || 0.5
				: 0.5;

			if (
				flux > avg * b.fluxThresh * sensMul &&
				flux > b.minFlux &&
				bandEnergies[name] > b.minE &&
				tMs - state.lastHitMs > b.cooldownMs
			) {
				state.lastHitMs = tMs;
				if (name === "kick") kicks.push(f.t);
				else if (name === "snare") snares.push(f.t);
				else hihats.push(f.t);
			}
		}

		prev = f;
	}

	// "beat" = kick OR snare (same as realtime). Merge + sort + dedup near-dupes.
	const merged = [...kicks, ...snares].sort((a, b) => a - b);
	const MIN_GAP = 0.08;
	for (const t of merged) {
		if (!beats.length || t - beats[beats.length - 1] > MIN_GAP) beats.push(t);
	}

	return { beats, kicks, snares, hihats };
}

/**
 * Drop detection — same heuristic as `drop-detect.js`. 90-frame trailing
 * energy window; fires when recent 15-frame avg / past 30-frame avg > 1.7
 * AND recent > 0.32. 10-second cooldown.
 */
function detectDrops(frames: FeatureFrame[]): number[] {
	const TREND_LEN = 90;
	const COOLDOWN_S = 10;
	const drops: number[] = [];
	const trend: number[] = [];
	let lastDropSec = -Infinity;

	for (const f of frames) {
		trend.push(f.overall);
		if (trend.length > TREND_LEN) trend.shift();
		if (trend.length < TREND_LEN || f.t - lastDropSec < COOLDOWN_S) continue;

		const recent = trend.slice(-15).reduce((a, b) => a + b, 0) / 15;
		const past = trend.slice(0, 30).reduce((a, b) => a + b, 0) / 30;
		if (recent > past * 1.7 && recent > 0.32) {
			lastDropSec = f.t;
			drops.push(f.t);
		}
	}
	return drops;
}

/**
 * Sample the dense curve at an arbitrary time `t` (linear interpolation
 * between the two nearest frames). Useful for binding clip parameters
 * during timeline scrubbing.
 */
export function sampleCurve(
	curve: FeatureCurve,
	t: number,
	field: Exclude<keyof FeatureFrame, "t">,
): number {
	if (!curve.frames.length) return 0;
	const dt = 1 / curve.sampleRateHz;
	const idx = t / dt;
	const i0 = Math.floor(idx);
	const i1 = Math.min(i0 + 1, curve.frames.length - 1);
	if (i0 < 0) return curve.frames[0][field];
	if (i0 >= curve.frames.length - 1) return curve.frames[curve.frames.length - 1][field];
	const f = idx - i0;
	const a = curve.frames[i0][field];
	const b = curve.frames[i1][field];
	return a + (b - a) * f;
}

/** Find the nearest beat (or kick/drop) to time `t`, within `windowSec`. */
export function nearestEvent(events: number[], t: number, windowSec: number): number | null {
	if (!events.length) return null;
	// Binary search for insertion point.
	let lo = 0,
		hi = events.length - 1,
		mid = 0;
	while (lo <= hi) {
		mid = (lo + hi) >> 1;
		if (events[mid] < t) lo = mid + 1;
		else hi = mid - 1;
	}
	const candidates = [events[lo - 1], events[lo]].filter(
		(x) => x !== undefined && Math.abs(x - t) <= windowSec,
	) as number[];
	if (!candidates.length) return null;
	return candidates.reduce((best, c) =>
		Math.abs(c - t) < Math.abs(best - t) ? c : best,
	);
}
