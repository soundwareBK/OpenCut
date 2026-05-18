use std::collections::HashMap;

use bytemuck::{Pod, Zeroable};
use gpu::{FULLSCREEN_SHADER_SOURCE, GpuContext};
use thiserror::Error;
use wgpu::util::DeviceExt;

use crate::{EffectPass, UniformValue};

/// Generic uniform layout shared by every effect shader.
///
/// Layout (std140-friendly):
///   resolution: vec2<f32>        — viewport width/height in pixels
///   time:       vec2<f32>        — (seconds, frame_index)
///   direction:  vec2<f32>        — generic 2D direction (used by separable blurs etc.)
///   _pad:       vec2<f32>        — padding to keep params 16-byte aligned
///   params:     [vec4<f32>; 8]   — 32 free floats; per-shader convention
///
/// Each shader documents how it interprets `params[i].x..w` at the top of its WGSL file.
const PARAM_VEC4_COUNT: usize = 8;
const PARAM_FLOAT_COUNT: usize = PARAM_VEC4_COUNT * 4;

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable, Default)]
struct EffectUniformBuffer {
    resolution: [f32; 2],
    time: [f32; 2],
    direction: [f32; 2],
    _pad: [f32; 2],
    params: [[f32; 4]; PARAM_VEC4_COUNT],
}

/// One registered shader. WGSL source is bundled at compile time.
struct ShaderEntry {
    id: &'static str,
    source: &'static str,
}

/// Registry of every fragment shader the effects pipeline knows about.
///
/// To add a new effect shader:
///   1. Add a WGSL file under `shaders/<name>.wgsl` that uses the standard
///      `EffectUniforms` layout (see `shaders/gaussian_blur.wgsl` for the canonical example).
///   2. Append a `ShaderEntry { id, source: include_str!("shaders/<name>.wgsl") }` here.
///   3. Reference the same `id` from the TypeScript `EffectDefinition`.
const SHADERS: &[ShaderEntry] = &[
    ShaderEntry {
        id: "gaussian-blur",
        source: include_str!("shaders/gaussian_blur.wgsl"),
    },
    ShaderEntry {
        id: "color-grade",
        source: include_str!("shaders/color_grade.wgsl"),
    },
    ShaderEntry {
        id: "vignette",
        source: include_str!("shaders/vignette.wgsl"),
    },
    ShaderEntry {
        id: "rgb-split",
        source: include_str!("shaders/rgb_split.wgsl"),
    },
    ShaderEntry {
        id: "film-grain",
        source: include_str!("shaders/film_grain.wgsl"),
    },
    ShaderEntry {
        id: "pixelate",
        source: include_str!("shaders/pixelate.wgsl"),
    },
    ShaderEntry {
        id: "posterize",
        source: include_str!("shaders/posterize.wgsl"),
    },
    ShaderEntry {
        id: "halftone",
        source: include_str!("shaders/halftone.wgsl"),
    },
    ShaderEntry {
        id: "scanlines",
        source: include_str!("shaders/scanlines.wgsl"),
    },
    ShaderEntry {
        id: "vhs",
        source: include_str!("shaders/vhs.wgsl"),
    },
    ShaderEntry {
        id: "waves",
        source: include_str!("shaders/waves.wgsl"),
    },
    ShaderEntry {
        id: "pinch-bulge",
        source: include_str!("shaders/pinch_bulge.wgsl"),
    },
    ShaderEntry {
        id: "twirl",
        source: include_str!("shaders/twirl.wgsl"),
    },
    ShaderEntry {
        id: "sharpen",
        source: include_str!("shaders/sharpen.wgsl"),
    },
    ShaderEntry {
        id: "glow",
        source: include_str!("shaders/glow.wgsl"),
    },
    ShaderEntry {
        id: "duotone",
        source: include_str!("shaders/duotone.wgsl"),
    },
    ShaderEntry {
        id: "invert",
        source: include_str!("shaders/invert.wgsl"),
    },
    ShaderEntry {
        id: "threshold",
        source: include_str!("shaders/threshold.wgsl"),
    },
    ShaderEntry {
        id: "edge-detect",
        source: include_str!("shaders/edge_detect.wgsl"),
    },
    ShaderEntry {
        id: "emboss",
        source: include_str!("shaders/emboss.wgsl"),
    },
    ShaderEntry {
        id: "dither",
        source: include_str!("shaders/dither.wgsl"),
    },
    ShaderEntry {
        id: "kaleidoscope",
        source: include_str!("shaders/kaleidoscope.wgsl"),
    },
    ShaderEntry {
        id: "mirror",
        source: include_str!("shaders/mirror.wgsl"),
    },
    ShaderEntry {
        id: "fisheye",
        source: include_str!("shaders/fisheye.wgsl"),
    },
];

