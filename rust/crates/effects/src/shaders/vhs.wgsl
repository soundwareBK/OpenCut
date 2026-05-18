// VHS look: chromatic aberration + scanlines + tape noise + horizontal warp.
// params[0].x = chroma_offset (0..20 px)
// params[0].y = scan_density  (200..1000)
// params[0].z = noise_amount  (0..1)
// params[0].w = warp_amount   (0..1 horizontal jitter)
// u_time.x = seconds

struct VertexOutput { @builtin(position) position: vec4f, @location(0) tex_coord: vec2f }
struct EffectUniforms {
    resolution: vec2f, time: vec2f, direction: vec2f, _pad: vec2f,
    p0: vec4f, p1: vec4f, p2: vec4f, p3: vec4f, p4: vec4f, p5: vec4f, p6: vec4f, p7: vec4f,
}
@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var input_sampler: sampler;
@group(1) @binding(0) var<uniform> u: EffectUniforms;

fn hash(p: vec2f) -> f32 {
    return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let texel = vec2f(1.0) / u.resolution;
    var uv = input.tex_coord;

    // horizontal tape warp
    let row = floor(uv.y * u.resolution.y / 4.0);
    let warp = (hash(vec2f(row, floor(u.time.x * 25.0))) - 0.5) * u.p0.w * 0.05;
    uv.x = uv.x + warp;

    // bigger horizontal jitter every few seconds
    let burst = step(0.97, hash(vec2f(floor(u.time.x * 8.0), 0.0)));
    uv.x = uv.x + burst * u.p0.w * 0.03 * (hash(vec2f(row, 7.0)) - 0.5);

    // chromatic offset
    let cx = u.p0.x * texel.x;
    let r = textureSample(input_texture, input_sampler, uv + vec2f(cx, 0.0)).r;
    let g = textureSample(input_texture, input_sampler, uv).g;
    let b = textureSample(input_texture, input_sampler, uv - vec2f(cx, 0.0)).b;
    var c = vec3f(r, g, b);

    // scanlines
    let line = 0.5 + 0.5 * sin(uv.y * max(u.p0.y, 1.0) * 3.14159);
    c = c * mix(1.0, line, 0.3);

    // analog noise overlay
    let noise = (hash(uv * u.resolution + u.time.x * 12.0) - 0.5) * u.p0.z * 0.4;
    c = c + noise;

    // VHS-y desaturation + warm tilt
    let l = dot(c, vec3f(0.299, 0.587, 0.114));
    c = mix(vec3f(l), c, 0.85);
    c = c + vec3f(0.04, 0.02, -0.02);

    return vec4f(c, 1.0);
}
