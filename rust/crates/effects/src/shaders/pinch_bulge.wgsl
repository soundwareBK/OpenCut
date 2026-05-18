// Pinch / bulge — radial UV distortion around a center.
// params[0].x = strength   (-1..1; positive=bulge, negative=pinch)
// params[0].y = radius     (0..1, in shorter-axis units)
// params[0].zw = center    (UV space, default 0.5 0.5)

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

    let pct = dist / radius;
    // strength>0 bulges outward, <0 pinches inward
    let warp = mix(1.0, pow(pct, 1.0 - u.p0.x), smoothstep(0.0, 1.0, 1.0 - pct));
    let new_dist = warp * radius * (pct);

    var nd = normalize(d) * new_dist;
    nd.x = nd.x / aspect;
    return textureSample(input_texture, input_sampler, center + nd);
}
