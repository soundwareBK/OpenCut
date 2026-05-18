// Halftone (newsprint / comic) — dot pattern with size driven by luminance.
// params[0].x = dot_size      (4..40 pixels per cell)
// params[0].y = angle         (radians; rotate the grid)
// params[0].z = mix           (0..1, blend with original)
// params[1].xyz = ink color
// params[1].w   = use_color   (0=tinted dots on white, 1=preserve original color)

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
    let l = dot(src.rgb, vec3f(0.299, 0.587, 0.114));

    let dot_size = max(u.p0.x, 2.0);
    let angle = u.p0.y;
    let c = cos(angle);
    let s = sin(angle);

    let pixel = input.tex_coord * u.resolution;
    let rotated = vec2f(pixel.x * c - pixel.y * s, pixel.x * s + pixel.y * c);
    let cell = fract(rotated / dot_size) - 0.5;
    let dist = length(cell) * 2.0;

    // dot radius scales with darkness: darker => larger dot
    let radius = sqrt(1.0 - l);
    let dot_mask = smoothstep(radius + 0.05, radius - 0.05, dist);

    let ink = u.p1.rgb;
    let bg = vec3f(1.0);
    var halftoned = mix(bg, ink, dot_mask);
    halftoned = mix(halftoned, src.rgb * dot_mask + bg * (1.0 - dot_mask), clamp(u.p1.w, 0.0, 1.0));

    return vec4f(mix(src.rgb, halftoned, clamp(u.p0.z, 0.0, 1.0)), src.a);
}
