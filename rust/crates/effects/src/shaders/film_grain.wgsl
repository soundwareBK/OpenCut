// Animated film grain.
// params[0].x = intensity     (0..1)
// params[0].y = size          (0.5..4, grain cell size)
// params[0].z = luma_amount   (0..1, more grain in shadows when high)
// params[0].w = colored       (0..1, 0=mono grain, 1=RGB grain)
// u_time.x = seconds (for animated noise)

struct VertexOutput { @builtin(position) position: vec4f, @location(0) tex_coord: vec2f }
struct EffectUniforms {
    resolution: vec2f, time: vec2f, direction: vec2f, _pad: vec2f,
    p0: vec4f, p1: vec4f, p2: vec4f, p3: vec4f, p4: vec4f, p5: vec4f, p6: vec4f, p7: vec4f,
}
@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var input_sampler: sampler;
@group(1) @binding(0) var<uniform> u: EffectUniforms;

fn hash3(p: vec3f) -> f32 {
    let q = fract(p * vec3f(443.8975, 397.2973, 491.1871));
    let r = q + dot(q, q.yxz + 19.19);
    return fract((r.x + r.y) * r.z);
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let src = textureSample(input_texture, input_sampler, input.tex_coord);
    let size = max(u.p0.y, 0.0001);
    let cell = floor(input.tex_coord * u.resolution / size);
    let t = u.time.x;

    let mono = hash3(vec3f(cell, t * 13.7)) - 0.5;
    let rg = hash3(vec3f(cell + vec2f(11.0, 0.0), t * 7.3)) - 0.5;
    let bg = hash3(vec3f(cell + vec2f(0.0, 17.0), t * 5.9)) - 0.5;
    let grain_color = mix(vec3f(mono), vec3f(mono * 0.3 + rg, mono * 0.3 + bg * 0.5, mono * 0.3 - rg * 0.4), clamp(u.p0.w, 0.0, 1.0));

    // shadow-weighted intensity
    let l = dot(src.rgb, vec3f(0.299, 0.587, 0.114));
    let shadow_weight = mix(1.0, 1.0 - l, clamp(u.p0.z, 0.0, 1.0));

    let amt = clamp(u.p0.x, 0.0, 2.0) * shadow_weight;
    return vec4f(src.rgb + grain_color * amt, src.a);
}
