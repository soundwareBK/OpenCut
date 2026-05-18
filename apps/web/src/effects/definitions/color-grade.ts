import type { EffectDefinition } from "@/effects/types";
import { buildParams, num, resolveColor, str } from "@/effects/shader-helpers";

const SHADER = "color-grade";

/**
 * Full-control color grading effect. Same shader powers every preset below;
 * presets are just `colorPreset(...)` calls with locked params.
 */
export const colorGradeEffectDefinition: EffectDefinition = {
	type: "color-grade",
	name: "Color Grade",
	keywords: ["color", "grade", "tone", "look", "lut", "filter"],
	params: [
		{ key: "brightness",  label: "Brightness",  type: "number", default: 0,    min: -1,   max: 1,  step: 0.01 },
		{ key: "contrast",    label: "Contrast",    type: "number", default: 0,    min: -1,   max: 1,  step: 0.01 },
		{ key: "saturation",  label: "Saturation",  type: "number", default: 0,    min: -1,   max: 1,  step: 0.01 },
		{ key: "exposure",    label: "Exposure",    type: "number", default: 0,    min: -2,   max: 2,  step: 0.01 },
		{ key: "gamma",       label: "Gamma",       type: "number", default: 1,    min: 0.2,  max: 3,  step: 0.01 },
		{ key: "hue",         label: "Hue",         type: "number", default: 0,    min: -180, max: 180, step: 1 },
		{ key: "temperature", label: "Temperature", type: "number", default: 0,    min: -1,   max: 1,  step: 0.01 },
		{ key: "tint",        label: "Tint",        type: "number", default: 0,    min: -1,   max: 1,  step: 0.01 },
		{ key: "vibrance",    label: "Vibrance",    type: "number", default: 0,    min: -1,   max: 1,  step: 0.01 },
		{ key: "lift",        label: "Lift",        type: "number", default: 0,    min: -1,   max: 1,  step: 0.01 },
		{ key: "gain",        label: "Gain",        type: "number", default: 0,    min: -1,   max: 1,  step: 0.01 },
		{ key: "fade",        label: "Fade",        type: "number", default: 0,    min: 0,    max: 1,  step: 0.01 },
		{ key: "tintColor",   label: "Tint Color",  type: "color",  default: "#ffffff" },
		{ key: "tintAmount",  label: "Tint Amount", type: "number", default: 0,    min: 0,    max: 1,  step: 0.01 },
	],
	renderer: {
		passes: [
			{
				shader: SHADER,
				uniforms: ({ effectParams }) => {
					const tint = resolveColor({ color: str(effectParams, "tintColor", "#ffffff"), fallback: [1, 1, 1] });
					return {
						u_params: buildParams([
							// p0: brightness, contrast, saturation, exposure
							num(effectParams, "brightness"),
							num(effectParams, "contrast"),
							num(effectParams, "saturation"),
							num(effectParams, "exposure"),
							// p1: gamma, hue, temp, tint
							num(effectParams, "gamma", 1),
							num(effectParams, "hue"),
							num(effectParams, "temperature"),
							num(effectParams, "tint"),
							// p2: vibrance, lift, gain, fade
							num(effectParams, "vibrance"),
							num(effectParams, "lift"),
							num(effectParams, "gain"),
							num(effectParams, "fade"),
							// p3: tint color rgb, tint amount
							tint[0], tint[1], tint[2],
							num(effectParams, "tintAmount"),
						]),
					};
				},
			},
		],
	},
};

/** Color-grade preset — same shader, locked params, single `intensity` slider that scales the look. */
interface ColorPresetParams {
	brightness?: number; contrast?: number; saturation?: number; exposure?: number;
	gamma?: number; hue?: number; temperature?: number; tint?: number;
	vibrance?: number; lift?: number; gain?: number; fade?: number;
	tintColor?: string; tintAmount?: number;
}
function colorPreset({
	type, name, keywords, preset,
}: {
	type: string;
	name: string;
	keywords: string[];
	preset: ColorPresetParams;
}): EffectDefinition {
	return {
		type,
		name,
		keywords: ["preset", "filter", "look", ...keywords],
		params: [
			{ key: "intensity", label: "Intensity", type: "number", default: 1, min: 0, max: 1.5, step: 0.01 },
		],
		renderer: {
			passes: [
				{
					shader: SHADER,
					uniforms: ({ effectParams }) => {
						const k = num(effectParams, "intensity", 1);
						const tint = resolveColor({ color: preset.tintColor ?? "#ffffff", fallback: [1, 1, 1] });
						return {
							u_params: buildParams([
								(preset.brightness  ?? 0) * k,
								(preset.contrast    ?? 0) * k,
								(preset.saturation  ?? 0) * k,
								(preset.exposure    ?? 0) * k,
								// gamma defaults to 1 — interpolate toward neutral as intensity drops
								1 + ((preset.gamma ?? 1) - 1) * k,
								(preset.hue         ?? 0) * k,
								(preset.temperature ?? 0) * k,
								(preset.tint        ?? 0) * k,
								(preset.vibrance    ?? 0) * k,
								(preset.lift        ?? 0) * k,
								(preset.gain        ?? 0) * k,
								(preset.fade        ?? 0) * k,
								tint[0], tint[1], tint[2],
								(preset.tintAmount  ?? 0) * k,
							]),
						};
					},
				},
			],
		},
	};
}

