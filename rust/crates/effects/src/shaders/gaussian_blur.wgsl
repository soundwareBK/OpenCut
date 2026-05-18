// Separable Gaussian blur.
// params[0].x = sigma  (Gaussian standard deviation, in pixels)
// params[0].y = step   (sample spacing in pixels; >1 broadens reach without more taps)
// u_direction = blur axis (1,0) for horizontal pass, (0,1) for vertical pass.

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) tex_coord: vec2f,
}

struct EffectUniforms {
    resolution: vec2f,
    time: vec2f,
    direction: vec2f,
    _pad: vec2f,
    p0: vec4f, p1: vec4f, p2: vec4f, p3: vec4f,
    p4: vec4f, p5: vec4f, p6: vec4f, p7: vec4f,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var input_sampler: sampler;
@group(1) @binding(0) var<uniform> u: EffectUniforms;

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let texel_size = vec2f(1.0, 1.0) / u.resolution;
    let sigma = max(u.p0.x, 0.0001);
    let step_size = max(u.p0.y, 0.0001);

    var color = vec4f(0.0);
    var total_weight = 0.0;

    for (var index = -30; index <= 30; index = index + 1) {
        let position = f32(index) * step_size;
        let weight = exp(-(position * position) / (2.0 * sigma * sigma));
        let sample_uv = input.tex_coord + (texel_size * u.direction * position);
        color = color + textureSample(input_texture, input_sampler, sample_uv) * weight;
        total_weight = total_weight + weight;
    }

    return color / total_weight;
}
