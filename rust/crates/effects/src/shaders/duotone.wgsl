// Duotone — map luminance onto a gradient between two colors.
// params[0].x = mix     (0..1, blend with original)
// params[0].y = contrast (0..2, multiplies luminance before mapping)
// params[1].xyz = shadow color
// params[2].xyz = highlight color

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
    let src = textureSample(input_texture, input_sampler, input.tex_coord);
    let l = clamp(dot(src.rgb, vec3f(0.299, 0.587, 0.114)) * u.p0.y, 0.0, 1.0);
    let duo = mix(u.p1.rgb, u.p2.rgb, l);
    return vec4f(mix(src.rgb, duo, clamp(u.p0.x, 0.0, 1.0)), src.a);
}
