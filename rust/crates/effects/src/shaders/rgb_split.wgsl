// Chromatic aberration / RGB channel split.
// params[0].x = amount       (0..50, pixels of separation)
// params[0].y = angle        (radians; 0 = horizontal)
// params[0].z = radial       (0..1, 0=uniform, 1=scaled by distance from center)
// params[0].w = falloff      (1..4, exponent on radial)

struct VertexOutput { @builtin(position) position: vec4f, @location(0) tex_coord: vec2f }
struct EffectUniforms {
    resolution: vec2f, time: vec2f, direction: vec2f, _pad: vec2f,
    p0: vec4f, p1: vec4f, p2: vec4f, p3: vec4f, p4: vec4f, p5: vec4f, p6: vec4f, p7: vec4f,
}
@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var input_sampler: sampler;
@group(1) @binding(0) var<uniform> u: EffectUniforms;

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let texel = vec2f(1.0) / u.resolution;
    let angle = u.p0.y;
    let dir = vec2f(cos(angle), sin(angle));

    let centered = input.tex_coord - 0.5;
    let radial_amt = mix(1.0, pow(length(centered) * 2.0, max(u.p0.w, 0.01)), clamp(u.p0.z, 0.0, 1.0));
    let offset = dir * texel * u.p0.x * radial_amt;

    let r = textureSample(input_texture, input_sampler, input.tex_coord + offset).r;
    let g = textureSample(input_texture, input_sampler, input.tex_coord).g;
    let b = textureSample(input_texture, input_sampler, input.tex_coord - offset).b;
    let a = textureSample(input_texture, input_sampler, input.tex_coord).a;
    return vec4f(r, g, b, a);
}
