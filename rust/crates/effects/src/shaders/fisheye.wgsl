// Fisheye / barrel lens distortion.
// params[0].x = strength    (-1..1; positive=barrel, negative=pincushion)
// params[0].y = zoom        (0.5..1.5)

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
    var c = input.tex_coord - 0.5;
    let r2 = dot(c, c);
    let s = u.p0.x;
    c = c * (1.0 + s * r2) / max(u.p0.y, 0.01);
    let uv = c + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        return vec4f(0.0, 0.0, 0.0, 1.0);
    }
    return textureSample(input_texture, input_sampler, uv);
}