pub struct ApplyEffectsOptions<'a> {
    pub source: &'a wgpu::Texture,
    pub width: u32,
    pub height: u32,
    pub passes: &'a [EffectPass],
}

pub struct EffectPipeline {
    uniform_bind_group_layout: wgpu::BindGroupLayout,
    pipelines: HashMap<String, wgpu::RenderPipeline>,
}

#[derive(Debug, Error)]
pub enum EffectsError {
    #[error("At least one effect pass is required")]
    MissingEffectPasses,
    #[error("Unknown effect shader '{shader}'")]
    UnknownEffectShader { shader: String },
    #[error("Uniform '{uniform}' for shader '{shader}' must be a number")]
    InvalidNumberUniform { shader: String, uniform: String },
    #[error(
        "Uniform '{uniform}' for shader '{shader}' must be a vector of length {expected_length}"
    )]
    InvalidVectorUniform {
        shader: String,
        uniform: String,
        expected_length: usize,
    },
    #[error(
        "Uniform '{uniform}' for shader '{shader}' is too large (max {max} floats, got {got})"
    )]
    UniformOverflow {
        shader: String,
        uniform: String,
        max: usize,
        got: usize,
    },
    #[error(
        "Unknown uniform '{uniform}' for shader '{shader}' \
         (expected u_direction, u_time, or u_params / u_params_0..u_params_{max_index})"
    )]
    UnknownUniform {
        shader: String,
        uniform: String,
        max_index: usize,
    },
}

