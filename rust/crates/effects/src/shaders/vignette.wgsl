// Radial vignette.
// params[0].x = amount        (0..1, darkness at corners)
// params[0].y = size          (0..1, inner radius where vignette starts)
// params[0].z = softness      (0..1, falloff width)
// params[0].w = roundness     (0..1, 0=full frame, 1=perfect circle)
// params[1].xyz = color       (vignette tint, usually black)

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
    var uv = input.tex_coord - 0.5;

    // Account for aspect — at roundness=1 we use square space; at 0 we keep full frame.
    let aspect = u.resolution.x / max(u.resolution.y, 1.0);
    let roundness = clamp(u.p0.w, 0.0, 1.0);
    uv.x = uv.x * mix(1.0, aspect, roundness);

    let dist = length(uv);
    let inner = max(u.p0.y, 0.01);
    let outer = inner + max(u.p0.z, 0.001);
    let v = smoothstep(inner, outer, dist) * clamp(u.p0.x, 0.0, 1.0);

    let tint = u.p1.rgb;
    return vec4f(mix(src.rgb, tint, v), src.a);
}