/**
 * Curated preset pack — Instagram / TikTok / cinematic looks built from the
 * color-grade shader's knobs. Each entry is a discrete effect in the picker.
 */
export const colorGradePresets: EffectDefinition[] = [
	// Instagram-style filters
	colorPreset({ type: "preset-clarendon", name: "Clarendon", keywords: ["instagram", "popular"], preset: { contrast: 0.18, saturation: 0.28, brightness: 0.05, vibrance: 0.2 } }),
	colorPreset({ type: "preset-gingham", name: "Gingham", keywords: ["instagram", "soft"], preset: { contrast: -0.1, saturation: -0.15, fade: 0.18, temperature: 0.08 } }),
	colorPreset({ type: "preset-moon", name: "Moon", keywords: ["bw", "monochrome"], preset: { saturation: -1, contrast: 0.15, brightness: 0.05 } }),
	colorPreset({ type: "preset-lark", name: "Lark", keywords: ["bright", "airy"], preset: { brightness: 0.08, vibrance: 0.25, temperature: -0.05, contrast: -0.05 } }),
	colorPreset({ type: "preset-reyes", name: "Reyes", keywords: ["vintage", "faded"], preset: { fade: 0.25, saturation: -0.2, brightness: 0.1, temperature: 0.12 } }),
	colorPreset({ type: "preset-juno", name: "Juno", keywords: ["warm", "vibrant"], preset: { saturation: 0.25, contrast: 0.12, temperature: 0.15, gain: 0.08 } }),
	colorPreset({ type: "preset-slumber", name: "Slumber", keywords: ["dreamy", "hazy"], preset: { fade: 0.2, saturation: -0.25, temperature: 0.18, exposure: -0.1 } }),
	colorPreset({ type: "preset-crema", name: "Crema", keywords: ["creamy", "warm"], preset: { saturation: -0.1, temperature: 0.2, brightness: 0.05, contrast: 0.05 } }),
	colorPreset({ type: "preset-ludwig", name: "Ludwig", keywords: ["editorial", "clean"], preset: { contrast: 0.15, saturation: -0.05, vibrance: 0.15, lift: -0.05 } }),
	colorPreset({ type: "preset-aden", name: "Aden", keywords: ["pastel", "soft"], preset: { fade: 0.15, saturation: -0.2, temperature: -0.08, lift: 0.1 } }),
	colorPreset({ type: "preset-perpetua", name: "Perpetua", keywords: ["fresh", "green"], preset: { saturation: 0.15, tint: -0.15, brightness: 0.05 } }),
	colorPreset({ type: "preset-amaro", name: "Amaro", keywords: ["bright", "warm"], preset: { brightness: 0.12, contrast: 0.05, temperature: 0.1, saturation: 0.2 } }),
	colorPreset({ type: "preset-mayfair", name: "Mayfair", keywords: ["warm", "pinkish"], preset: { temperature: 0.15, tint: 0.1, contrast: 0.1, vibrance: 0.15 } }),
	colorPreset({ type: "preset-rise", name: "Rise", keywords: ["golden", "soft"], preset: { brightness: 0.1, temperature: 0.2, saturation: -0.05, gain: 0.05 } }),
	colorPreset({ type: "preset-hudson", name: "Hudson", keywords: ["cool", "vintage"], preset: { temperature: -0.15, brightness: 0.05, contrast: 0.08, tintColor: "#a4c8ff", tintAmount: 0.12 } }),
	colorPreset({ type: "preset-valencia", name: "Valencia", keywords: ["warm", "fade"], preset: { temperature: 0.15, fade: 0.12, saturation: 0.05 } }),
	colorPreset({ type: "preset-xpro2", name: "X-Pro II", keywords: ["high-contrast", "vintage"], preset: { contrast: 0.3, saturation: 0.2, temperature: 0.1, vibrance: 0.15 } }),
	colorPreset({ type: "preset-sierra", name: "Sierra", keywords: ["soft", "muted"], preset: { fade: 0.2, contrast: -0.05, temperature: 0.05, saturation: -0.1 } }),
	colorPreset({ type: "preset-willow", name: "Willow", keywords: ["bw", "soft"], preset: { saturation: -0.9, brightness: 0.05, contrast: 0.05, tintColor: "#fff5e8", tintAmount: 0.15 } }),
	colorPreset({ type: "preset-lofi", name: "Lo-Fi", keywords: ["saturated", "shadowy"], preset: { saturation: 0.4, contrast: 0.25, exposure: -0.1 } }),

	// Cinematic looks
	colorPreset({ type: "preset-teal-orange", name: "Teal & Orange", keywords: ["cinematic", "hollywood"], preset: { temperature: 0.18, tint: -0.05, contrast: 0.15, saturation: 0.1, lift: 0.05, gain: -0.05, tintColor: "#ff9966", tintAmount: 0.08 } }),
	colorPreset({ type: "preset-bleach-bypass", name: "Bleach Bypass", keywords: ["cinematic", "harsh"], preset: { contrast: 0.35, saturation: -0.4, brightness: 0.05 } }),
	colorPreset({ type: "preset-day-for-night", name: "Day for Night", keywords: ["cinematic", "blue"], preset: { exposure: -0.6, temperature: -0.4, contrast: 0.15, tintColor: "#5b7aa3", tintAmount: 0.2 } }),
	colorPreset({ type: "preset-anamorphic", name: "Anamorphic", keywords: ["cinematic", "widescreen"], preset: { contrast: 0.1, vibrance: 0.18, temperature: 0.08, gain: 0.05 } }),
	colorPreset({ type: "preset-noir", name: "Film Noir", keywords: ["bw", "cinematic", "moody"], preset: { saturation: -1, contrast: 0.4, exposure: -0.1 } }),
	colorPreset({ type: "preset-faded-film", name: "Faded Film", keywords: ["vintage", "cinematic"], preset: { fade: 0.3, saturation: -0.15, temperature: 0.1, contrast: -0.1 } }),
	colorPreset({ type: "preset-kodachrome", name: "Kodachrome", keywords: ["film", "vintage"], preset: { saturation: 0.3, contrast: 0.2, temperature: 0.12, vibrance: 0.2 } }),
	colorPreset({ type: "preset-portra", name: "Portra 400", keywords: ["film", "portrait"], preset: { saturation: -0.05, temperature: 0.12, contrast: -0.05, lift: 0.05, fade: 0.08 } }),
	colorPreset({ type: "preset-ektachrome", name: "Ektachrome", keywords: ["film", "cool"], preset: { saturation: 0.15, temperature: -0.1, contrast: 0.1 } }),
	colorPreset({ type: "preset-cinestill-800t", name: "CineStill 800T", keywords: ["film", "tungsten"], preset: { temperature: -0.15, gain: 0.08, saturation: 0.05, contrast: 0.05 } }),
	colorPreset({ type: "preset-polaroid", name: "Polaroid", keywords: ["instant", "vintage"], preset: { fade: 0.22, saturation: -0.1, temperature: 0.15, lift: 0.08 } }),
	colorPreset({ type: "preset-sepia", name: "Sepia", keywords: ["antique", "brown"], preset: { saturation: -1, tintColor: "#d4a574", tintAmount: 0.6 } }),

	// Vibe-driven contemporary looks
	colorPreset({ type: "preset-cyberpunk", name: "Cyberpunk", keywords: ["neon", "magenta"], preset: { saturation: 0.5, contrast: 0.25, tint: 0.2, temperature: -0.1, tintColor: "#ff00aa", tintAmount: 0.15 } }),
	colorPreset({ type: "preset-vaporwave", name: "Vaporwave", keywords: ["pink", "purple", "80s"], preset: { saturation: 0.3, tint: 0.18, temperature: -0.05, tintColor: "#ff7ae5", tintAmount: 0.2 } }),
	colorPreset({ type: "preset-dreamy", name: "Dreamy", keywords: ["soft", "ethereal"], preset: { fade: 0.18, saturation: -0.1, exposure: 0.15, lift: 0.1 } }),
	colorPreset({ type: "preset-grit", name: "Grit", keywords: ["dark", "moody"], preset: { contrast: 0.3, saturation: -0.15, exposure: -0.15, gain: -0.1 } }),
	colorPreset({ type: "preset-sunset", name: "Sunset", keywords: ["warm", "golden"], preset: { temperature: 0.3, gain: 0.1, saturation: 0.2, hue: -5 } }),
	colorPreset({ type: "preset-arctic", name: "Arctic", keywords: ["cool", "blue"], preset: { temperature: -0.3, contrast: 0.15, brightness: 0.05, tintColor: "#cce8ff", tintAmount: 0.1 } }),
	colorPreset({ type: "preset-mint", name: "Mint", keywords: ["fresh", "green"], preset: { tint: -0.2, saturation: 0.15, brightness: 0.08 } }),
	colorPreset({ type: "preset-rose-gold", name: "Rose Gold", keywords: ["pink", "warm"], preset: { temperature: 0.18, tint: 0.12, gain: 0.08, tintColor: "#ffb19f", tintAmount: 0.15 } }),
	colorPreset({ type: "preset-matrix", name: "Matrix", keywords: ["green", "digital"], preset: { tint: -0.4, saturation: 0.3, contrast: 0.2, tintColor: "#00ff44", tintAmount: 0.2 } }),
	colorPreset({ type: "preset-blade-runner", name: "Blade Runner", keywords: ["neon", "blue", "orange"], preset: { temperature: 0.1, tint: -0.05, contrast: 0.25, saturation: 0.2, tintColor: "#ff6a3d", tintAmount: 0.1 } }),
];
