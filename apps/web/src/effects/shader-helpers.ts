import type { LinearRgba } from "@/params";
import { parseColorToLinearRgba } from "@/params";
import type { ParamValues } from "@/params";

/**
 * Build a flat u_params Float32 array for a shader.
 *
 * Each shader's WGSL header documents which params[i].xyzw it reads from.
 * Pass values in WGSL register order, padding with zeros where needed.
 *
 * Example:
 *   buildParams([0.2, 0.5, 0.0, 0.0,  // p0
 *                1.0, 0.0, 0.0, 0.0]) // p1
 */
export function buildParams(values: ReadonlyArray<number>): number[] {
	// pad up to a multiple of 4 (one vec4 register)
	const padded = values.slice();
	while (padded.length % 4 !== 0) padded.push(0);
	return padded;
}

/**
 * Resolve a hex/css color string to a vec3 (linear RGB) for shader uniforms.
 * Effects that take a color param ("color" type) store hex strings; shaders need linear floats.
 */
export function resolveColor({
	color,
	fallback = [0, 0, 0],
}: {
	color: string | undefined;
	fallback?: [number, number, number];
}): [number, number, number] {
	if (!color) return fallback;
	const rgba: LinearRgba | null = parseColorToLinearRgba({ color });
	if (!rgba) return fallback;
	return [rgba.r, rgba.g, rgba.b];
}

/**
 * Pull a number from a ParamValues blob with a default.
 * Effect param-callbacks receive ParamValues; this trims the type noise.
 */
export function num(params: ParamValues, key: string, fallback = 0): number {
	const v = params[key];
	if (typeof v === "number") return v;
	if (typeof v === "string") {
		const n = Number.parseFloat(v);
		return Number.isFinite(n) ? n : fallback;
	}
	return fallback;
}

/**
 * Pull a string (color/select/text) from ParamValues with a default.
 */
export function str(params: ParamValues, key: string, fallback = ""): string {
	const v = params[key];
	return typeof v === "string" ? v : fallback;
}

/**
 * Module-load timebase, in seconds — used by time-driven shaders (grain, vhs, scanlines, waves).
 * The renderer re-resolves uniforms each frame, so reading this inside a uniforms callback
 * yields fresh time on every render.
 */
const T0 = typeof performance !== "undefined" ? performance.now() : Date.now();
export function nowSeconds(): number {
	const now = typeof performance !== "undefined" ? performance.now() : Date.now();
	return (now - T0) / 1000;
}
