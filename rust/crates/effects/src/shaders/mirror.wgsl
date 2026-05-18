// Mirror — reflect across an axis.
// params[0].x = mode    (0=left-to-right, 1=right-to-left, 2=top-to-bottom, 3=bottom-to-top)

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
    var uv = input.tex_coord;
    let mode = i32(u.p0.x);
    if (mode == 0) { if (uv.x > 0.5) { uv.x = 1.0 - uv.x; } }
    else if (mode == 1) { if (uv.x < 0.5) { uv.x = 1.0 - uv.x; } }
    else if (mode == 2) { if (uv.y > 0.5) { uv.y = 1.0 - uv.y; } }
    else if (mode == 3) { if (uv.y < 0.5) { uv.y = 1.0 - uv.y; } }
    return textureSample(input_texture, input_sampler, uv);
}
