// Soft glow / bloom approximation in a single pass: extract bright pixels
// and blur them with a fixed 9-tap radial kernel, then screen-blend over the source.
// For a true bloom, chain this after a gaussian-blur pass on a brightness-thresholded copy;
// for an in-place "dreamy" look this single-pass is enough.
// params[0].x = threshold   (0..1; brightness below this is ignored)
// params[0].y = intensity   (0..3; how much glow to add)
// params[0].z = radius      (1..40; sample spread in pixels)
// params[0].w = tint        (0..1; how strongly to apply tint color)
// params[1].xyz = tint color

struct VertexOutput { @builtin(position) position: vec4f, @location(0) tex_coord: vec2f }
struct EffectUniforms {
    resolution: vec2f, time: vec2f, direction: vec2f, _pad: vec2f,
    p0: vec4f, p1: vec4f, p2: vec4f, p3: vec4f, p4: vec4f, p5: vec4f, p6: vec4f, p7: vec4f,
}
@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var input_sampler: sampler;
@group(1) @binding(0) var<uniform> u: EffectUniforms;

fn bright_pass(c: vec3f, t: f32) -> vec3f {
    let l = dot(c, vec3f(0.299, 0.587, 0.114));
    let k = max(l - t, 0.0) / max(1.0 - t, 0.0001);
    return c * k;
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let src = textureSample(input_texture, input_sampler, input.tex_coord);
    let texel = vec2f(1.0) / u.resolution * max(u.p0.z, 1.0);

    var acc = vec3f(0.0);
    var w = 0.0;
    // 16-tap radial pattern
    for (var i = 0; i < 16; i = i + 1) {
        let a = f32(i) / 16.0 * 6.2831853;
        for (var r = 1; r <= 3; r = r + 1) {
            let off = vec2f(cos(a), sin(a)) * f32(r);
            let s = textureSample(input_texture, input_sampler, input.tex_coord + texel * off).rgb;
            let weight = 1.0 / f32(r);
            acc = acc + bright_pass(s, u.p0.x) * weight;
            w = w + weight;
        }
    }
    var glow = acc / max(w, 0.0001) * u.p0.y;
    glow = mix(glow, glow * u.p1.rgb, clamp(u.p0.w, 0.0, 1.0));

    // screen blend
    let out_color = 1.0 - (1.0 - src.rgb) * (1.0 - glow);
    return vec4f(out_color, src.a);
}
