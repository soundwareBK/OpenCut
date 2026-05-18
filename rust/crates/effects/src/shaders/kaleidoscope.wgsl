// Kaleidoscope (radial symmetry).
// params[0].x = segments    (2..32)
// params[0].y = angle_off   (radians)
// params[0].zw = center

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
    let center = u.p0.zw;
    let aspect = u.resolution.x / max(u.resolution.y, 1.0);
    var d = input.tex_coord - center;
    d.x = d.x * aspect;
    let r = length(d);
    let segments = max(u.p0.x, 2.0);
    let seg = 6.2831853 / segments;
    var theta = atan2(d.y, d.x) + u.p0.y;
    theta = theta - seg * floor(theta / seg);
    theta = abs(theta - seg * 0.5);
    var nd = vec2f(cos(theta), sin(theta)) * r;
    nd.x = nd.x / aspect;
    return textureSample(input_texture, input_sampler, center + nd);
}
