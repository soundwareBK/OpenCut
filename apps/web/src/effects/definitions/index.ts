import { effectsRegistry } from "../registry";
import type { EffectDefinition } from "@/effects/types";

import { blurEffectDefinition } from "./blur";
import { blurFamilyDefinitions } from "./blur-family";
import { colorGradeEffectDefinition, colorGradePresets } from "./color-grade";
import { distortionDefinitions } from "./distortion";
import { glitchDefinitions } from "./glitch";
import { stylizeDefinitions } from "./stylize";
import { lightDefinitions } from "./light";

const defaultEffects: EffectDefinition[] = [
	// Blur family
	blurEffectDefinition,
	...blurFamilyDefinitions,
	// Color grading (1 base + many presets)
	colorGradeEffectDefinition,
	...colorGradePresets,
	// Geometric distortion
	...distortionDefinitions,
	// Glitch / retro / animated
	...glitchDefinitions,
	// Stylize / artistic
	...stylizeDefinitions,
	// Lighting / atmosphere
	...lightDefinitions,
];

export function registerDefaultEffects(): void {
	for (const definition of defaultEffects) {
		if (effectsRegistry.has(definition.type)) {
			continue;
		}
		effectsRegistry.register({
			key: definition.type,
			definition,
		});
	}
}
