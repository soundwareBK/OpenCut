// Hard threshold (black & white cutoff).
// params[0].x = cutoff      (0..1)
// params[0].y = smooth       (0..0.5, edge softness)
// params[1].xyz = black color
// params[2].xyz = white color

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
    let l = dot(src.rgb, vec3f(0.299, 0.587, 0.114));
    let t = u.p0.x;
    let soft = max(u.p0.y, 0.0);
    let v = smoothstep(t - soft, t + soft, l);
    return vec4f(mix(u.p1.rgb, u.p2.rgb, v), src.a);
}
