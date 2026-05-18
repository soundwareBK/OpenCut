import type { EffectDefinition } from "@/effects/types";
import { buildParams, nowSeconds, num } from "@/effects/shader-helpers";

export const wavesEffectDefinition: EffectDefinition = {
	type: "waves",
	name: "Waves",
	keywords: ["wave", "wobble", "ripple", "distort", "animate"],
	params: [
		{ key: "amplitude", label: "Amplitude", type: "number", default: 0.02, min: 0,  max: 0.2,  step: 0.001 },
		{ key: "frequency", label: "Frequency", type: "number", default: 10,   min: 1,  max: 60,   step: 0.5 },
		{ key: "speed",     label: "Speed",     type: "number", default: 1,    min: -5, max: 5,    step: 0.05 },
		{ key: "axis",      label: "Axis",      type: "number", default: 0,    min: 0,  max: 1,    step: 0.01 },
	],
	renderer: {
		passes: [{
			shader: "waves",
			uniforms: ({ effectParams }) => ({
				u_time: nowSeconds(),
				u_params: buildParams([
					num(effectParams, "amplitude", 0.02),
					num(effectParams, "frequency", 10),
					num(effectParams, "speed", 1),
					num(effectParams, "axis", 0),
				]),
			}),
		}],
	},
};

export const pinchBulgeEffectDefinition: EffectDefinition = {
	type: "pinch-bulge",
	name: "Pinch / Bulge",
	keywords: ["pinch", "bulge", "distort", "warp"],
	params: [
		{ key: "strength", label: "Strength", type: "number", default: 0.5,  min: -1, max: 1, step: 0.01 },
		{ key: "radius",   label: "Radius",   type: "number", default: 0.5,  min: 0.05, max: 1, step: 0.01 },
		{ key: "centerX",  label: "Center X", type: "number", default: 0.5,  min: 0,  max: 1, step: 0.01 },
		{ key: "centerY",  label: "Center Y", type: "number", default: 0.5,  min: 0,  max: 1, step: 0.01 },
	],
	renderer: {
		passes: [{
			shader: "pinch-bulge",
			uniforms: ({ effectParams }) => ({
				u_params: buildParams([
					num(effectParams, "strength", 0.5),
					num(effectParams, "radius", 0.5),
					num(effectParams, "centerX", 0.5),
					num(effectParams, "centerY", 0.5),
				]),
			}),
		}],
	},
};

export const twirlEffectDefinition: EffectDefinition = {
	type: "twirl",
	name: "Twirl",
	keywords: ["twirl", "swirl", "rotate", "distort"],
	params: [
		{ key: "angle",   label: "Angle (rad)", type: "number", default: 2,   min: -10, max: 10, step: 0.1 },
		{ key: "radius",  label: "Radius",      type: "number", default: 0.5, min: 0.05, max: 1, step: 0.01 },
		{ key: "centerX", label: "Center X",    type: "number", default: 0.5, min: 0,  max: 1, step: 0.01 },
		{ key: "centerY", label: "Center Y",    type: "number", default: 0.5, min: 0,  max: 1, step: 0.01 },
	],
	renderer: {
		passes: [{
			shader: "twirl",
			uniforms: ({ effectParams }) => ({
				u_params: buildParams([
					num(effectParams, "angle", 2),
					num(effectParams, "radius", 0.5),
					num(effectParams, "centerX", 0.5),
					num(effectParams, "centerY", 0.5),
				]),
			}),
		}],
	},
};

export const fisheyeEffectDefinition: EffectDefinition = {
	type: "fisheye",
	name: "Fisheye",
	keywords: ["fisheye", "lens", "barrel", "wide"],
	params: [
		{ key: "strength", label: "Strength", type: "number", default: 0.5, min: -1, max: 1,   step: 0.01 },
		{ key: "zoom",     label: "Zoom",     type: "number", default: 1,   min: 0.5, max: 1.5, step: 0.01 },
	],
	renderer: {
		passes: [{
			shader: "fisheye",
			uniforms: ({ effectParams }) => ({
				u_params: buildParams([
					num(effectParams, "strength", 0.5),
					num(effectParams, "zoom", 1),
				]),
			}),
		}],
	},
};

export const kaleidoscopeEffectDefinition: EffectDefinition = {
	type: "kaleidoscope",
	name: "Kaleidoscope",
	keywords: ["kaleidoscope", "mirror", "symmetry"],
	params: [
		{ key: "segments", label: "Segments", type: "number", default: 6,   min: 2,  max: 32, step: 1 },
		{ key: "angle",    label: "Rotation", type: "number", default: 0,   min: -180, max: 180, step: 1 },
		{ key: "centerX",  label: "Center X", type: "number", default: 0.5, min: 0,  max: 1, step: 0.01 },
		{ key: "centerY",  label: "Center Y", type: "number", default: 0.5, min: 0,  max: 1, step: 0.01 },
	],
	renderer: {
		passes: [{
			shader: "kaleidoscope",
			uniforms: ({ effectParams }) => ({
				u_params: buildParams([
					num(effectParams, "segments", 6),
					(num(effectParams, "angle") * Math.PI) / 180,
					num(effectParams, "centerX", 0.5),
					num(effectParams, "centerY", 0.5),
				]),
			}),
		}],
	},
};

export const mirrorEffectDefinition: EffectDefinition = {
	type: "mirror",
	name: "Mirror",
	keywords: ["mirror", "reflect", "flip"],
	params: [
		{
			key: "mode", label: "Mode", type: "select", default: "left-right",
			options: [
				{ value: "left-right", label: "Left → Right" },
				{ value: "right-left", label: "Right → Left" },
				{ value: "top-bottom", label: "Top → Bottom" },
				{ value: "bottom-top", label: "Bottom → Top" },
			],
		},
	],
	renderer: {
		passes: [{
			shader: "mirror",
			uniforms: ({ effectParams }) => {
				const modeMap: Record<string, number> = {
					"left-right": 0, "right-left": 1, "top-bottom": 2, "bottom-top": 3,
				};
				const m = modeMap[typeof effectParams.mode === "string" ? effectParams.mode : "left-right"] ?? 0;
				return { u_params: buildParams([m]) };
			},
		}],
	},
};

export const distortionDefinitions: EffectDefinition[] = [
	wavesEffectDefinition,
	pinchBulgeEffectDefinition,
	twirlEffectDefinition,
	fisheyeEffectDefinition,
	kaleidoscopeEffectDefinition,
	mirrorEffectDefinition,
];
