import type { EffectDefinition } from "@/effects/types";
import { buildParams, nowSeconds, num, resolveColor, str } from "@/effects/shader-helpers";

export const vignetteEffectDefinition: EffectDefinition = {
	type: "vignette",
	name: "Vignette",
	keywords: ["vignette", "edge", "darken", "frame"],
	params: [
		{ key: "amount",    label: "Amount",    type: "number", default: 0.6,  min: 0, max: 1, step: 0.01 },
		{ key: "size",      label: "Size",      type: "number", default: 0.4,  min: 0, max: 1, step: 0.01 },
		{ key: "softness",  label: "Softness",  type: "number", default: 0.4,  min: 0, max: 1, step: 0.01 },
		{ key: "roundness", label: "Roundness", type: "number", default: 0.3,  min: 0, max: 1, step: 0.01 },
		{ key: "color",     label: "Color",     type: "color",  default: "#000000" },
	],
	renderer: {
		passes: [{
			shader: "vignette",
			uniforms: ({ effectParams }) => {
				const col = resolveColor({ color: str(effectParams, "color", "#000000") });
				return {
					u_params: buildParams([
						num(effectParams, "amount", 0.6),
						num(effectParams, "size", 0.4),
						num(effectParams, "softness", 0.4),
						num(effectParams, "roundness", 0.3),
						col[0], col[1], col[2], 0,
					]),
				};
			},
		}],
	},
};

export const glowEffectDefinition: EffectDefinition = {
	type: "glow",
	name: "Glow",
	keywords: ["glow", "bloom", "dream", "light"],
	params: [
		{ key: "threshold", label: "Threshold", type: "number", default: 0.6, min: 0,  max: 1, step: 0.01 },
		{ key: "intensity", label: "Intensity", type: "number", default: 1.0, min: 0,  max: 3, step: 0.05 },
		{ key: "radius",    label: "Radius",    type: "number", default: 12,  min: 1,  max: 40, step: 1 },
		{ key: "tintAmount", label: "Tint",     type: "number", default: 0,   min: 0,  max: 1, step: 0.01 },
		{ key: "tintColor", label: "Tint Color", type: "color", default: "#ffffff" },
	],
	renderer: {
		passes: [{
			shader: "glow",
			uniforms: ({ effectParams }) => {
				const col = resolveColor({ color: str(effectParams, "tintColor", "#ffffff"), fallback: [1, 1, 1] });
				return {
					u_params: buildParams([
						num(effectParams, "threshold", 0.6),
						num(effectParams, "intensity", 1),
						num(effectParams, "radius", 12),
						num(effectParams, "tintAmount"),
						col[0], col[1], col[2], 0,
					]),
				};
			},
		}],
	},
};

export const filmGrainEffectDefinition: EffectDefinition = {
	type: "film-grain",
	name: "Film Grain",
	keywords: ["grain", "noise", "film", "analog"],
	params: [
		{ key: "intensity",  label: "Intensity",   type: "number", default: 0.3, min: 0, max: 1, step: 0.01 },
		{ key: "size",       label: "Grain Size",  type: "number", default: 1.5, min: 0.5, max: 4, step: 0.1 },
		{ key: "shadowLift", label: "Shadow Bias", type: "number", default: 0.3, min: 0, max: 1, step: 0.01 },
		{ key: "colored",    label: "Color",       type: "number", default: 0,   min: 0, max: 1, step: 0.01 },
	],
	renderer: {
		passes: [{
			shader: "film-grain",
			uniforms: ({ effectParams }) => ({
				u_time: nowSeconds(),
				u_params: buildParams([
					num(effectParams, "intensity", 0.3),
					num(effectParams, "size", 1.5),
					num(effectParams, "shadowLift", 0.3),
					num(effectParams, "colored"),
				]),
			}),
		}],
	},
};

export const duotoneEffectDefinition: EffectDefinition = {
	type: "duotone",
	name: "Duotone",
	keywords: ["duotone", "2-color", "spotify"],
	params: [
		{ key: "mix",         label: "Mix",         type: "number", default: 1,    min: 0, max: 1, step: 0.01 },
		{ key: "contrast",    label: "Contrast",    type: "number", default: 1,    min: 0, max: 2, step: 0.05 },
		{ key: "shadowColor", label: "Shadow Color", type: "color", default: "#0a0a3a" },
		{ key: "highlightColor", label: "Highlight Color", type: "color", default: "#ff66cc" },
	],
	renderer: {
		passes: [{
			shader: "duotone",
			uniforms: ({ effectParams }) => {
				const sh = resolveColor({ color: str(effectParams, "shadowColor", "#0a0a3a") });
				const hi = resolveColor({ color: str(effectParams, "highlightColor", "#ff66cc"), fallback: [1, 1, 1] });
				return {
					u_params: buildParams([
						num(effectParams, "mix", 1),
						num(effectParams, "contrast", 1),
						0, 0,
						sh[0], sh[1], sh[2], 0,
						hi[0], hi[1], hi[2], 0,
					]),
				};
			},
		}],
	},
};

/** Locked-palette duotone presets — single mix slider exposed. */
function duotonePreset({ type, name, shadow, highlight }: { type: string; name: string; shadow: string; highlight: string }): EffectDefinition {
	return {
		type, name,
		keywords: ["duotone", "preset", "palette"],
		params: [{ key: "mix", label: "Mix", type: "number", default: 1, min: 0, max: 1, step: 0.01 }],
		renderer: {
			passes: [{
				shader: "duotone",
				uniforms: ({ effectParams }) => {
					const sh = resolveColor({ color: shadow });
					const hi = resolveColor({ color: highlight, fallback: [1, 1, 1] });
					return {
						u_params: buildParams([
							num(effectParams, "mix", 1), 1, 0, 0,
							sh[0], sh[1], sh[2], 0,
							hi[0], hi[1], hi[2], 0,
						]),
					};
				},
			}],
		},
	};
}

