// Sine wave displacement.
// params[0].x = amplitude    (0..0.1 in UV units)
// params[0].y = frequency    (1..40)
// params[0].z = speed        (-5..5; uses u_time)
// params[0].w = axis         (0=horizontal waves moving Y, 1=vertical, 0.5=both)

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
    let amp = u.p0.x;
    let freq = u.p0.y;
    let phase = u.time.x * u.p0.z;
    let axis = clamp(u.p0.w, 0.0, 1.0);

    let dx = sin(input.tex_coord.y * freq + phase) * amp * (1.0 - axis);
    let dy = sin(input.tex_coord.x * freq + phase) * amp * axis;
    let uv = input.tex_coord + vec2f(dx, dy);
    return textureSample(input_texture, input_sampler, uv);
}