impl EffectPipeline {
    pub fn new(context: &GpuContext) -> Self {
        let uniform_bind_group_layout =
            context
                .device()
                .create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                    label: Some("effects-uniform-bind-group-layout"),
                    entries: &[wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Uniform,
                            has_dynamic_offset: false,
                            min_binding_size: None,
                        },
                        count: None,
                    }],
                });
        let vertex_shader_module =
            context
                .device()
                .create_shader_module(wgpu::ShaderModuleDescriptor {
                    label: Some("effects-fullscreen-shader"),
                    source: wgpu::ShaderSource::Wgsl(FULLSCREEN_SHADER_SOURCE.into()),
                });
        let pipeline_layout =
            context
                .device()
                .create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                    label: Some("effects-pipeline-layout"),
                    bind_group_layouts: &[
                        Some(context.texture_sampler_bind_group_layout()),
                        Some(&uniform_bind_group_layout),
                    ],
                    immediate_size: 0,
                });

        let mut pipelines: HashMap<String, wgpu::RenderPipeline> =
            HashMap::with_capacity(SHADERS.len());
        for entry in SHADERS {
            let shader_module =
                context
                    .device()
                    .create_shader_module(wgpu::ShaderModuleDescriptor {
                        label: Some(&format!("effects-{}-shader", entry.id)),
                        source: wgpu::ShaderSource::Wgsl(entry.source.into()),
                    });
            let pipeline =
                context
                    .device()
                    .create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                        label: Some(&format!("effects-{}-pipeline", entry.id)),
                        layout: Some(&pipeline_layout),
                        vertex: wgpu::VertexState {
                            module: &vertex_shader_module,
                            entry_point: Some("vertex_main"),
                            buffers: &[wgpu::VertexBufferLayout {
                                array_stride: std::mem::size_of::<[f32; 2]>() as u64,
                                step_mode: wgpu::VertexStepMode::Vertex,
                                attributes: &[wgpu::VertexAttribute {
                                    format: wgpu::VertexFormat::Float32x2,
                                    offset: 0,
                                    shader_location: 0,
                                }],
                            }],
                            compilation_options: wgpu::PipelineCompilationOptions::default(),
                        },
                        fragment: Some(wgpu::FragmentState {
                            module: &shader_module,
                            entry_point: Some("fragment_main"),
                            targets: &[Some(wgpu::ColorTargetState {
                                format: context.texture_format(),
                                blend: None,
                                write_mask: wgpu::ColorWrites::ALL,
                            })],
                            compilation_options: wgpu::PipelineCompilationOptions::default(),
                        }),
                        primitive: wgpu::PrimitiveState::default(),
                        depth_stencil: None,
                        multisample: wgpu::MultisampleState::default(),
                        multiview_mask: None,
                        cache: None,
                    });
            pipelines.insert(entry.id.to_string(), pipeline);
        }

        Self {
            uniform_bind_group_layout,
            pipelines,
        }
    }

    pub fn apply(
        &self,
        context: &GpuContext,
        ApplyEffectsOptions {
            source,
            width,
            height,
            passes,
        }: ApplyEffectsOptions<'_>,
    ) -> Result<wgpu::Texture, EffectsError> {
        let mut encoder =
            context
                .device()
                .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                    label: Some("effects-command-encoder"),
                });
        let output = self.apply_with_encoder(
            context,
            &mut encoder,
            ApplyEffectsOptions {
                source,
                width,
                height,
                passes,
            },
        )?;
        context.queue().submit([encoder.finish()]);
        Ok(output)
    }

    pub fn apply_with_encoder(
        &self,
        context: &GpuContext,
        encoder: &mut wgpu::CommandEncoder,
        ApplyEffectsOptions {
            source,
            width,
            height,
            passes,
        }: ApplyEffectsOptions<'_>,
    ) -> Result<wgpu::Texture, EffectsError> {
        let mut current_texture: Option<wgpu::Texture> = None;

        for pass in passes {
            let input_texture = current_texture.as_ref().unwrap_or(source);
            let output_texture =
                context.create_render_texture(width, height, "effects-pass-output");
            let input_view = input_texture.create_view(&wgpu::TextureViewDescriptor::default());
            let output_view = output_texture.create_view(&wgpu::TextureViewDescriptor::default());
            let texture_bind_group =
                context
                    .device()
                    .create_bind_group(&wgpu::BindGroupDescriptor {
                        label: Some("effects-texture-bind-group"),
                        layout: context.texture_sampler_bind_group_layout(),
                        entries: &[
                            wgpu::BindGroupEntry {
                                binding: 0,
                                resource: wgpu::BindingResource::TextureView(&input_view),
                            },
                            wgpu::BindGroupEntry {
                                binding: 1,
                                resource: wgpu::BindingResource::Sampler(context.linear_sampler()),
                            },
                        ],
                    });
            let uniform_buffer =
                context
                    .device()
                    .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                        label: Some("effects-uniform-buffer"),
                        contents: bytemuck::bytes_of(&pack_effect_uniforms(pass, width, height)?),
                        usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
                    });
            let uniform_bind_group =
                context
                    .device()
                    .create_bind_group(&wgpu::BindGroupDescriptor {
                        label: Some("effects-uniform-bind-group"),
                        layout: &self.uniform_bind_group_layout,
                        entries: &[wgpu::BindGroupEntry {
                            binding: 0,
                            resource: uniform_buffer.as_entire_binding(),
                        }],
                    });
            let pipeline = self.pipelines.get(&pass.shader).ok_or_else(|| {
                EffectsError::UnknownEffectShader {
                    shader: pass.shader.clone(),
                }
            })?;

            {
                let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                    label: Some("effects-render-pass"),
                    color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                        view: &output_view,
                        resolve_target: None,
                        depth_slice: None,
                        ops: wgpu::Operations {
                            load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                            store: wgpu::StoreOp::Store,
                        },
                    })],
                    depth_stencil_attachment: None,
                    occlusion_query_set: None,
                    timestamp_writes: None,
                    multiview_mask: None,
                });
                render_pass.set_pipeline(pipeline);
                render_pass.set_vertex_buffer(0, context.fullscreen_quad().slice(..));
                render_pass.set_bind_group(0, &texture_bind_group, &[]);
                render_pass.set_bind_group(1, &uniform_bind_group, &[]);
                render_pass.draw(0..6, 0..1);
            }

            current_texture = Some(output_texture);
        }

        current_texture.ok_or(EffectsError::MissingEffectPasses)
    }
}

