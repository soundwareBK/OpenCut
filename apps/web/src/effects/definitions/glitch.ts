import type { EffectDefinition } from "@/effects/types";
import { buildParams, nowSeconds, num } from "@/effects/shader-helpers";

export const rgbSplitEffectDefinition: EffectDefinition = {
	type: "rgb-split",
	name: "RGB Split",
	keywords: ["rgb", "split", "chromatic", "aberration", "glitch"],
	params: [
		{ key: "amount",  label: "Amount",  type: "number", default: 6, min: 0, max: 80, step: 0.5 },
		{ key: "angle",   label: "Angle",   type: "number", default: 0, min: -180, max: 180, step: 1 },
		{ key: "radial",  label: "Radial",  type: "number", default: 0, min: 0, max: 1, step: 0.01 },
		{ key: "falloff", label: "Falloff", type: "number", default: 2, min: 1, max: 4, step: 0.1 },
	],
	renderer: {
		passes: [{
			shader: "rgb-split",
			uniforms: ({ effectParams }) => ({
				u_params: buildParams([
					num(effectParams, "amount", 6),
					(num(effectParams, "angle") * Math.PI) / 180,
					num(effectParams, "radial"),
					num(effectParams, "falloff", 2),
				]),
			}),
		}],
	},
};

export const vhsEffectDefinition: EffectDefinition = {
	type: "vhs",
	name: "VHS",
	keywords: ["vhs", "tape", "retro", "analog", "glitch"],
	params: [
		{ key: "chroma", label: "Chroma Offset", type: "number", default: 4,    min: 0, max: 20, step: 0.5 },
		{ key: "scan",   label: "Scan Density",  type: "number", default: 600,  min: 100, max: 1500, step: 50 },
		{ key: "noise",  label: "Tape Noise",    type: "number", default: 0.25, min: 0, max: 1, step: 0.01 },
		{ key: "warp",   label: "Warp",          type: "number", default: 0.4,  min: 0, max: 1, step: 0.01 },
	],
	renderer: {
		passes: [{
			shader: "vhs",
			uniforms: ({ effectParams }) => ({
				u_time: nowSeconds(),
				u_params: buildParams([
					num(effectParams, "chroma", 4),
					num(effectParams, "scan", 600),
					num(effectParams, "noise", 0.25),
					num(effectParams, "warp", 0.4),
				]),
			}),
		}],
	},
};

export const scanlinesEffectDefinition: EffectDefinition = {
	type: "scanlines",
	name: "Scanlines",
	keywords: ["scan", "lines", "crt", "retro"],
	params: [
		{ key: "density",   label: "Density",   type: "number", default: 500, min: 100, max: 1500, step: 25 },
		{ key: "darkness",  label: "Darkness",  type: "number", default: 0.4, min: 0,   max: 1,    step: 0.01 },
		{ key: "curvature", label: "Curvature", type: "number", default: 0,   min: 0,   max: 0.5,  step: 0.01 },
		{ key: "roll",      label: "Roll",      type: "number", default: 0,   min: 0,   max: 2,    step: 0.05 },
	],
	renderer: {
		passes: [{
			shader: "scanlines",
			uniforms: ({ effectParams }) => ({
				u_time: nowSeconds(),
				u_params: buildParams([
					num(effectParams, "density", 500),
					num(effectParams, "darkness", 0.4),
					num(effectParams, "curvature", 0),
					num(effectParams, "roll", 0),
				]),
			}),
		}],
	},
};

export const ditherEffectDefinition: EffectDefinition = {
	type: "dither",
	name: "Dither",
	keywords: ["dither", "bayer", "retro", "1bit"],
	params: [
		{ key: "levels", label: "Levels", type: "number", default: 4, min: 2, max: 16, step: 1 },
		{ key: "scale",  label: "Scale",  type: "number", default: 1, min: 1, max: 8,  step: 1 },
		{ key: "mix",    label: "Mix",    type: "number", default: 1, min: 0, max: 1,  step: 0.01 },
	],
	renderer: {
		passes: [{
			shader: "dither",
			uniforms: ({ effectParams }) => ({
				u_params: buildParams([
					num(effectParams, "levels", 4),
					num(effectParams, "scale", 1),
					num(effectParams, "mix", 1),
				]),
			}),
		}],
	},
};

/**
 * Stacked glitch presets: each runs multiple shader passes on one clip.
 * Defined as separate effects (not param presets) so they show up as distinct
 * picker entries while keeping their underlying pass-stack composable.
 */
function makePassStack({
	type, name, keywords, passes,
}: {
	type: string; name: string; keywords: string[];
	passes: Array<{ shader: string; params: number[]; useTime?: boolean }>;
}): EffectDefinition {
	return {
		type,
		name,
		keywords,
		params: [
			{ key: "intensity", label: "Intensity", type: "number", default: 1, min: 0, max: 1.5, step: 0.01 },
		],
		renderer: {
			passes: passes.map((p) => ({
				shader: p.shader,
				uniforms: ({ effectParams }) => {
					const k = num(effectParams, "intensity", 1);
					const scaled = p.params.map((v) => v * k);
					const u: Record<string, number | number[]> = {
						u_params: buildParams(scaled),
					};
					if (p.useTime) u.u_time = nowSeconds();
					return u;
				},
			})),
		},
	};
}

export const glitchDefinitions: EffectDefinition[] = [
	rgbSplitEffectDefinition,
	vhsEffectDefinition,
	scanlinesEffectDefinition,
	ditherEffectDefinition,
	// Stacked glitch presets
	makePassStack({
		type: "glitch-broken-tv", name: "Broken TV", keywords: ["glitch", "tv", "preset"],
		passes: [
			{ shader: "vhs", params: [6, 800, 0.45, 0.7], useTime: true },
			{ shader: "rgb-split", params: [10, 0, 0.3, 2] },
		],
	}),
	makePassStack({
		type: "glitch-arcade", name: "Arcade", keywords: ["glitch", "8bit", "preset"],
		passes: [
			{ shader: "pixelate", params: [6] },
			{ shader: "dither", params: [4, 1, 1] },
			{ shader: "scanlines", params: [400, 0.3, 0.05, 0], useTime: true },
		],
	}),
	makePassStack({
		type: "glitch-datamosh", name: "Datamosh", keywords: ["glitch", "preset"],
		passes: [
			{ shader: "rgb-split", params: [16, 0.4, 0.6, 2.5] },
			{ shader: "scanlines", params: [200, 0.15, 0, 0.5], useTime: true },
		],
	}),
	makePassStack({
		type: "glitch-camcorder", name: "Camcorder", keywords: ["vhs", "retro", "preset"],
		passes: [
			{ shader: "vhs", params: [3, 500, 0.15, 0.25], useTime: true },
			{ shader: "color-grade", params: [0, 0.05, -0.1, 0,  1, 0, 0.12, 0,  0, 0.05, 0, 0.1,  0, 0, 0, 0] },
		],
	}),
];
