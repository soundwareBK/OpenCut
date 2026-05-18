// CRT-style scanlines.
// params[0].x = density     (line frequency, 100..1500)
// params[0].y = darkness    (0..1, amount of black between lines)
// params[0].z = curvature   (0..0.5, barrel distortion)
// params[0].w = roll_speed  (0..2, vertical drift; uses u_time)

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

    // Curvature: simple barrel distortion
    let curv = clamp(u.p0.z, 0.0, 0.5);
    if (curv > 0.001) {
        let c = uv - 0.5;
        let r2 = dot(c, c);
        uv = 0.5 + c * (1.0 + r2 * curv);
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            return vec4f(0.0, 0.0, 0.0, 1.0);
        }
    }

    let src = textureSample(input_texture, input_sampler, uv);
    let y = uv.y * max(u.p0.x, 1.0) + u.time.x * u.p0.w;
    let line = 0.5 + 0.5 * sin(y * 6.2831853);
    let dark = mix(1.0, line, clamp(u.p0.y, 0.0, 1.0));
    return vec4f(src.rgb * dark, src.a);
}
