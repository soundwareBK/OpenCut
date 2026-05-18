import type { EffectDefinition } from "@/effects/types";
import { buildParams, num, resolveColor, str } from "@/effects/shader-helpers";

export const pixelateEffectDefinition: EffectDefinition = {
	type: "pixelate",
	name: "Pixelate",
	keywords: ["pixel", "mosaic", "blocky", "retro"],
	params: [
		{ key: "blockSize", label: "Block Size", type: "number", default: 12, min: 1, max: 256, step: 1 },
	],
	renderer: {
		passes: [{
			shader: "pixelate",
			uniforms: ({ effectParams }) => ({
				u_params: buildParams([num(effectParams, "blockSize", 12)]),
			}),
		}],
	},
};

export const posterizeEffectDefinition: EffectDefinition = {
	type: "posterize",
	name: "Posterize",
	keywords: ["posterize", "bands", "cartoon"],
	params: [
		{ key: "levels", label: "Levels", type: "number", default: 5, min: 2, max: 16, step: 1 },
	],
	renderer: {
		passes: [{
			shader: "posterize",
			uniforms: ({ effectParams }) => ({
				u_params: buildParams([num(effectParams, "levels", 5)]),
			}),
		}],
	},
};

export const halftoneEffectDefinition: EffectDefinition = {
	type: "halftone",
	name: "Halftone",
	keywords: ["halftone", "dots", "newspaper", "comic"],
	params: [
		{ key: "dotSize",   label: "Dot Size",  type: "number", default: 8,   min: 2, max: 40, step: 0.5 },
		{ key: "angle",     label: "Angle",     type: "number", default: 0,   min: -180, max: 180, step: 1 },
		{ key: "mix",       label: "Mix",       type: "number", default: 1,   min: 0, max: 1, step: 0.01 },
		{ key: "inkColor",  label: "Ink Color", type: "color",  default: "#111111" },
		{ key: "useColor",  label: "Preserve Color", type: "number", default: 0, min: 0, max: 1, step: 0.01 },
	],
	renderer: {
		passes: [{
			shader: "halftone",
			uniforms: ({ effectParams }) => {
				const ink = resolveColor({ color: str(effectParams, "inkColor", "#111111") });
				return {
					u_params: buildParams([
						num(effectParams, "dotSize", 8),
						(num(effectParams, "angle") * Math.PI) / 180,
						num(effectParams, "mix", 1),
						0,
						ink[0], ink[1], ink[2],
						num(effectParams, "useColor"),
					]),
				};
			},
		}],
	},
};

export const thresholdEffectDefinition: EffectDefinition = {
	type: "threshold",
	name: "Threshold",
	keywords: ["threshold", "bw", "high-contrast", "1bit"],
	params: [
		{ key: "cutoff",     label: "Cutoff",     type: "number", default: 0.5,  min: 0, max: 1, step: 0.01 },
		{ key: "smoothness", label: "Smoothness", type: "number", default: 0.02, min: 0, max: 0.5, step: 0.01 },
		{ key: "blackColor", label: "Dark Color", type: "color",  default: "#000000" },
		{ key: "whiteColor", label: "Light Color", type: "color", default: "#ffffff" },
	],
	renderer: {
		passes: [{
			shader: "threshold",
			uniforms: ({ effectParams }) => {
				const dark = resolveColor({ color: str(effectParams, "blackColor", "#000000") });
				const light = resolveColor({ color: str(effectParams, "whiteColor", "#ffffff"), fallback: [1, 1, 1] });
				return {
					u_params: buildParams([
						num(effectParams, "cutoff", 0.5),
						num(effectParams, "smoothness", 0.02),
						0, 0,
						dark[0], dark[1], dark[2], 0,
						light[0], light[1], light[2], 0,
					]),
				};
			},
		}],
	},
};

export const edgeDetectEffectDefinition: EffectDefinition = {
	type: "edge-detect",
	name: "Edge Detect",
	keywords: ["edge", "outline", "sobel", "comic"],
	params: [
		{ key: "strength",  label: "Strength",  type: "number", default: 1.5,  min: 0, max: 5, step: 0.1 },
		{ key: "thickness", label: "Thickness", type: "number", default: 1,    min: 1, max: 4, step: 1 },
		{ key: "mix",       label: "Mix",       type: "number", default: 1,    min: 0, max: 1, step: 0.01 },
		{ key: "invert",    label: "Invert",    type: "number", default: 0,    min: 0, max: 1, step: 0.01 },
		{ key: "edgeColor", label: "Edge Color", type: "color", default: "#ffffff" },
		{ key: "baseColor", label: "Base Color", type: "color", default: "#000000" },
	],
	renderer: {
		passes: [{
			shader: "edge-detect",
			uniforms: ({ effectParams }) => {
				const edge = resolveColor({ color: str(effectParams, "edgeColor", "#ffffff"), fallback: [1, 1, 1] });
				const base = resolveColor({ color: str(effectParams, "baseColor", "#000000") });
				return {
					u_params: buildParams([
						num(effectParams, "strength", 1.5),
						num(effectParams, "thickness", 1),
						num(effectParams, "mix", 1),
						num(effectParams, "invert"),
						edge[0], edge[1], edge[2], 0,
						base[0], base[1], base[2], 0,
					]),
				};
			},
		}],
	},
};

export const embossEffectDefinition: EffectDefinition = {
	type: "emboss",
	name: "Emboss",
	keywords: ["emboss", "raised", "stamp"],
	params: [
		{ key: "strength", label: "Strength", type: "number", default: 1.5, min: 0, max: 4, step: 0.1 },
		{ key: "angle",    label: "Angle",    type: "number", default: 45,  min: -180, max: 180, step: 1 },
		{ key: "mix",      label: "Mix",      type: "number", default: 1,   min: 0, max: 1, step: 0.01 },
	],
	renderer: {
		passes: [{
			shader: "emboss",
			uniforms: ({ effectParams }) => ({
				u_params: buildParams([
					num(effectParams, "strength", 1.5),
					(num(effectParams, "angle", 45) * Math.PI) / 180,
					num(effectParams, "mix", 1),
				]),
			}),
		}],
	},
};

export const invertEffectDefinition: EffectDefinition = {
	type: "invert",
	name: "Invert",
	keywords: ["invert", "negative"],
	params: [
		{ key: "amount", label: "Amount", type: "number", default: 1, min: 0, max: 1, step: 0.01 },
	],
	renderer: {
		passes: [{
			shader: "invert",
			uniforms: ({ effectParams }) => ({
				u_params: buildParams([num(effectParams, "amount", 1)]),
			}),
		}],
	},
};

export const sharpenEffectDefinition: EffectDefinition = {
	type: "sharpen",
	name: "Sharpen",
	keywords: ["sharpen", "crisp", "detail"],
	params: [
		{ key: "amount", label: "Amount", type: "number", default: 0.8, min: 0, max: 3, step: 0.05 },
	],
	renderer: {
		passes: [{
			shader: "sharpen",
			uniforms: ({ effectParams }) => ({
				u_params: buildParams([num(effectParams, "amount", 0.8)]),
			}),
		}],
	},
};

export const stylizeDefinitions: EffectDefinition[] = [
	pixelateEffectDefinition,
	posterizeEffectDefinition,
	halftoneEffectDefinition,
	thresholdEffectDefinition,
	edgeDetectEffectDefinition,
	embossEffectDefinition,
	invertEffectDefinition,
	sharpenEffectDefinition,
];
