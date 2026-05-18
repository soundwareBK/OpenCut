// Master color grading shader. All the knobs an Instagram preset needs.
// params[0].x = brightness   (-1..1, additive on luminance)
// params[0].y = contrast     (-1..1, around 0.5 mid-grey)
// params[0].z = saturation   (-1..1)
// params[0].w = exposure     (-2..2, stops)
// params[1].x = gamma        (0.2..3, >1 darkens midtones, <1 brightens)
// params[1].y = hue          (-180..180, degrees)
// params[1].z = temperature  (-1..1, negative=cool/blue, positive=warm/orange)
// params[1].w = tint         (-1..1, negative=green, positive=magenta)
// params[2].x = vibrance     (-1..1, saturation that protects skin)
// params[2].y = lift         (-1..1, shadow brightness)
// params[2].z = gain         (-1..1, highlight brightness)
// params[2].w = fade         (0..1, lifted blacks / vintage roll-off)
// params[3].xyz = tintColor  (RGB 0..1, mixed by params[3].w intensity)
// params[3].w  = tintAmount  (0..1)

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) tex_coord: vec2f,
}
struct EffectUniforms {
    resolution: vec2f, time: vec2f, direction: vec2f, _pad: vec2f,
    p0: vec4f, p1: vec4f, p2: vec4f, p3: vec4f,
    p4: vec4f, p5: vec4f, p6: vec4f, p7: vec4f,
}
@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var input_sampler: sampler;
@group(1) @binding(0) var<uniform> u: EffectUniforms;

fn rgb_to_hsl(c: vec3f) -> vec3f {
    let mx = max(max(c.r, c.g), c.b);
    let mn = min(min(c.r, c.g), c.b);
    let l = (mx + mn) * 0.5;
    let d = mx - mn;
    var h = 0.0;
    var s = 0.0;
    if (d > 0.00001) {
        s = select(d / (2.0 - mx - mn), d / (mx + mn), l < 0.5);
        if (mx == c.r) { h = (c.g - c.b) / d + select(0.0, 6.0, c.g < c.b); }
        else if (mx == c.g) { h = (c.b - c.r) / d + 2.0; }
        else { h = (c.r - c.g) / d + 4.0; }
        h = h / 6.0;
    }
    return vec3f(h, s, l);
}
fn hue_to_rgb(p: f32, q: f32, t_in: f32) -> f32 {
    var t = t_in;
    if (t < 0.0) { t = t + 1.0; }
    if (t > 1.0) { t = t - 1.0; }
    if (t < 1.0 / 6.0) { return p + (q - p) * 6.0 * t; }
    if (t < 0.5) { return q; }
    if (t < 2.0 / 3.0) { return p + (q - p) * (2.0 / 3.0 - t) * 6.0; }
    return p;
}
fn hsl_to_rgb(c: vec3f) -> vec3f {
    if (c.y < 0.00001) { return vec3f(c.z); }
    let q = select(c.z + c.y - c.z * c.y, c.z * (1.0 + c.y), c.z < 0.5);
    let p = 2.0 * c.z - q;
    return vec3f(
        hue_to_rgb(p, q, c.x + 1.0 / 3.0),
        hue_to_rgb(p, q, c.x),
        hue_to_rgb(p, q, c.x - 1.0 / 3.0),
    );
}
fn luma(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    var src = textureSample(input_texture, input_sampler, input.tex_coord);
    var c = src.rgb;

    // exposure (stops)
    c = c * pow(2.0, u.p0.w);

    // temperature & tint (simple opponent shift)
    let temp = u.p1.z;
    let tint = u.p1.w;
    c.r = c.r + temp * 0.15;
    c.b = c.b - temp * 0.15;
    c.g = c.g + tint * 0.10;
    c.r = c.r - tint * 0.05;
    c.b = c.b - tint * 0.05;

    // brightness (additive)
    c = c + vec3f(u.p0.x);

    // contrast around 0.5
    c = (c - 0.5) * (1.0 + u.p0.y) + 0.5;

    // gamma
    let gamma = max(u.p1.x, 0.0001);
    c = pow(max(c, vec3f(0.0)), vec3f(1.0 / gamma));

    // lift (shadows) / gain (highlights)
    let lift = u.p2.y;
    let gain = u.p2.z;
    let l = luma(c);
    let shadow_mask = 1.0 - smoothstep(0.0, 0.5, l);
    let highlight_mask = smoothstep(0.5, 1.0, l);
    c = c + shadow_mask * lift * 0.3;
    c = c + highlight_mask * gain * 0.3;

    // fade (lifted blacks)
    let fade = u.p2.w;
    c = mix(c, c * (1.0 - fade) + vec3f(0.18 * fade), fade);

    // saturation
    let sat = 1.0 + u.p0.z;
    let avg = luma(c);
    c = mix(vec3f(avg), c, sat);

    // vibrance — boost desaturated colors more than already-saturated ones
    let vib = u.p2.x;
    if (abs(vib) > 0.001) {
        let mx = max(max(c.r, c.g), c.b);
        let mn = min(min(c.r, c.g), c.b);
        let amt = (mx - mn);
        let avg2 = luma(c);
        c = mix(vec3f(avg2), c, 1.0 + vib * (1.0 - amt));
    }

    // hue rotation (in HSL)
    if (abs(u.p1.y) > 0.001) {
        var hsl = rgb_to_hsl(clamp(c, vec3f(0.0), vec3f(1.0)));
        hsl.x = fract(hsl.x + u.p1.y / 360.0);
        c = hsl_to_rgb(hsl);
    }

    // tint color overlay (multiply blend modulated by intensity)
    let tint_amt = u.p3.w;
    if (tint_amt > 0.001) {
        let tinted = c * u.p3.rgb * 2.0;
        c = mix(c, tinted, tint_amt);
    }

    return vec4f(clamp(c, vec3f(0.0), vec3f(1.0)), src.a);
}
