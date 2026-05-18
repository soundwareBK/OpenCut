// Sobel edge detection.
// params[0].x = strength    (0..5)
// params[0].y = thickness   (1..4 in pixels)
// params[0].z = mix         (0..1, blend with original)
// params[0].w = invert      (0..1, 1=dark edges on light bg)
// params[1].xyz = edge color
// params[2].xyz = base color (when mix < 1)

struct VertexOutput { @builtin(position) position: vec4f, @location(0) tex_coord: vec2f }
struct EffectUniforms {
    resolution: vec2f, time: vec2f, direction: vec2f, _pad: vec2f,
    p0: vec4f, p1: vec4f, p2: vec4f, p3: vec4f, p4: vec4f, p5: vec4f, p6: vec4f, p7: vec4f,
}
@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var input_sampler: sampler;
@group(1) @binding(0) var<uniform> u: EffectUniforms;

fn luma(uv: vec2f) -> f32 {
    let c = textureSample(input_texture, input_sampler, uv).rgb;
    return dot(c, vec3f(0.299, 0.587, 0.114));
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let src = textureSample(input_texture, input_sampler, input.tex_coord);
    let t = (vec2f(1.0) / u.resolution) * max(u.p0.y, 1.0);

    let tl = luma(input.tex_coord + vec2f(-t.x,  t.y));
    let tm = luma(input.tex_coord + vec2f(   0.0,  t.y));
    let tr = luma(input.tex_coord + vec2f( t.x,  t.y));
    let ml = luma(input.tex_coord + vec2f(-t.x,  0.0));
    let mr = luma(input.tex_coord + vec2f( t.x,  0.0));
    let bl = luma(input.tex_coord + vec2f(-t.x, -t.y));
    let bm = luma(input.tex_coord + vec2f(   0.0, -t.y));
    let br = luma(input.tex_coord + vec2f( t.x, -t.y));

    let gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
    let gy = -tl - 2.0 * tm - tr + bl + 2.0 * bm + br;
    var edge = clamp(sqrt(gx * gx + gy * gy) * u.p0.x, 0.0, 1.0);
    let inv = clamp(u.p0.w, 0.0, 1.0);
    edge = mix(edge, 1.0 - edge, inv);

    let bg = mix(src.rgb, u.p2.rgb, clamp(u.p0.z, 0.0, 1.0));
    return vec4f(mix(bg, u.p1.rgb, edge), src.a);
}
