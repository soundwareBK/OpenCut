// Ordered dither (8x8 Bayer) — retro 1-bit / low-bit look.
// params[0].x = levels    (2..16)
// params[0].y = scale     (1..8 pixels per dither cell)
// params[0].z = mix       (0..1)

struct VertexOutput { @builtin(position) position: vec4f, @location(0) tex_coord: vec2f }
struct EffectUniforms {
    resolution: vec2f, time: vec2f, direction: vec2f, _pad: vec2f,
    p0: vec4f, p1: vec4f, p2: vec4f, p3: vec4f, p4: vec4f, p5: vec4f, p6: vec4f, p7: vec4f,
}
@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var input_sampler: sampler;
@group(1) @binding(0) var<uniform> u: EffectUniforms;

fn bayer8(p: vec2i) -> f32 {
    // 8x8 Bayer matrix, normalized 0..1. `var` (not `let`) so dynamic indexing is supported.
    var m = array<f32, 64>(
         0.0, 32.0,  8.0, 40.0,  2.0, 34.0, 10.0, 42.0,
        48.0, 16.0, 56.0, 24.0, 50.0, 18.0, 58.0, 26.0,
        12.0, 44.0,  4.0, 36.0, 14.0, 46.0,  6.0, 38.0,
        60.0, 28.0, 52.0, 20.0, 62.0, 30.0, 54.0, 22.0,
         3.0, 35.0, 11.0, 43.0,  1.0, 33.0,  9.0, 41.0,
        51.0, 19.0, 59.0, 27.0, 49.0, 17.0, 57.0, 25.0,
        15.0, 47.0,  7.0, 39.0, 13.0, 45.0,  5.0, 37.0,
        63.0, 31.0, 55.0, 23.0, 61.0, 29.0, 53.0, 21.0,
    );
    let px = ((p.x % 8) + 8) % 8;
    let py = ((p.y % 8) + 8) % 8;
    let i = py * 8 + px;
    return m[i] / 64.0;
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let src = textureSample(input_texture, input_sampler, input.tex_coord);
    let scale = max(u.p0.y, 1.0);
    let pix = vec2i(floor(input.tex_coord * u.resolution / scale));
    let t = bayer8(pix) - 0.5;
    let levels = max(u.p0.x, 2.0);
    let stepped = floor(src.rgb * levels + t) / max(levels - 1.0, 1.0);
    return vec4f(mix(src.rgb, clamp(stepped, vec3f(0.0), vec3f(1.0)), clamp(u.p0.z, 0.0, 1.0)), src.a);
}
