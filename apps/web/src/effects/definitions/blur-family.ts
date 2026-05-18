import type { EffectDefinition, EffectPass } from "@/effects/types";
import { buildGaussianBlurPasses, intensityToSigma } from "./blur";
import { num } from "@/effects/shader-helpers";

/**
 * Motion blur — gaussian blur restricted to a single direction.
 * Distinct from the base "Blur" effect (which is isotropic).
 */
export const motionBlurEffectDefinition: EffectDefinition = {
	type: "motion-blur",
	name: "Motion Blur",
	keywords: ["motion", "blur", "speed", "streak"],
	params: [
		{ key: "amount", label: "Amount", type: "number", default: 20, min: 0, max: 200, step: 1 },
		{ key: "angle",  label: "Angle",  type: "number", default: 0,  min: -180, max: 180, step: 1 },
	],
	renderer: {
		passes: [],
		buildPasses: ({ effectParams, width, height }): EffectPass[] => {
			const amount = num(effectParams, "amount", 20);
			if (amount < 0.001) return [];
			const angleRad = (num(effectParams, "angle") * Math.PI) / 180;
			const dx = Math.cos(angleRad);
			const dy = Math.sin(angleRad);
			const sigma = intensityToSigma({ intensity: amount, resolution: Math.max(width, height), reference: 1920 });
			// Reuse gaussian-blur shader but apply it only along the requested axis.
			const passes = buildGaussianBlurPasses({ sigmaX: sigma * Math.abs(dx), sigmaY: sigma * Math.abs(dy) });
			// buildGaussianBlurPasses emits separable x/y; override direction to the requested vector for a true directional blur
			return passes.map((p) => ({
				shader: p.shader,
				uniforms: {
					u_sigma: typeof p.uniforms.u_sigma === "number" ? p.uniforms.u_sigma : sigma,
					u_step: typeof p.uniforms.u_step === "number" ? p.uniforms.u_step : 1,
					u_direction: [dx, dy],
				},
			}));
		},
	},
};

/**
 * Box blur — visually similar to gaussian but with a square kernel; cheaper.
 * Implemented as a low-iteration gaussian for simplicity.
 */
export const boxBlurEffectDefinition: EffectDefinition = {
	type: "box-blur",
	name: "Box Blur",
	keywords: ["box", "blur", "soft"],
	params: [
		{ key: "intensity", label: "Intensity", type: "number", default: 10, min: 0, max: 60, step: 1 },
	],
	renderer: {
		passes: [],
		buildPasses: ({ effectParams, width, height }) => {
			const intensity = num(effectParams, "intensity", 10);
			const sigma = intensityToSigma({ intensity, resolution: width, reference: 1920 });
			return buildGaussianBlurPasses({ sigmaX: sigma, sigmaY: sigma });
		},
	},
};

export const blurFamilyDefinitions: EffectDefinition[] = [
	motionBlurEffectDefinition,
	boxBlurEffectDefinition,
];