/// Map named uniforms from a pass onto the generic `EffectUniformBuffer`.
///
/// Recognized uniform names:
///   - `u_direction` — vec2; defaults to (0, 0)
///   - `u_time`      — number or vec2; written into time.xy
///   - `u_params`    — vec of up to 32 floats; written sequentially into params[0..7].xyzw
///   - `u_params_<N>` (N in 0..7) — vec of up to 4 floats; written into params[N].xyzw
///
/// Unknown names return `UnknownUniform` so typos surface during development.
fn pack_effect_uniforms(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<EffectUniformBuffer, EffectsError> {
    let mut buffer = EffectUniformBuffer {
        resolution: [width as f32, height as f32],
        ..EffectUniformBuffer::default()
    };

    for (name, value) in &pass.uniforms {
        match name.as_str() {
            "u_direction" => {
                buffer.direction = read_vec2(pass, name, value)?;
            }
            "u_time" => match value {
                UniformValue::Number(n) => buffer.time = [*n, 0.0],
                UniformValue::Vector(v) if v.len() == 1 => buffer.time = [v[0], 0.0],
                UniformValue::Vector(v) if v.len() == 2 => buffer.time = [v[0], v[1]],
                _ => {
                    return Err(EffectsError::InvalidVectorUniform {
                        shader: pass.shader.clone(),
                        uniform: name.clone(),
                        expected_length: 2,
                    });
                }
            },
            "u_params" => {
                let values = read_floats(pass, name, value);
                if values.len() > PARAM_FLOAT_COUNT {
                    return Err(EffectsError::UniformOverflow {
                        shader: pass.shader.clone(),
                        uniform: name.clone(),
                        max: PARAM_FLOAT_COUNT,
                        got: values.len(),
                    });
                }
                for (i, v) in values.iter().enumerate() {
                    buffer.params[i / 4][i % 4] = *v;
                }
            }
            other if other.starts_with("u_params_") => {
                let suffix = &other["u_params_".len()..];
                let index: usize = suffix.parse().map_err(|_| EffectsError::UnknownUniform {
                    shader: pass.shader.clone(),
                    uniform: name.clone(),
                    max_index: PARAM_VEC4_COUNT - 1,
                })?;
                if index >= PARAM_VEC4_COUNT {
                    return Err(EffectsError::UnknownUniform {
                        shader: pass.shader.clone(),
                        uniform: name.clone(),
                        max_index: PARAM_VEC4_COUNT - 1,
                    });
                }
                let values = read_floats(pass, name, value);
                if values.len() > 4 {
                    return Err(EffectsError::UniformOverflow {
                        shader: pass.shader.clone(),
                        uniform: name.clone(),
                        max: 4,
                        got: values.len(),
                    });
                }
                for (i, v) in values.iter().enumerate() {
                    buffer.params[index][i] = *v;
                }
            }
            // Back-compat aliases for the original blur pipeline: scalars used to live at
            // (scalars.x, scalars.y). They now map onto params[0].x / params[0].y so existing
            // gaussian-blur invocations using u_sigma / u_step keep working.
            "u_sigma" => {
                buffer.params[0][0] = read_number(pass, name, value)?;
            }
            "u_step" => {
                buffer.params[0][1] = read_number(pass, name, value)?;
            }
            _ => {
                return Err(EffectsError::UnknownUniform {
                    shader: pass.shader.clone(),
                    uniform: name.clone(),
                    max_index: PARAM_VEC4_COUNT - 1,
                });
            }
        }
    }

    Ok(buffer)
}

fn read_number(pass: &EffectPass, name: &str, value: &UniformValue) -> Result<f32, EffectsError> {
    match value {
        UniformValue::Number(n) => Ok(*n),
        UniformValue::Vector(v) if v.len() == 1 => Ok(v[0]),
        _ => Err(EffectsError::InvalidNumberUniform {
            shader: pass.shader.clone(),
            uniform: name.to_string(),
        }),
    }
}

fn read_vec2(
    pass: &EffectPass,
    name: &str,
    value: &UniformValue,
) -> Result<[f32; 2], EffectsError> {
    match value {
        UniformValue::Vector(v) if v.len() == 2 => Ok([v[0], v[1]]),
        _ => Err(EffectsError::InvalidVectorUniform {
            shader: pass.shader.clone(),
            uniform: name.to_string(),
            expected_length: 2,
        }),
    }
}

fn read_floats(_pass: &EffectPass, _name: &str, value: &UniformValue) -> Vec<f32> {
    match value {
        UniformValue::Number(n) => vec![*n],
        UniformValue::Vector(v) => v.clone(),
    }
}
