// Emboss — directional difference baked onto gray.
// params[0].x = strength    (0..4)
// params[0].y = angle       (radians)
// params[0].z = mix         (0..1)

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
    let dir = vec2f(cos(u.p0.y), sin(u.p0.y)) * texel * 2.0;
    let a = textureSample(input_texture, input_sampler, input.tex_coord - dir).rgb;
    let b = textureSample(input_texture, input_sampler, input.tex_coord + dir).rgb;
    let diff = (b - a) * u.p0.x;
    let gray = vec3f(0.5) + diff;
    let src = textureSample(input_texture, input_sampler, input.tex_coord);
    return vec4f(mix(src.rgb, gray, clamp(u.p0.z, 0.0, 1.0)), src.a);
}