/** Locked-tint vignette presets. */
function vignettePreset({ type, name, amount, size, softness, roundness, color = "#000000" }: { type: string; name: string; amount: number; size: number; softness: number; roundness: number; color?: string }): EffectDefinition {
	return {
		type, name,
		keywords: ["vignette", "preset"],
		params: [{ key: "intensity", label: "Intensity", type: "number", default: 1, min: 0, max: 1.5, step: 0.01 }],
		renderer: {
			passes: [{
				shader: "vignette",
				uniforms: ({ effectParams }) => {
					const col = resolveColor({ color });
					const k = num(effectParams, "intensity", 1);
					return {
						u_params: buildParams([
							amount * k, size, softness, roundness,
							col[0], col[1], col[2], 0,
						]),
					};
				},
			}],
		},
	};
}

/** Glow presets with locked tint colors. */
function glowPreset({ type, name, threshold, intensity, radius, color }: { type: string; name: string; threshold: number; intensity: number; radius: number; color: string }): EffectDefinition {
	return {
		type, name,
		keywords: ["glow", "preset", "light"],
		params: [{ key: "intensity", label: "Intensity", type: "number", default: 1, min: 0, max: 2, step: 0.01 }],
		renderer: {
			passes: [{
				shader: "glow",
				uniforms: ({ effectParams }) => {
					const col = resolveColor({ color, fallback: [1, 1, 1] });
					const k = num(effectParams, "intensity", 1);
					return {
						u_params: buildParams([
							threshold,
							intensity * k,
							radius,
							1,
							col[0], col[1], col[2], 0,
						]),
					};
				},
			}],
		},
	};
}

export const lightDefinitions: EffectDefinition[] = [
	vignetteEffectDefinition,
	glowEffectDefinition,
	filmGrainEffectDefinition,
	duotoneEffectDefinition,

	// Duotone preset palettes
	duotonePreset({ type: "duo-spotify", name: "Duotone: Spotify",  shadow: "#1ed760", highlight: "#062017" }),
	duotonePreset({ type: "duo-cyber",   name: "Duotone: Cyber",    shadow: "#0a003a", highlight: "#ff00aa" }),
	duotonePreset({ type: "duo-sunset",  name: "Duotone: Sunset",   shadow: "#3d0a4a", highlight: "#ffb84d" }),
	duotonePreset({ type: "duo-ocean",   name: "Duotone: Ocean",    shadow: "#001a33", highlight: "#66e0ff" }),
	duotonePreset({ type: "duo-forest",  name: "Duotone: Forest",   shadow: "#0a1f0a", highlight: "#c4ff99" }),
	duotonePreset({ type: "duo-noir",    name: "Duotone: Noir",     shadow: "#000000", highlight: "#ffffff" }),
	duotonePreset({ type: "duo-blueprint", name: "Duotone: Blueprint", shadow: "#0a1a4a", highlight: "#ffffff" }),
	duotonePreset({ type: "duo-rose",    name: "Duotone: Rose",     shadow: "#330011", highlight: "#ffccd9" }),
	duotonePreset({ type: "duo-electric", name: "Duotone: Electric", shadow: "#1a0033", highlight: "#ffff00" }),
	duotonePreset({ type: "duo-cherry",  name: "Duotone: Cherry",   shadow: "#1a0000", highlight: "#ff3344" }),

	// Vignette presets
	vignettePreset({ type: "vign-soft", name: "Vignette: Soft", amount: 0.35, size: 0.5, softness: 0.5, roundness: 0.2 }),
	vignettePreset({ type: "vign-strong", name: "Vignette: Strong", amount: 0.85, size: 0.3, softness: 0.3, roundness: 0.4 }),
	vignettePreset({ type: "vign-circle", name: "Vignette: Circular", amount: 0.7, size: 0.25, softness: 0.2, roundness: 1.0 }),
	vignettePreset({ type: "vign-white", name: "Vignette: White", amount: 0.5, size: 0.4, softness: 0.5, roundness: 0.3, color: "#ffffff" }),
	vignettePreset({ type: "vign-blue", name: "Vignette: Blue", amount: 0.6, size: 0.35, softness: 0.4, roundness: 0.3, color: "#0a2540" }),

	// Glow presets
	glowPreset({ type: "glow-warm",  name: "Glow: Warm",  threshold: 0.5, intensity: 1.2, radius: 14, color: "#ffd9a3" }),
	glowPreset({ type: "glow-cool",  name: "Glow: Cool",  threshold: 0.5, intensity: 1.2, radius: 14, color: "#a3d9ff" }),
	glowPreset({ type: "glow-neon-pink", name: "Glow: Neon Pink", threshold: 0.4, intensity: 1.8, radius: 20, color: "#ff5cc1" }),
	glowPreset({ type: "glow-neon-cyan", name: "Glow: Neon Cyan", threshold: 0.4, intensity: 1.8, radius: 20, color: "#5cf3ff" }),
	glowPreset({ type: "glow-dream", name: "Glow: Dream", threshold: 0.3, intensity: 0.8, radius: 30, color: "#ffffff" }),
	glowPreset({ type: "glow-hellfire", name: "Glow: Hellfire", threshold: 0.5, intensity: 2.0, radius: 18, color: "#ff3a00" }),
];
