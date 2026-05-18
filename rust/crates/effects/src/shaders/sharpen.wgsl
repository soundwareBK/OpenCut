// Unsharp-mask sharpen (3x3 Laplacian).
// params[0].x = amount  (0..3)

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
    let c  = textureSample(input_texture, input_sampler, input.tex_coord);
    let n  = textureSample(input_texture, input_sampler, input.tex_coord + vec2f(0.0,  texel.y));
    let s_ = textureSample(input_texture, input_sampler, input.tex_coord + vec2f(0.0, -texel.y));
    let e  = textureSample(input_texture, input_sampler, input.tex_coord + vec2f( texel.x, 0.0));
    let w  = textureSample(input_texture, input_sampler, input.tex_coord + vec2f(-texel.x, 0.0));
    let blurred = (n + s_ + e + w) * 0.25;
    let amt = u.p0.x;
    return vec4f(clamp(c.rgb + (c.rgb - blurred.rgb) * amt, vec3f(0.0), vec3f(1.0)), c.a);
}
