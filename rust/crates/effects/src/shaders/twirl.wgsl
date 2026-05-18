// Twirl / swirl around a center.
// params[0].x = angle      (radians; total rotation at center)
// params[0].y = radius     (0..1 UV)
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
    let dist = length(d);
    let radius = max(u.p0.y, 0.0001);
    if (dist > radius) {
        return textureSample(input_texture, input_sampler, input.tex_coord);
    }
    let pct = 1.0 - dist / radius;
    let angle = u.p0.x * pct * pct;
    let c = cos(angle);
    let s = sin(angle);
    var rd = vec2f(c * d.x - s * d.y, s * d.x + c * d.y);
    rd.x = rd.x / aspect;
    return textureSample(input_texture, input_sampler, center + rd);
}
